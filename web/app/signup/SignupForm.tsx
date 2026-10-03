'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, MailCheck } from 'lucide-react'
import { PasswordInput } from '@/components/PasswordInput'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function SignupForm() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [confirmationEmail, setConfirmationEmail] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isCheckingSession, setIsCheckingSession] = useState(true)
	const [signedInEmail, setSignedInEmail] = useState<string | null>(null)

	useEffect(() => {
		const supabase = createSupabaseBrowserClient()
		let isMounted = true
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			setSignedInEmail(session?.user.email ?? null)
			setIsCheckingSession(false)
		})

		void supabase.auth.getSession().then(({ data, error: sessionError }) => {
			if (!isMounted) return
			setSignedInEmail(sessionError ? null : data.session?.user.email ?? null)
			setIsCheckingSession(false)
		})

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
			const checkResponse = await fetch('/api/auth/email-exists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			})
			if (checkResponse.ok && (await checkResponse.json()).exists) {
				setError('Email already exists. Try signing in instead.')
				return
			}

			const supabase = createSupabaseBrowserClient()
			const { data, error: signUpError } = await supabase.auth.signUp({
				email,
				password,
				options: { emailRedirectTo: new URL('/login', window.location.origin).toString() },
			})

			if (signUpError) {
				const alreadyExists = signUpError.code === 'user_already_exists' || /already (registered|exists)/i.test(signUpError.message)
				setError(alreadyExists ? 'Email already exists. Try signing in instead.' : signUpError.message)
				return
			}

			// Supabase obfuscates duplicates by returning a user with no identities.
			if (data.user && data.user.identities?.length === 0) {
				setError('Email already exists. Try signing in instead.')
				return
			}

			if (!data.session) {
				setConfirmationEmail(email)
				return
			}

			router.replace('/#pricing')
			router.refresh()
		} catch {
			setError('Account creation is unavailable right now. Please try again.')
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
					{isCheckingSession ? (
						<div className="py-4 text-center" aria-live="polite" aria-busy="true">
							<p className="text-sm text-muted">Checking your account...</p>
						</div>
					) : signedInEmail ? (
						<div className="py-3 text-center" aria-live="polite">
							<p className="text-xs font-semibold uppercase text-brand-light">Account already connected</p>
							<h1 className="mt-4 text-2xl font-bold text-ink">You&apos;re signed in</h1>
							<p className="mt-3 text-sm leading-relaxed text-muted">
								This account is already signed in as <span className="font-medium text-ink">{signedInEmail}</span>.
								You don&apos;t need to create or sign in to another account to start your free audits.
							</p>
							<Link href="/" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-[#03120a] transition hover:bg-brand-light">
								Continue to AuditToPitch <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					) : confirmationEmail ? (
						<div className="py-3 text-center" aria-live="polite">
							<MailCheck className="mx-auto h-8 w-8 text-brand-light" />
							<h1 className="mt-4 text-2xl font-bold text-ink">Check your email</h1>
							<p className="mt-3 text-sm leading-relaxed text-muted">
								We sent a confirmation link to <span className="font-medium text-ink">{confirmationEmail}</span>.
								Open it to finish creating your account.
							</p>
							<Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-ink">
								Continue to sign in <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
					) : (
						<>
							<p className="text-xs font-semibold uppercase text-brand-light">Start with 3 free audits</p>
							<h1 className="mt-3 text-3xl font-bold text-ink">Create your account</h1>
							<p className="mt-2 text-sm leading-relaxed text-muted">No card required. Set up your workspace to start auditing prospects.</p>

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
									<label htmlFor="password" className="mb-2 block text-sm font-medium text-ink">Password</label>
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
									{isSubmitting ? 'Creating account...' : 'Create free account'}
									<ArrowRight className="h-4 w-4" />
								</button>
							</form>
						</>
					)}
				</section>

				<p className="mt-6 text-center text-sm text-muted">
					Already have an account?{' '}
					<Link href="/login" className="font-semibold text-brand-light hover:text-ink">Sign in</Link>
				</p>
			</div>
		</main>
	)
}