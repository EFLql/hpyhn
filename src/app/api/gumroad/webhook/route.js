import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to send GA4 events from the server
async function sendGa4Event(userId, eventName, eventParams, gaClientId = null, gaSessionId = null) {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.warn('GA4 Measurement ID or API Secret not configured. Skipping GA4 event.');
    return;
  }

  // Use provided gaClientId, otherwise fallback to userId
  const finalClientId = gaClientId || userId;

  // Construct the GA4 event payload
  const ga4Payload = {
    client_id: finalClientId, // Use the extracted client_id or fallback
    user_id: userId, // Always send user_id if available
    events: [{
      name: eventName,
      params: eventParams,
    }],
  };

  // Add session_id if available
  if (gaSessionId) {
    ga4Payload.events[0].params.session_id = gaSessionId;
    // For server-side events, we also need to set the engagement time
    // This is a simplified approach; a more robust solution might involve tracking session start times.
    ga4Payload.events[0].params.engagement_time_msec = '1'; 
  }

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ga4Payload),
      }
    );

    if (!response.ok) {
      console.error(`Failed to send GA4 event: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('GA4 error response:', errorBody);
    } else {
      console.log(`GA4 event '${eventName}' sent successfully for user ${userId}`);
    }
  } catch (error) {
    console.error('Error sending GA4 event:', error);
  }
}

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
        await handleActiveSubscription(payload, verification.sale)
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
  let gaClientId = null;
  let gaSessionId = null;
  
  // 1. 从自定义字段中提取
  if (customFields.user_id) {
    userId = customFields.user_id;
  }
  // 提取 client_id 和 session_id
  if (customFields.client_id) {
    gaClientId = customFields.client_id;
  }
  if (customFields.session_id) {
    gaSessionId = customFields.session_id;
  }
  
  // 2. 从 payload 直接字段中提取
  if (!userId && payload.user_id) {
    userId = payload.user_id;
  }
  if (!gaClientId && payload.client_id) { // Check if client_id is directly in payload
    gaClientId = payload.client_id;
  }
  if (!gaSessionId && payload.session_id) { // Check if session_id is directly in payload
    gaSessionId = payload.session_id;
  }
  
  // 3. 从 URL 参数中提取
  if (!userId && payload['url_params[user_id]']) {
    userId = payload['url_params[user_id]'];
  }
  if (!gaClientId && payload['url_params[client_id]']) {
    gaClientId = payload['url_params[client_id]'];
  }
  if (!gaSessionId && payload['url_params[session_id]']) {
    gaSessionId = payload['url_params[session_id]'];
  }
  
  // 4. 从 variants 中提取（如果 Gumroad 以这种方式发送）
  if (!userId && payload['variants[user_id]']) {
    userId = payload['variants[user_id]'];
  }
  // 检查 variants 中是否包含 client_id 或 session_id
  if (!gaClientId && payload['variants[client_id]']) {
    gaClientId = payload['variants[client_id]'];
  }
  if (!gaSessionId && payload['variants[session_id]']) {
    gaSessionId = payload['variants[session_id]'];
  }

  // 确保必要的字段存在
  if (!userId) {
    console.error('No user ID found in payload', payload)
    return
  }

  console.log('Processing subscription for user:', userId)
  console.log('GA4 Client ID:', gaClientId);
  console.log('GA4 Session ID:', gaSessionId);

  // 计算当前周期结束日期（对于按月订阅）
  let currentPeriodEnd = null;
  if (payload.product_name === 'hpyhn_free_trail' && payload.sale_timestamp) {
    const saleDate = new Date(payload.sale_timestamp);
    currentPeriodEnd = new Date(saleDate.setDate(saleDate.getDate() + 14));
  } else if (payload.recurrence === 'monthly' && payload.sale_timestamp) {
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
  } else {
    // Send GA4 purchase event after successful upsert
    await sendGa4Event(userId, 'purchaseSuccess', {
      currency: payload.currency,
      value: parseFloat(payload.price) / 100, // Gumroad price is in cents
      transaction_id: payload.sale_id || payload.order_number,
      product_name: payload.product_name,
      status: payload.refunded === 'true' ? 'refunded' : 'active',
      start_time: new Date().toISOString()
    }, gaClientId, gaSessionId); // Pass client_id and session_id here
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