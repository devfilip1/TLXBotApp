import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/backend/services/supabase-admin";
import { encrypt } from "@/src/backend/utils/encryption";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    // Auth Check
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Subscription Check
    const { data: subData } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (
      !subData ||
      (subData.status !== "active" && subData.status !== "trialing")
    ) {
      return NextResponse.json(
        { error: "Requires active premium subscription" },
        { status: 403 },
      );
    }

    const { accounts } = await request.json();

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json(
        { error: "Invalid accounts format" },
        { status: 400 },
      );
    }

    // Preservar estado has_error das contas já existentes no banco
    const { data: existingRows } = await supabaseAdmin
      .from("accounts")
      .select("id, has_error")
      .eq("user_id", user.id);

    const errorMap = new Map<string, boolean>();
    for (const row of existingRows || []) {
      errorMap.set(row.id, row.has_error ?? false);
    }

    // Remover do banco contas que o usuário deletou no frontend
    const frontendIds = accounts.map((acc: any) => acc.id as string);
    const existingIds = (existingRows || []).map((r) => r.id);
    const idsToDelete = existingIds.filter((id) => !frontendIds.includes(id));

    if (idsToDelete.length > 0) {
      await supabaseAdmin.from("accounts").delete().in("id", idsToDelete);
    }

    // Preparar upsert: 1 linha por conta, usando o id do frontend como id da linha
    const rowsToUpsert = accounts.map((acc: any) => {
      let encryptedPassword = null;
      let passwordIv = null;

      if (acc.password) {
        const result = encrypt(acc.password);
        encryptedPassword = result.encryptedData;
        passwordIv = result.iv;
      }

      return {
        id: acc.id, // UUID do frontend = id da linha no banco
        user_id: user.id,
        name: acc.name || "", // nome em texto plano
        password: {
          password: encryptedPassword,
          passwordIv,
        },
        needs_sync: true,
        has_error: errorMap.get(acc.id) ?? false,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from("accounts")
      .upsert(rowsToUpsert, { onConflict: "id" });

    if (upsertError) {
      console.error("Accounts upsert error:", JSON.stringify(upsertError));
      return NextResponse.json(
        {
          error: "Failed to save accounts to cloud vault",
          detail: upsertError.message,
          code: upsertError.code,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error syncing accounts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync accounts." },
      { status: 500 },
    );
  }
}
