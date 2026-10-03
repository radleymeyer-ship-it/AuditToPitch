import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseSessionClient } from '@/lib/supabase/session'

export async function GET(request: NextRequest) {
	const { origin, searchParams } = request.nextUrl
	const code = searchParams.get('code')

	if (code) {
		const supabase = await createSupabaseSessionClient()
		const { error } = await supabase.auth.exchangeCodeForSession(code)
		if (!error) return NextResponse.redirect(new URL('/dashboard', origin))
	}

	return NextResponse.redirect(new URL('/login', origin))
}
