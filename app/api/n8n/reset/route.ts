import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/backend/services/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const n8nSecret = process.env.N8N_SECRET_TOKEN || 'sua-senha-secreta-do-n8n-aqui';

    if (!authHeader || authHeader !== `Bearer ${n8nSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Marca TODOS os usuários ativos/premium para sincronizar novamente
    // Primeiro pegamos os IDs de quem tem assinatura ativa (opcional, mas recomendado)
    const { data: activeSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .in('status', ['active', 'trialing']);

    const activeUserIds = activeSubs?.map(s => s.user_id) || [];

    if (activeUserIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No active users to reset' });
    }

    // Reseta apenas os usuários que pagam
    const { error } = await supabaseAdmin
      .from('accounts')
      .update({ 
        needs_sync: true 
      })
      .in('user_id', activeUserIds);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `Reset successful for ${activeUserIds.length} active users.` 
    });

  } catch (error) {
    console.error('Reset endpoint error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
