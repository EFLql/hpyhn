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
    if (signature && !verifySignature(payload, signature)) {
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
    switch (payload.resource_name) {
      case 'sale':
        if (payload.recurrence === 'monthly') {
          await handleActiveSubscription(payload, verification.sale)
        }
        break
        
      case 'subscription':
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
    } else if (payload.custom_fields) {
      customFields = payload.custom_fields
    }
  } catch (e) {
    console.error('Error parsing custom fields:', e)
  }

  // 从多个可能的位置提取 user_id
  let userId = null;
  
  // 1. 从自定义字段中提取
  if (customFields.user_id) {
    userId = customFields.user_id;
  }
  
  // 2. 从 payload 直接字段中提取
  if (!userId && payload.user_id) {
    userId = payload.user_id;
  }
  
  // 3. 从 URL 参数中提取
  if (!userId && payload['url_params[user_id]']) {
    userId = payload['url_params[user_id]'];
  }
  
  // 4. 从 variants 中提取（如果 Gumroad 以这种方式发送）
  if (!userId && payload['variants[user_id]']) {
    userId = payload['variants[user_id]'];
  }

  // 确保必要的字段存在
  if (!userId) {
    console.error('No user ID found in payload', payload)
    return
  }

  console.log('Processing subscription for user:', userId)

  // 计算当前周期结束日期（对于按月订阅）
  let currentPeriodEnd = null;
  if (payload.recurrence === 'monthly' && payload.sale_timestamp) {
    const saleDate = new Date(payload.sale_timestamp);
    // 对于按月订阅，周期结束日期是下个月的同一天
    currentPeriodEnd = new Date(saleDate.setMonth(saleDate.getMonth() + 1));
  }

  const subscriptionData = {
    user_id: userId,
    gumroad_id: payload.subscription_id || payload.gumroad_id,
    product_id: payload.product_id,
    product_name: payload.product_name,
    status: payload.refunded === 'true' ? 'refunded' : 'active',
    current_period_end: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
    last_verified: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: payload.email,
    price: payload.price,
    currency: payload.currency,
    recurrence: payload.recurrence,
    purchaser_id: payload.purchaser_id,
    order_number: payload.order_number,
    sale_id: payload.sale_id,
    ip_country: payload.ip_country,
    variants: payload.variants ? JSON.stringify(payload.variants) : null,
    custom_fields: payload.custom_fields ? JSON.stringify(customFields) : null
  };

  const { error } = await supabase
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'user_id'
    })

  if (error) {
    console.error('Error upserting subscription:', error)
  }
}

async function handleInactiveSubscription(payload) {
  // 确保 subscription_id 存在
  if (!payload.subscription_id && !payload.gumroad_id) {
    console.error('No subscription ID found in payload', payload)
    return
  }

  const subscriptionId = payload.subscription_id || payload.gumroad_id;

  const { error } = await supabase
    .from('subscriptions')
    .update({ 
      status: payload.event_name.split('_')[1],
      updated_at: new Date().toISOString()
    })
    .eq('gumroad_id', subscriptionId)

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

  // 2. 检查签名是否存在
  if (!signature) {
    console.error('No signature provided')
    return false
  }

  // 3. 创建 HMAC SHA256 哈希
  const hmac = crypto.createHmac('sha256', secret)
  
  // 4. Gumroad 签名的是原始表单数据的字符串表示
  // 我们需要将对象转换为查询字符串格式进行签名验证
  const payloadString = Object.keys(payload)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(payload[key] || '')}`)
    .join('&')
  
  hmac.update(payloadString)
  
  // 5. 获取十六进制格式的摘要
  const calculatedSignature = hmac.digest('hex')
  
  // 6. 与收到的签名进行比较
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch (e) {
    console.error('Signature comparison error:', e)
    return false
  }
}