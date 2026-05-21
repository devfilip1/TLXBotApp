import { NextResponse } from 'next/server';
import { stripe } from '@/src/backend/services/stripe';
import { supabaseAdmin } from '@/src/backend/services/supabase-admin';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    if (checkoutSession && checkoutSession.subscription) {
      const subscription = checkoutSession.subscription as Stripe.Subscription;

      // Strategy 1: use supabaseUUID stored in subscription metadata at checkout time
      let userId: string | null = subscription.metadata?.supabaseUUID ?? null;

      // Strategy 2: fallback — look up via customers table
      if (!userId) {
        const { data: customerData } = await supabaseAdmin
          .from('customers')
          .select('user_id')
          .eq('stripe_customer_id', subscription.customer as string)
          .single();
        userId = customerData?.user_id ?? null;
      }

      // Strategy 3: fallback — resolve from the authenticated token
      if (!userId) {
        const token = authHeader.replace('Bearer ', '');
        const supabaseClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        userId = user?.id ?? null;
      }

      if (userId) {
        // Ensure customer<->user mapping exists for future webhook events
        await supabaseAdmin.from('customers').upsert({
          user_id: userId,
          stripe_customer_id: subscription.customer as string
        }, { onConflict: 'user_id' });

        // Upsert subscription — conflict on stripe_subscription_id (UNIQUE in schema)
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString()
        }, { onConflict: 'stripe_subscription_id' });

        return NextResponse.json({ success: true, synced: true });
      }
    }

    return NextResponse.json({ success: true, synced: false });
  } catch (err: any) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
