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

function missingColumn(error: { code?: string }) {
return error.code === 'PGRST204' || error.code === '42703'
}

export async function POST(request: NextRequest) {
try {
const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
if (!secret) {
console.error('LEMONSQUEEZY_WEBHOOK_SECRET is not set')
return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
console.error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set')
return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
}

const signature = request.headers.get('x-signature')
if (!signature) {
return NextResponse.json({ error: 'Missing x-signature header' }, { status: 400 })
}

const rawBody = await request.text()
if (!hasValidSignature(rawBody, signature, secret)) {
console.error('Lemon Squeezy webhook signature mismatch; check LEMONSQUEEZY_WEBHOOK_SECRET')
return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
}

let body: LemonSqueezyEvent
try {
body = JSON.parse(rawBody) as LemonSqueezyEvent
} catch {
return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
}

const eventName = body?.meta?.event_name
if (!eventName?.startsWith('subscription_')) {
console.info(`Lemon Squeezy webhook ignored: ${eventName ?? 'unknown event'}`)
return NextResponse.json({ received: true }, { status: 200 })
}

const supabase = createSupabaseServiceClient()
const customUserId = body?.meta?.custom_data?.user_id
const email = body?.data?.attributes?.user_email
let userId = typeof customUserId === 'string' && customUserId ? customUserId : null

if (!userId && email) userId = await findUserIdByEmail(supabase, email)

if (!userId) {
console.error(`Lemon Squeezy ${eventName}: no user_id in custom_data and no user matching email`)
return NextResponse.json({ error: 'No user ID in custom data and no matching email' }, { status: 400 })
}

const status = body?.data?.attributes?.status
const isSubscribed =
eventName === 'subscription_expired' ? false : status ? ACTIVE_STATUSES.has(status) : null
if (isSubscribed === null) {
return NextResponse.json({ received: true }, { status: 200 })
}

// Update first: an upsert's insert half fails on NOT NULL columns (23502) even when the row exists.
const fields = { is_subscribed: isSubscribed, updated_at: new Date().toISOString() }
let { data: updated, error } = await supabase.from('profiles').update(fields).eq('id', userId).select('id')
// Retry without updated_at when the profiles table has no such column.
if (error && missingColumn(error)) {
;({ data: updated, error } = await supabase
.from('profiles')
.update({ is_subscribed: isSubscribed })
.eq('id', userId)
.select('id'))
}
if (!error && !updated?.length) {
;({ error } = await supabase.from('profiles').insert({ id: userId, is_subscribed: isSubscribed }))
}

if (error) {
console.error('Supabase error:', error)
return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
}

return NextResponse.json({ received: true }, { status: 200 })
} catch (err) {
console.error('Lemon Squeezy webhook failed:', err)
return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
}
}