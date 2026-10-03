'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { PasswordInput } from '@/components/PasswordInput'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function ResetPasswordForm() {
	const router = useRouter()
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
	const [linkError, setLinkError] = useState('')

	useEffect(() => {
		const supabase = createSupabaseBrowserClient()
		let isMounted = true
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			if (session && isMounted) setStatus('ready')
		})

		async function verify() {
			const query = new URLSearchParams(window.location.search)
			const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
			const urlError = query.get('error_description') ?? hash.get('error_description')
			const code = query.get('code')

			let reason = urlError ?? ''
			if (!urlError && code) {
				const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
				if (exchangeError) reason = exchangeError.message
			}

			// The client may already have consumed the code itself, so trust the session over the exchange result.
			const { data } = await supabase.auth.getSession()
			if (!isMounted) return
			if (data.session) {
				setStatus('ready')
			} else {
				setLinkError(reason || 'Open the link in the same browser where you requested it.')
				setStatus('invalid')
			}
		}

		void verify()

		return () => {
			isMounted = false
			subscription.unsubscribe()
		}
	}, [])

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)

		try {
			const supabase = createSupabaseBrowserClient()
			const { error: updateError } = await supabase.auth.updateUser({ password })
			if (updateError) {
				setError(updateError.message)
				return
			}
			router.replace('/dashboard')
			router.refresh()
		} catch {
			setError('Password update is unavailable right now. Please try again.')
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
					{status === 'checking' ? (
						<p className="py-4 text-center text-sm text-muted" aria-live="polite">Verifying your reset link...</p>
					) : status === 'invalid' ? (
						<div className="py-3 text-center" aria-live="polite">
							<h1 className="text-2xl font-bold text-ink">Link expired</h1>
							<p className="mt-3 text-sm leading-relaxed text-muted">This reset link is invalid or has expired. Request a new one.</p>
							{linkError && <p className="mt-2 text-xs text-muted">{linkError}</p>}
							<Link href="/forgot-password" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-ink">
								Request new link <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					) : (
						<>
							<p className="text-xs font-semibold uppercase text-brand-light">Account recovery</p>
							<h1 className="mt-3 text-3xl font-bold text-ink">Set a new password</h1>

							<form className="mt-7 space-y-5" onSubmit={handleSubmit}>
								<div>
									<label htmlFor="password" className="mb-2 block text-sm font-medium text-ink">New password</label>
									<PasswordInput
										id="password"
										autoComplete="new-password"
										minLength={8}
										required
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										className="h-11 w-full rounded-md border border-line bg-[#030806] px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
										placeholder="At least 8 characters"
									/>
								</div>

								{error && <p className="text-sm text-alert" role="alert">{error}</p>}

								<button
									type="submit"
									disabled={isSubmitting}
									className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-[#03120a] transition hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-60"
								>
									{isSubmitting ? 'Updating...' : 'Update password'}
									<ArrowRight className="h-4 w-4" />
								</button>
							</form>
						</>
					)}
				</section>
			</div>
		</main>
	)
}
