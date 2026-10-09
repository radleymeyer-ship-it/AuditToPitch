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

		// Paddle's overlay checkout runs on the /pricing page, which needs the signed-in web session.
		const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/+$/, '')
		return NextResponse.json({ url: `${origin}/pricing` }, { status: 200, headers })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500, headers })
	}
}
