import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

type LemonSqueezyEvent = {
	meta?: { event_name?: string; custom_data?: { user_id?: unknown } }
	data?: { attributes?: { status?: string; user_email?: string } }
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

const USERS_PER_PAGE = 1000

async function findUserIdByEmail(supabase: ServiceClient, email: string) {
	const target = email.trim().toLowerCase()
	for (let page = 1; ; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
		if (error) throw error
		const match = data.users.find((user) => user.email?.toLowerCase() === target)
		if (match) return match.id
		if (data.users.length < USERS_PER_PAGE) return null
	}
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
		console.info(`Lemon Squeezy webhook ignored: ${eventName ?? 'unknown event'}`)
		return NextResponse.json({ received: true }, { status: 200 })
	}

	const supabase = createSupabaseServiceClient()
	const customUserId = event.meta?.custom_data?.user_id
	const email = event.data?.attributes?.user_email
	let userId = typeof customUserId === 'string' && customUserId ? customUserId : null

	try {
		if (!userId && email) userId = await findUserIdByEmail(supabase, email)
	} catch {
		return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
	}

	if (!userId) {
		return NextResponse.json({ error: 'No user ID in custom data and no matching email' }, { status: 400 })
	}

	const status = event.data?.attributes?.status
	const isSubscribed =
		eventName === 'subscription_expired' ? false : status ? ACTIVE_STATUSES.has(status) : null
	if (isSubscribed === null) {
		return NextResponse.json({ received: true }, { status: 200 })
	}

	// Upsert so a user without a profile row still gets upgraded.
	const { error } = await supabase
		.from('profiles')
		.upsert({ id: userId, is_subscribed: isSubscribed }, { onConflict: 'id' })

	if (error) {
		return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
	}

	return NextResponse.json({ received: true }, { status: 200 })
}
