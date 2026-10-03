'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const FREE_FEATURES = [
	'3 Full Website Audits',
	'Chrome Extension Access',
	'Basic AI Scripting',
]

const PRO_FEATURES = [
	'Unlimited Website Audits',
	'Full AI Pitch Script Generator',
	'PDF Executive Summary Export',
	'Priority Support',
	'Chrome Extension Access',
]

export function Pricing() {
	const router = useRouter()
	const [isRedirecting, setIsRedirecting] = useState(false)
	const [checkoutError, setCheckoutError] = useState('')

	async function handleUpgrade() {
		setIsRedirecting(true)
		setCheckoutError('')
		try {
			const supabase = createSupabaseBrowserClient()
			const { data: { session }, error: sessionError } = await supabase.auth.getSession()

			if (sessionError) throw sessionError
			if (!session) {
				router.push('/login?next=%2F%23pricing')
				return
			}

			const response = await fetch('/api/checkout', {
				method: 'POST',
				headers: { Authorization: `Bearer ${session.access_token}` },
			})
			const data = (await response.json()) as { url?: string; error?: string }

			if (!response.ok || !data.url) {
				throw new Error(data.error ?? 'Failed to start checkout')
			}

			window.location.href = data.url
		} catch (error) {
			console.error(error)
			setCheckoutError('Could not start checkout. Please try again.')
			setIsRedirecting(false)
		}
	}

	return (
		<section id="pricing" className="border-t border-line bg-surface/50 py-20">
			<div className="mx-auto max-w-5xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-bold text-ink sm:text-4xl">
						Simple, agency-friendly pricing
					</h2>
					<p className="mt-4 text-lg text-muted">
						Start free. Upgrade when you&apos;re ready to pitch at scale.
					</p>
					{checkoutError && <p className="mt-4 text-sm text-alert" role="alert">{checkoutError}</p>}
				</div>

				<div className="mt-14 grid gap-8 sm:grid-cols-2">
					{/* Free Trial */}
					<div className="rounded-lg border border-line bg-surface p-8">
						<h3 className="text-lg font-semibold text-ink">Free Trial</h3>
						<p className="mt-2">
							<span className="text-4xl font-bold text-ink">$0</span>
							<span className="text-sm text-muted">/mo</span>
						</p>

						<ul className="mt-6 space-y-3">
							{FREE_FEATURES.map((feature) => (
								<li key={feature} className="flex items-start gap-2 text-sm text-muted">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
									{feature}
								</li>
							))}
						</ul>

						<a
							href="/signup"
							className="mt-8 block rounded-full border border-line px-6 py-3 text-center text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-light"
						>
							Start Free Trial
						</a>
					</div>

					{/* Pro Agency */}
					<div className="relative rounded-lg border border-brand/60 bg-surface-raised p-8 shadow-[0_0_34px_rgba(0,245,160,0.09)]">
						<span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full border border-brand/30 bg-[#082217] px-3 py-1 text-xs font-semibold text-brand-light">
							<Sparkles className="h-3.5 w-3.5" />
							Most Popular
						</span>

						<h3 className="text-lg font-semibold text-ink">AuditToPitch Pro</h3>
						<p className="mt-2">
							<span className="text-4xl font-bold text-ink">$39</span>
							<span className="text-sm text-muted">/mo</span>
						</p>
						<p className="mt-1 text-xs font-medium text-brand-light">
							Launch Offer: $29/mo for first 50 agency accounts
						</p>

						<ul className="mt-6 space-y-3">
							{PRO_FEATURES.map((feature) => (
								<li key={feature} className="flex items-start gap-2 text-sm text-muted">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
									{feature}
								</li>
							))}
						</ul>

						<button
							type="button"
							onClick={handleUpgrade}
							disabled={isRedirecting}
							className="mt-8 block w-full rounded-full bg-brand px-6 py-3 text-center text-sm font-bold text-[#03120a] shadow-[0_0_22px_rgba(0,245,160,0.17)] transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isRedirecting ? 'Redirecting…' : 'Upgrade to Pro ($39/mo)'}
						</button>
					</div>
				</div>
			</div>
		</section>
	)
}
