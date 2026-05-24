import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/backend/services/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "pending";
    const authHeader = request.headers.get("Authorization");

    const n8nSecret = process.env.N8N_SECRET_TOKEN;

    if (!authHeader || authHeader !== `Bearer ${n8nSecret}`) {
      return NextResponse.json({ error: "Unauthorized N8N" }, { status: 401 });
    }

    // Buscar linhas da tabela (1 linha = 1 conta)
    let query = supabaseAdmin
      .from("accounts")
      .select("id, name, encrypted_accounts");

    if (type === "pending") {
      query = query.eq("needs_sync", true);
    }

    const { data: rows, error: rowsError } = await query;

    if (rowsError || !rows) {
      console.error("Fetch accounts error:", rowsError);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 },
      );
    }

    // Cada linha já é uma conta — ler encrypted_accounts como objeto único
    const allAccounts = [];

    for (const row of rows) {
      const acc = row.encrypted_accounts as any;
      if (!acc) continue;

      const login = row.name || "";
      const senha =
        acc.password && acc.passwordIv
          ? `${acc.passwordIv}:${acc.password}`
          : "";

      if (login || senha) {
        allAccounts.push({
          login,
          senha,
          accountId: row.id,
        });
      }
    }

    return NextResponse.json({ type, accounts: allAccounts }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ROTA PARA FINALIZAR: O robô chama isso após a automação terminar
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const n8nSecret =
      process.env.N8N_SECRET_TOKEN || "sua-senha-secreta-do-n8n-aqui";

    if (!authHeader || authHeader !== `Bearer ${n8nSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // accountIds = lista de IDs de contas que tiveram ERRO de login
    const { accountIds } = await request.json();
    const errorIds: string[] = Array.isArray(accountIds) ? accountIds : [];

    // 1. Marcar as contas com erro
    if (errorIds.length > 0) {
      const { error: errUpdate } = await supabaseAdmin
        .from("accounts")
        .update({ has_error: true })
        .in("id", errorIds);

      if (errUpdate) console.error("Error marking has_error:", errUpdate);
    }

    // 2. Marcar como sincronizadas todas as contas pending que NÃO tiveram erro
    let successQuery = supabaseAdmin
      .from("accounts")
      .update({
        needs_sync: false,
        has_error: false,
        last_run_at: new Date().toISOString(),
      })
      .eq("needs_sync", true);

    if (errorIds.length > 0) {
      successQuery = successQuery.not("id", "in", `(${errorIds.join(",")})`);
    }

    const { error: successUpdate } = await successQuery;
    if (successUpdate) console.error("Error marking success:", successUpdate);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }
}
