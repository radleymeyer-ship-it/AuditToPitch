import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import CheckoutButton from '@/components/CheckoutButton'
import { createSupabaseSessionClient } from '@/lib/supabase/session'

export const metadata: Metadata = {
	title: 'Upgrade to Pro | AuditToPitch Pro',
	description: 'Upgrade your AuditToPitch account to Pro.',
}

export default async function PricingPage() {
	const supabase = await createSupabaseSessionClient()
	const { data: { user } } = await supabase.auth.getUser()

	if (!user) redirect('/login?next=%2Fpricing')

	return (
		<main className="flex min-h-screen items-center justify-center px-4 py-12">
			<section className="w-full max-w-xl">
				<Link
					href="/dashboard"
					className="text-sm font-medium text-muted transition hover:text-brand-light"
				>
					Back to dashboard
				</Link>
				<div className="mt-8 border-y border-line py-8 sm:py-10">
					<p className="text-xs font-semibold uppercase text-brand-light">AuditToPitch Pro</p>
					<h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">Upgrade your workspace</h1>
					<p className="mt-3 max-w-lg text-sm leading-6 text-muted">
						Get full access to automated website audits and AI-generated pitch scripts for your agency outreach.
					</p>
					<div className="mt-7">
						<CheckoutButton userId={user.id} userEmail={user.email} />
					</div>
				</div>
			</section>
		</main>
	)
}
