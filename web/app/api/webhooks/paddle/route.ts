import { Environment, Paddle } from '@paddle/paddle-node-sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function handlePaddleWebhook(req: Request) {
	const signature = req.headers.get('paddle-signature')
	if (!signature) {
		return NextResponse.json({ error: 'Missing paddle-signature header' }, { status: 400 })
	}

	const apiKey = process.env.PADDLE_API_KEY
	const webhookSecret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!apiKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
		console.error('Paddle webhook configuration is incomplete')
		return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
	}

	const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
		? Environment.production
		: Environment.sandbox
	const paddle = new Paddle(apiKey, { environment })
	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	})

	const rawBody = await req.text()
	let event
	try {
		event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature)
	} catch (error) {
		console.error('Paddle webhook signature verification failed:', error)
		return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
	}

	const eventType = event.eventType
	if (
		eventType !== 'subscription.created' &&
		eventType !== 'subscription.updated' &&
		eventType !== 'subscription.canceled' &&
		eventType !== 'subscription.past_due'
	) {
		return NextResponse.json({ success: true }, { status: 200 })
	}

	const data = event.data
	const userId = data.customData?.userId
	if (typeof userId !== 'string' || !userId) {
		console.error(`Paddle ${eventType} webhook is missing customData.userId`)
		return NextResponse.json({ error: 'Missing user ID in subscription custom data' }, { status: 400 })
	}

	const isActiveEvent = eventType === 'subscription.created' || eventType === 'subscription.updated'
	const isSubscribed = isActiveEvent && (data.status === 'active' || data.status === 'trialing')
	const profileUpdate = isActiveEvent
		? {
				is_subscribed: isSubscribed,
				paddle_subscription_id: data.id,
				paddle_customer_id: data.customerId,
			}
		: { is_subscribed: false }

	const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', userId)
	if (error) {
		console.error('Supabase error processing Paddle webhook:', error)
		return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
	}

	return NextResponse.json({ success: true }, { status: 200 })
}

export async function POST(req: Request) {
	try {
		return await handlePaddleWebhook(req)
	} catch (error) {
		console.error('Paddle webhook handler failed:', error)
		return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
	}
}
