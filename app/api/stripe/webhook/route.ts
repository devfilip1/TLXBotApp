import { NextResponse } from 'next/server';
import { stripe } from '@/src/backend/services/stripe';
import { supabaseAdmin } from '@/src/backend/services/supabase-admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// Helper: garante que o profile existe na tabela profiles antes de qualquer FK insert
// Isso é necessário para usuários criados antes do trigger ser configurado
async function ensureProfile(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) return; // profile já existe

  // Buscar dados do usuário no Supabase Auth
  const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !user) {
    console.error('[webhook] ensureProfile: usuário não encontrado no Auth:', userId, error);
    throw new Error(`Usuário ${userId} não encontrado no Supabase Auth`);
  }

  const { error: insertErr } = await supabaseAdmin.from('profiles').upsert({
    id: user.id,
    email: user.email!,
    name: (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User',
  }, { onConflict: 'id' });

  if (insertErr) {
    console.error('[webhook] ensureProfile: erro ao criar profile:', insertErr);
    throw new Error(`Falha ao criar profile: ${insertErr.message}`);
  }

  console.log(`[webhook] ensureProfile: profile criado para usuário ${userId}`);
}

// Helper: write subscription row to DB and log any errors
async function upsertSubscription(subscription: Stripe.Subscription, userId: string) {
  // Na API version 2026-03-25.dahlia, o current_period_end foi movido para
  // subscription.items.data[0].current_period_end. Lemos dos dois lugares para segurança.
  const item = subscription.items.data[0];
  const periodEnd: number =
    (item as any).current_period_end ??
    (subscription as any).current_period_end ??
    0;

  if (!periodEnd) {
    console.error('[webhook] current_period_end não encontrado na subscription:', subscription.id);
    throw new Error('current_period_end ausente — verifique a versão da API do Stripe');
  }

  const { error } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: item.price.id,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  if (error) {
    console.error('[webhook] subscriptions upsert failed:', error);
    throw new Error(`subscriptions upsert: ${error.message}`);
  }

  console.log(`[webhook] subscription ${subscription.id} → user ${userId} (${subscription.status})`);
}

// Helper: ensure customer<->user mapping exists
async function upsertCustomer(userId: string, stripeCustomerId: string) {
  const { error } = await supabaseAdmin.from('customers').upsert(
    { user_id: userId, stripe_customer_id: stripeCustomerId },
    { onConflict: 'user_id' }
  );

  if (error) {
    // This often fails if the profile row doesn't exist yet.
    // Log and rethrow so Stripe will retry.
    console.error('[webhook] customers upsert failed:', error);
    throw new Error(`customers upsert: ${error.message}`);
  }
}

// Helper: resolve user_id from stripe customer id via the customers table
async function resolveUserId(stripeCustomerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows, which is a valid "not found" — anything else is a real error
    console.error('[webhook] customers lookup failed:', error);
  }

  return data?.user_id ?? null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.log(`[webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // ─── Checkout completed: save customer mapping AND subscription immediately ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId: string | null =
          (session.client_reference_id as string | null) ?? null;
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : null;

        if (!userId || !stripeCustomerId) {
          console.warn(
            '[webhook] checkout.session.completed: missing client_reference_id or customer',
            { userId, stripeCustomerId }
          );
          break;
        }

        // 0. Garantir que o profile existe (FK guard)
        await ensureProfile(userId);

        // 1. Save customer<->user mapping
        await upsertCustomer(userId, stripeCustomerId);

        // 2. If this session has a subscription, write it to the DB right now
        //    instead of waiting for the customer.subscription.created event.
        //    This eliminates the race condition where that event arrives before
        //    the customer mapping is saved.
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;

          // Expand the subscription to get full details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscription(subscription, userId);
        }
        break;
      }

      // ─── Subscription lifecycle events ───────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Strategy 1: metadata set at checkout time
        let userId: string | null =
          (subscription.metadata?.supabaseUUID as string | null) ?? null;

        // Strategy 2: look up via customers table
        if (!userId) {
          userId = await resolveUserId(subscription.customer as string);
        }

        if (!userId) {
          console.warn(
            `[webhook] ${event.type}: could not resolve user for customer ${subscription.customer}. ` +
            `The checkout.session.completed event may not have been processed yet. Stripe will retry.`
          );
          // Return 400 so Stripe retries this event later
          return NextResponse.json(
            { error: 'user not found — will retry' },
            { status: 400 }
          );
        }

        await upsertSubscription(subscription, userId);
        break;
      }

      // ─── Invoice events ────────────────────────────────────────────────────
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;

        if (!invoice.subscription) break;

        const userId = await resolveUserId(invoice.customer as string);

        if (!userId) {
          console.warn('[webhook] invoice event: could not resolve user for customer', invoice.customer);
          break;
        }

        // Record the payment
        if (invoice.id) {
          const { error } = await supabaseAdmin.from('payments').upsert(
            {
              user_id: userId,
              stripe_invoice_id: invoice.id,
              amount: invoice.amount_paid ?? 0,
              currency: invoice.currency,
              status: event.type === 'invoice.payment_succeeded' ? 'succeeded' : 'failed',
            },
            { onConflict: 'stripe_invoice_id' }
          );

          if (error) {
            console.error('[webhook] payments upsert failed:', error);
          }
        }

        // On payment failure, sync the subscription status so the user is aware
        if (event.type === 'invoice.payment_failed' && invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription.id
          );
          await upsertSubscription(subscription, userId);
        }

        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // Return 500 so Stripe will retry the event
    console.error('[webhook] Handler threw an error:', err.message);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }
}
