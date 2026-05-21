import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'dummy_build_key';

export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-03-25.dahlia',
    appInfo: {
        name: 'AppVault Subs',
        version: '0.1.0'
    }
});
