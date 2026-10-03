import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_PAGES = ['/', '/login', '/signup']

function redirectTo(request: NextRequest, pathname: string, from: NextResponse) {
	const url = request.nextUrl.clone()
	url.pathname = pathname
	url.search = ''
	const response = NextResponse.redirect(url)
	// Carry over any refreshed session cookies.
	from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
	return response
}

export async function middleware(request: NextRequest) {
	let response = NextResponse.next({ request })

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll: () => request.cookies.getAll(),
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
					response = NextResponse.next({ request })
					cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
				},
			},
		}
	)

	const { data: { user } } = await supabase.auth.getUser()
	const { pathname, searchParams } = request.nextUrl

	if (!user && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
		return redirectTo(request, '/login', response)
	}

	// The extension sign-in flow must stay on /login to hand its session to the extension.
	const isExtensionLogin = pathname === '/login' && searchParams.get('source') === 'extension'
	if (user && AUTH_PAGES.includes(pathname) && !isExtensionLogin) {
		return redirectTo(request, '/dashboard', response)
	}

	return response
}

export const config = {
	matcher: ['/', '/login', '/signup', '/dashboard/:path*'],
}
