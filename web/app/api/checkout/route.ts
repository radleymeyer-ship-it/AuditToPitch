import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { extensionCorsHeaders, extensionOptions } from '@/lib/extension-cors'

export function OPTIONS(request: NextRequest) {
	return extensionOptions(request, 'POST, OPTIONS')
}

export async function POST(request: NextRequest) {
	const headers = extensionCorsHeaders(request, 'POST, OPTIONS')
	const authHeader = request.headers.get('authorization')
	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

	if (!token) {
		return NextResponse.json({ error: 'Sign in before upgrading' }, { status: 401, headers })
	}

	try {
		const supabase = createSupabaseServiceClient()
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser(token)

		if (authError || !user) {
			return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401, headers })
		}

		const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/+$/, '')
		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
			client_reference_id: user.id,
			metadata: { userId: user.id },
			subscription_data: { metadata: { userId: user.id } },
			success_url: `${origin}/success`,
			cancel_url: `${origin}/?checkout=cancelled`,
		})

		if (!session.url) {
			return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502, headers })
		}

		return NextResponse.json({ url: session.url }, { status: 200, headers })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500, headers })
	}
}
