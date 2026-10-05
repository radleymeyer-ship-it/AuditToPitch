import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

type LemonSqueezyEvent = {
	meta?: { event_name?: string; custom_data?: { user_id?: unknown } }
	data?: { attributes?: { status?: string } }
}

// A cancelled subscription keeps access until it expires.
const ACTIVE_STATUSES = new Set(['active', 'on_trial', 'cancelled'])

function hasValidSignature(rawBody: string, signature: string, secret: string) {
	const expected = createHmac('sha256', secret).update(rawBody).digest()
	const received = Buffer.from(signature, 'hex')
	return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function POST(request: NextRequest) {
	const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
	if (!secret) {
		return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 })
	}

	const signature = request.headers.get('x-signature')
	if (!signature) {
		return NextResponse.json({ error: 'Missing x-signature header' }, { status: 400 })
	}

	const rawBody = await request.text()
	if (!hasValidSignature(rawBody, signature, secret)) {
		return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
	}

	let event: LemonSqueezyEvent
	try {
		event = JSON.parse(rawBody) as LemonSqueezyEvent
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	const eventName = event.meta?.event_name
	if (!eventName?.startsWith('subscription_')) {
		return NextResponse.json({ received: true }, { status: 200 })
	}

	const userId = event.meta?.custom_data?.user_id
	if (typeof userId !== 'string' || !userId) {
		return NextResponse.json({ error: 'Missing user ID in custom data' }, { status: 400 })
	}

	const status = event.data?.attributes?.status
	const isSubscribed =
		eventName === 'subscription_expired' ? false : status ? ACTIVE_STATUSES.has(status) : null
	if (isSubscribed === null) {
		return NextResponse.json({ received: true }, { status: 200 })
	}

	const { error } = await createSupabaseServiceClient()
		.from('profiles')
		.update({ is_subscribed: isSubscribed })
		.eq('id', userId)

	if (error) {
		return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
	}

	return NextResponse.json({ received: true }, { status: 200 })
}
