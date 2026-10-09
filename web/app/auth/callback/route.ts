import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseSessionClient } from '@/lib/supabase/session'

// Only allow same-site paths so the callback can't be used as an open redirect.
function safeNextPath(value: string | null) {
	return value?.startsWith('/') && !value.startsWith('//') ? value : '/pricing'
}

export async function GET(request: NextRequest) {
	const { origin, searchParams } = request.nextUrl
	const tokenHash = searchParams.get('token_hash')
	const type = searchParams.get('type') as EmailOtpType | null
	const code = searchParams.get('code')
	const next = safeNextPath(searchParams.get('next'))

	const supabase = await createSupabaseSessionClient()

	if (tokenHash && type) {
		const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
		if (!error) return NextResponse.redirect(`${origin}${next}`)
	}

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code)
		if (!error) return NextResponse.redirect(`${origin}${next}`)
	}

	return NextResponse.redirect(`${origin}/login?error=Invalid%20or%20expired%20link`)
}
