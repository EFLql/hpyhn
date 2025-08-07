import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // 只在服务器端使用
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const saleId = searchParams.get('sale_id')
  const userId = searchParams.get('user_id')

  if (!saleId || !userId) {
    return NextResponse.json({ success: false, error: 'Missing sale_id or user_id' }, { status: 400 })
  }

  // 1️⃣ 调用 Gumroad Sales API 验证
  const gumroadUrl = `https://api.gumroad.com/v2/sales?access_token=${process.env.GUMROAD_ACCESS_TOKEN}&sale_id=${saleId}`
  let gumroadResp
  try {
    const res = await fetch(gumroadUrl)
    gumroadResp = await res.json()
  } catch (err) {
    console.error('Gumroad fetch error:', err)
    return NextResponse.json({ success: false, error: 'Failed to call Gumroad API' }, { status: 502 })
  }

  if (!gumroadResp.success) {
    console.error('Gumroad API error:', gumroadResp)
    return NextResponse.json({ success: false, error: gumroadResp.message || 'Invalid Gumroad response' }, { status: 400 })
  }

  const sale = gumroadResp.sale

  // 2️⃣ 把订阅信息写入 Supabase（upsert）
  const subscriptionData = {
    user_id: userId,
    gumroad_sale_id: sale.id,
    gumroad_product_id: sale.product_id,
    email: sale.email,
    status: sale.refunded ? 'canceled' : 'active',
    next_billing_date: sale.next_payment_date || null,
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: ['user_id'] })
    .select('*')
    .single()

  if (error) {
    console.error('Supabase upsert error:', error)
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, subscription: data })
}