import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PER_PAGE = 1000

export async function POST(request: Request) {
	const body = await request.json().catch(() => null)
	const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
	if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

	const supabase = createSupabaseServiceClient()

	for (let page = 1; ; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE })
		if (error) return NextResponse.json({ error: 'Unable to check email.' }, { status: 500 })
		if (data.users.some((user) => user.email?.toLowerCase() === email)) {
			return NextResponse.json({ exists: true })
		}
		if (data.users.length < PER_PAGE) return NextResponse.json({ exists: false })
	}
}
