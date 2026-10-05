import { NextRequest, NextResponse } from 'next/server'
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
		const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
			method: 'POST',
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/vnd.api+json',
				Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
			},
			body: JSON.stringify({
				data: {
					type: 'checkouts',
					attributes: {
						checkout_data: { email: user.email, custom: { user_id: user.id } },
						product_options: { redirect_url: `${origin}/success` },
					},
					relationships: {
						store: { data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID } },
						variant: { data: { type: 'variants', id: process.env.LEMONSQUEEZY_VARIANT_ID } },
					},
				},
			}),
		})

		if (!response.ok) {
			return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502, headers })
		}

		const checkout = (await response.json()) as { data?: { attributes?: { url?: string } } }
		const url = checkout.data?.attributes?.url

		if (!url) {
			return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502, headers })
		}

		return NextResponse.json({ url }, { status: 200, headers })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500, headers })
	}
}
