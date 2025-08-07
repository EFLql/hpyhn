import { NextResponse } from 'next/server'
import { supabase } from '../../../../utils/supabase/client'

export async function POST(request) {
  try {
    console.log('Received Gumroad webhook request')
    const payload = await request.json()
    
    // Verify the webhook signature if needed
    // const signature = request.headers.get('X-Gumroad-Signature')
    
    // Handle different event types
    switch (payload.event_name) {
      case 'subscription_created':
      case 'subscription_renewed':
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: payload.custom_fields.user_id,
            gumroad_id: payload.subscription_id,
            product_id: payload.product_id,
            status: 'active',
            next_bill_date: payload.next_bill_date
          })
        break
        
      case 'subscription_cancelled':
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('gumroad_id', payload.subscription_id)
        break
        
      case 'subscription_failed':
        await supabase
          .from('subscriptions')
          .update({ status: 'failed' })
          .eq('gumroad_id', payload.subscription_id)
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gumroad webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}