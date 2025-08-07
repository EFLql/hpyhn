import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { userId, email } = await request.json()
    
    // Replace with your Gumroad product ID
    const productId = process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_ID
    
    // Create checkout URL
    const checkoutUrl = `https://gum.co/${productId}?wanted=true&email=${encodeURIComponent(email)}&custom_fields[user_id]=${userId}`
    
    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error('Create subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 400 }
    )
  }
}