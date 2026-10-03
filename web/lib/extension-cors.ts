import { NextRequest, NextResponse } from 'next/server'

const CHROME_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/
const LOCAL_EXTENSION_PREVIEW_ORIGINS = new Set([
	'http://localhost:5173',
	'http://127.0.0.1:5173',
])

function isAllowedOrigin(origin: string | null): origin is string {
	if (!origin) return false

	const extensionId = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
	if (extensionId && origin === `chrome-extension://${extensionId}`) return true
	if (process.env.NODE_ENV !== 'production') {
		return CHROME_EXTENSION_ORIGIN.test(origin) || LOCAL_EXTENSION_PREVIEW_ORIGINS.has(origin)
	}

	return false
}

export function extensionCorsHeaders(request: NextRequest, methods: string) {
	const headers = new Headers({
		'Access-Control-Allow-Headers': 'Authorization, Content-Type',
		'Access-Control-Allow-Methods': methods,
		'Access-Control-Max-Age': '600',
		Vary: 'Origin',
	})
	const origin = request.headers.get('origin')

	if (isAllowedOrigin(origin)) headers.set('Access-Control-Allow-Origin', origin)
	return headers
}

export function extensionOptions(request: NextRequest, methods: string) {
	return new NextResponse(null, {
		status: 204,
		headers: extensionCorsHeaders(request, methods),
	})
}