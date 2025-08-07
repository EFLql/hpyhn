import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // 解析表单数据而不是 JSON
    const formData = await request.formData()
    const payload = {}
    
    // 将 FormData 转换为普通对象
    for (const [key, value] of formData.entries()) {
      payload[key] = value
    }
    
    console.log('Webhook payload:', payload)

    // 验证 webhook 签名（推荐）
    const signature = request.headers.get('X-Gumroad-Signature')
    if (!verifySignature(payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // 验证销售与 Gumroad API
    const verification = await verifyWithGumroad(payload.sale_id)
    if (!verification.success) {
      return NextResponse.json(
        { error: 'Invalid sale' },
        { status: 400 }
      )
    }

    // 处理订阅
    switch (payload.event_name) {
      case 'subscription_created':
      case 'subscription_renewed':
        await handleActiveSubscription(payload, verification.sale)
        break
        
      case 'subscription_cancelled':
      case 'subscription_failed':
        await handleInactiveSubscription(payload)
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}

async function verifyWithGumroad(saleId) {
  const url = `https://api.gumroad.com/v2/sales/${saleId}?access_token=${process.env.GUMROAD_ACCESS_TOKEN}`
  const response = await fetch(url)
  return response.json()
}

async function handleActiveSubscription(payload, verifiedSale) {
  // 解析自定义字段（Gumroad 以 JSON 字符串形式发送）
  let customFields = {}
  try {
    if (typeof payload.custom_fields === 'string') {
      customFields = JSON.parse(payload.custom_fields)
    } else {
      customFields = payload.custom_fields
    }
  } catch (e) {
    console.error('Error parsing custom fields:', e)
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: customFields.user_id || payload.user_id,
      gumroad_id: payload.subscription_id,
      product_id: payload.product_id,
      status: verifiedSale.refunded ? 'refunded' : 'active',
      next_bill_date: payload.next_bill_date,
      last_verified: new Date().toISOString(),
      current_period_end: payload.next_bill_date,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    console.error('Error upserting subscription:', error)
  }
}

async function handleInactiveSubscription(payload) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ 
      status: payload.event_name.split('_')[1],
      updated_at: new Date().toISOString()
    })
    .eq('gumroad_id', payload.subscription_id)

  if (error) {
    console.error('Error updating subscription:', error)
  }
}

function verifySignature(payload, signature) {
  // 1. 从环境变量获取 webhook 密钥
  const secret = process.env.GUMROAD_WEBHOOK_SECRET
  if (!secret) {
    console.error('Gumroad webhook secret not configured')
    return false
  }

  // 2. 创建 HMAC SHA256 哈希
  const hmac = crypto.createHmac('sha256', secret)
  
  // 3. Gumroad 签名的是原始表单数据的字符串表示
  // 我们需要将对象转换为查询字符串格式进行签名验证
  const payloadString = Object.keys(payload)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key])}`)
    .join('&')
  
  hmac.update(payloadString)
  
  // 4. 获取十六进制格式的摘要
  const calculatedSignature = hmac.digest('hex')
  
  // 5. 与收到的签名进行比较
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    )
  } catch (e) {
    console.error('Signature comparison error:', e)
    return false
  }
}