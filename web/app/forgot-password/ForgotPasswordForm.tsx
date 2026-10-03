'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MailCheck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function ForgotPasswordForm() {
	const [email, setEmail] = useState('')
	const [error, setError] = useState('')
	const [sentTo, setSentTo] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)

		try {
			const supabase = createSupabaseBrowserClient()
			const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: new URL('/reset-password', window.location.origin).toString(),
			})

			if (resetError) {
				setError(resetError.message)
				return
			}
			setSentTo(email)
		} catch {
			setError('Password reset is unavailable right now. Please try again.')
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
					{sentTo ? (
						<div className="py-3 text-center" aria-live="polite">
							<MailCheck className="mx-auto h-8 w-8 text-brand-light" />
							<h1 className="mt-4 text-2xl font-bold text-ink">Check your email</h1>
							<p className="mt-3 text-sm leading-relaxed text-muted">
								If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we sent a link to reset your password.
							</p>
						</div>
					) : (
						<>
							<p className="text-xs font-semibold uppercase text-brand-light">Account recovery</p>
							<h1 className="mt-3 text-3xl font-bold text-ink">Forgot password?</h1>
							<p className="mt-2 text-sm leading-relaxed text-muted">Enter your email and we&apos;ll send you a link to reset your password.</p>

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

								{error && <p className="text-sm text-alert" role="alert">{error}</p>}

								<button
									type="submit"
									disabled={isSubmitting}
									className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-[#03120a] transition hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-60"
								>
									{isSubmitting ? 'Sending...' : 'Send reset link'}
									<ArrowRight className="h-4 w-4" />
								</button>
							</form>
						</>
					)}
				</section>

				<p className="mt-6 text-center text-sm text-muted">
					Remembered it?{' '}
					<Link href="/login" className="font-semibold text-brand-light hover:text-ink">Sign in</Link>
				</p>
			</div>
		</main>
	)
}
