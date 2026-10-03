import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
	const signature = request.headers.get('stripe-signature')
	if (!signature) {
		return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
	}
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
	if (!webhookSecret) {
		return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 500 })
	}

	let event: Stripe.Event
	try {
		const rawBody = await request.text()
		event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session

				const customerId =
					typeof session.customer === 'string' ? session.customer : session.customer?.id
				const subscriptionId =
					typeof session.subscription === 'string'
						? session.subscription
						: session.subscription?.id ?? null
				const userId = session.client_reference_id ?? session.metadata?.userId

				if (!userId || !customerId) {
					return NextResponse.json(
						{ error: 'Missing user ID or customer on checkout session' },
						{ status: 400 }
					)
				}

				const supabase = createSupabaseServiceClient()
				const { error: updateError } = await supabase
					.from('profiles')
					.update({
						is_subscribed: true,
						stripe_customer_id: customerId,
						stripe_subscription_id: subscriptionId,
					})
					.eq('id', userId)

				if (updateError) {
					return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
				}
				break
			}

			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription
				const customerId =
					typeof subscription.customer === 'string'
						? subscription.customer
						: subscription.customer.id

				const supabase = createSupabaseServiceClient()
				const { error: updateError } = await supabase
					.from('profiles')
					.update({ is_subscribed: false })
					.eq('stripe_customer_id', customerId)

				if (updateError) {
					return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
				}
				break
			}

			default:
				break
		}

		return NextResponse.json({ received: true }, { status: 200 })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ error: `Webhook handler failed: ${message}` }, { status: 500 })
	}
}
