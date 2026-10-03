'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { PasswordInput } from '@/components/PasswordInput'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type ExtensionRuntime = {
	sendMessage: (
		extensionId: string,
		message: unknown,
		callback: (response?: { ok?: boolean }) => void
	) => void
	lastError?: { message?: string }
}

type ChromeWindow = Window & { chrome?: { runtime?: ExtensionRuntime } }

function sendSessionToExtension(session: {
	access_token: string
	refresh_token: string
	expires_at: number
	user: { id: string; email?: string }
}) {
	const extensionId = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
	const runtime = (window as ChromeWindow).chrome?.runtime
	if (!extensionId || !runtime?.sendMessage) return Promise.resolve(false)

	return new Promise<boolean>((resolve) => {
		runtime.sendMessage(
			extensionId,
			{ source: 'audit-to-pitch-auth', type: 'session', session },
			(response) => resolve(!runtime.lastError && response?.ok === true)
		)
	})
}

export function LoginForm() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)

		try {
			const supabase = createSupabaseBrowserClient()
			const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

			if (signInError) {
				setError('Email or password is incorrect. Check your details and try again.')
				return
			}
			if (!data.session) {
				setError('Your session could not be started. Please try again.')
				return
			}

			if (new URLSearchParams(window.location.search).get('source') === 'extension') {
				const delivered = await sendSessionToExtension({
					access_token: data.session.access_token,
					refresh_token: data.session.refresh_token,
					expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000) + data.session.expires_in,
					user: { id: data.session.user.id, email: data.session.user.email },
				})

				if (!delivered) {
					setError('The extension could not be reached. Check its ID and reload it before signing in again.')
					return
				}
			}

			const requestedPath = new URLSearchParams(window.location.search).get('next')
			const nextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
				? requestedPath
				: '/dashboard'
			router.replace(nextPath)
			router.refresh()
		} catch {
			setError('Sign-in is unavailable right now. Please try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<main className="flex min-h-screen flex-1 items-center justify-center px-5 py-12">
			<div className="w-full max-w-[420px]">
				<Link href="/" className="inline-flex rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand" aria-label="AuditToPitch Pro home">
					<Image src="/brand-wordmark.png" alt="AuditToPitch Pro" width={180} height={36} className="h-auto w-[180px]" priority />
				</Link>

				<section className="mt-10 rounded-lg border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
					<p className="text-xs font-semibold uppercase text-brand-light">Agency workspace</p>
					<h1 className="mt-3 text-3xl font-bold text-ink">Welcome back</h1>
					<p className="mt-2 text-sm leading-relaxed text-muted">Sign in to continue to your audits and pitch scripts.</p>

					<form className="mt-7 space-y-5" onSubmit={handleSubmit}>
						<div>
							<label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">Email</label>
							<input
								id="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								className="h-11 w-full rounded-md border border-line bg-[#030806] px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
								placeholder="you@agency.com"
							/>
						</div>

						<div>
							<div className="mb-2 flex items-center justify-between">
								<label htmlFor="password" className="block text-sm font-medium text-ink">Password</label>
								<Link href="/forgot-password" className="text-sm font-semibold text-brand-light hover:text-ink">Forgot password?</Link>
							</div>
							<PasswordInput
								id="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								className="h-11 w-full rounded-md border border-line bg-[#030806] px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
								placeholder="Enter your password"
							/>
						</div>

						{error && <p className="text-sm text-alert" role="alert">{error}</p>}

						<button
							type="submit"
							disabled={isSubmitting}
							className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-[#03120a] transition hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-60"
						>
							{isSubmitting ? 'Signing in...' : 'Sign In'}
							<ArrowRight className="h-4 w-4" />
						</button>
					</form>
				</section>

				<p className="mt-6 text-center text-sm text-muted">
					New to AuditToPitch?{' '}
					<Link href="/signup" className="font-semibold text-brand-light hover:text-ink">Create an account</Link>
				</p>
			</div>
		</main>
	)
}