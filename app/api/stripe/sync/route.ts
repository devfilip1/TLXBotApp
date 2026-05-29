import { NextResponse } from "next/server";
import { stripe } from "@/src/backend/services/stripe";
import { supabaseAdmin } from "@/src/backend/services/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Helper: garante que o profile existe na tabela profiles antes de qualquer FK insert
async function ensureProfile(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (existing) return; // profile já existe

  // Buscar dados do usuário no Supabase Auth
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !user) {
    console.error(
      "[sync] ensureProfile: usuário não encontrado no Auth:",
      userId,
      error,
    );
    throw new Error(`Usuário ${userId} não encontrado no Supabase Auth`);
  }

  const { error: insertErr } = await supabaseAdmin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email!,
      name:
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] ||
        "User",
    },
    { onConflict: "id" },
  );

  if (insertErr) {
    console.error("[sync] ensureProfile: erro ao criar profile:", insertErr);
    throw new Error(`Falha ao criar profile: ${insertErr.message}`);
  }

  console.log(`[sync] ensureProfile: profile criado para usuário ${userId}`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkoutSession && checkoutSession.subscription) {
      const subscription = checkoutSession.subscription as Stripe.Subscription;

      let userId: string | null =
        checkoutSession.client_reference_id ??
        (subscription.metadata?.supabaseUUID as string | null) ??
        null;

      if (!userId) {
        const stripeCustomerId =
          typeof checkoutSession.customer === "string"
            ? checkoutSession.customer
            : (subscription.customer as string);

        if (stripeCustomerId) {
          const { data: customerData } = await supabaseAdmin
            .from("customers")
            .select("user_id")
            .eq("stripe_customer_id", stripeCustomerId)
            .single();
          userId = customerData?.user_id ?? null;
        }
      }

      if (!userId && token) {
        const supabaseClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const {
          data: { user },
        } = await supabaseClient.auth.getUser(token);
        userId = user?.id ?? null;
      }

      if (!userId) {
        console.error("[sync] could not resolve user for checkout session", {
          sessionId,
          client_reference_id: checkoutSession.client_reference_id,
          subscriptionMetadata: subscription.metadata,
          customer: checkoutSession.customer,
        });
        return NextResponse.json(
          { error: "Could not resolve user for checkout session" },
          { status: 400 },
        );
      }

      // Garantir que o profile existe (FK guard)
      await ensureProfile(userId);

      // Ensure customer<->user mapping exists for future webhook events
      const stripeCustomerId =
        typeof checkoutSession.customer === "string"
          ? checkoutSession.customer
          : (subscription.customer as string);
      if (stripeCustomerId) {
        const { error: customerError } = await supabaseAdmin
          .from("customers")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
            },
            { onConflict: "user_id" },
          );

        if (customerError) {
          console.error("[sync] customers upsert failed:", customerError);
          throw new Error(`customers upsert: ${customerError.message}`);
        }
      }

      const item = subscription.items.data[0];

      if (!item) {
        console.error("Sync error: subscription has no items", {
          subscriptionId: subscription.id,
        });
        return NextResponse.json(
          { error: "Subscription has no items" },
          { status: 400 },
        );
      }

      // Na API version 2026-03-25.dahlia, o current_period_end foi movido para
      // subscription.items.data[0].current_period_end. Lemos dos dois lugares para segurança.
      const periodEnd: number =
        (item as any).current_period_end ??
        (subscription as any).current_period_end ??
        0;

      if (!Number.isFinite(periodEnd) || periodEnd <= 0) {
        console.error("Sync error: invalid current_period_end", {
          subscriptionId: subscription.id,
          current_period_end: periodEnd,
          itemCurrentPeriodEnd: (item as any).current_period_end,
          subscriptionCurrentPeriodEnd: (subscription as any)
            .current_period_end,
        });
        return NextResponse.json(
          { error: "Invalid subscription period end value" },
          { status: 400 },
        );
      }

      const priceId = item.price?.id;
      if (!priceId) {
        console.error("Sync error: missing subscription price id", {
          subscriptionId: subscription.id,
          item,
        });
        return NextResponse.json(
          { error: "Missing price id on subscription item" },
          { status: 400 },
        );
      }

      const { error: subscriptionError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            price_id: priceId,
            current_period_end: new Date(periodEnd * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" },
        );

      if (subscriptionError) {
        console.error("[sync] subscriptions upsert failed:", subscriptionError);
        throw new Error(`subscriptions upsert: ${subscriptionError.message}`);
      }

      console.log(
        `[sync] subscription ${subscription.id} → user ${userId} (${subscription.status})`,
      );

      return NextResponse.json({ success: true, synced: true });
    }

    return NextResponse.json({ success: true, synced: false });
  } catch (err: any) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
