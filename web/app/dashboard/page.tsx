import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Download, FileText, History } from 'lucide-react'
import { AccountNav } from '@/components/landing/AccountNav'
import { UpgradeButton } from '@/components/dashboard/UpgradeButton'
import { FREE_AUDIT_LIMIT, getAuditUsage } from '@/lib/audit-quota'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { createSupabaseSessionClient } from '@/lib/supabase/session'

export const metadata: Metadata = {
	title: 'Dashboard | AuditToPitch Pro',
}

export const dynamic = 'force-dynamic'

const EXTENSION_ID = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL
	?? (EXTENSION_ID ? `https://chromewebstore.google.com/detail/${EXTENSION_ID}` : '#')

export default async function DashboardPage() {
	const session = await createSupabaseSessionClient()
	const { data: { user } } = await session.auth.getUser()
	if (!user) redirect('/login')

	const admin = createSupabaseServiceClient()
	const [{ data: profile }, usage, { data: audits }] = await Promise.all([
		admin.from('profiles').select('is_subscribed').eq('id', user.id).maybeSingle(),
		getAuditUsage(admin, user.id),
		admin
			.from('audits')
			.select('id, url, overall_score, quick_summary, video_script, created_at')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(5),
	])

	const isPro = profile?.is_subscribed === true
	const recentAudits = audits ?? []

	return (
		<main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
			<header className="flex items-center justify-between">
				<Image src="/brand-wordmark.png" alt="AuditToPitch Pro" width={180} height={36} className="h-auto w-[180px]" priority />
				<AccountNav />
			</header>

			<section className="mt-12">
				<p className="text-xs font-semibold uppercase text-brand-light">Dashboard</p>
				<h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">Welcome to AuditToPitch Pro</h1>
				<p className="mt-2 text-sm text-muted">Signed in as <span className="font-medium text-ink">{user.email}</span></p>
			</section>

			<section className="mt-8 flex flex-col gap-4 rounded-lg border border-brand/40 bg-surface/90 p-6 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-bold text-ink">Connect the Chrome extension</h2>
					<p className="mt-1 text-sm text-muted">Install it, sign in, and audit any prospect&apos;s site in one click.</p>
				</div>
				<a
					href={EXTENSION_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-[#03120a] transition hover:bg-brand-light"
				>
					<Download className="h-4 w-4" /> Download / Connect Chrome Extension
				</a>
			</section>

			<section className="mt-6 grid gap-4 sm:grid-cols-2">
				<div className="rounded-lg border border-line bg-surface/90 p-6">
					<p className="text-xs font-semibold uppercase text-muted">Subscription</p>
					<p className="mt-3 text-2xl font-bold text-ink">{isPro ? 'Pro' : 'Free Beta'}</p>
					<p className="mt-1 text-sm text-muted">{isPro ? 'Unlimited audits and pitch scripts.' : 'Upgrade for unlimited audits.'}</p>
					{!isPro && <div className="mt-4"><UpgradeButton /></div>}
				</div>

				<div className="rounded-lg border border-line bg-surface/90 p-6">
					<p className="text-xs font-semibold uppercase text-muted">Audit usage</p>
					<p className="mt-3 text-2xl font-bold text-ink">
						{isPro ? `${usage.used} audits` : `${usage.used} / ${FREE_AUDIT_LIMIT} used`}
					</p>
					<p className="mt-1 text-sm text-muted">
						{isPro ? 'No limit on your plan.' : `${usage.remaining} free audit${usage.remaining === 1 ? '' : 's'} remaining.`}
					</p>
					{!isPro && (
						<div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
							<div className="h-full bg-brand" style={{ width: `${Math.min(100, (usage.used / FREE_AUDIT_LIMIT) * 100)}%` }} />
						</div>
					)}
				</div>
			</section>

			<section className="mt-6 grid gap-4 lg:grid-cols-2">
				<div className="rounded-lg border border-line bg-surface/90 p-6">
					<h2 className="flex items-center gap-2 text-lg font-bold text-ink"><History className="h-4 w-4 text-brand-light" /> Recent audits</h2>
					{recentAudits.length === 0 ? (
						<p className="mt-4 text-sm text-muted">No audits yet. Run your first one from the Chrome extension.</p>
					) : (
						<ul className="mt-4 divide-y divide-line">
							{recentAudits.map((audit) => (
								<li key={audit.id} className="flex items-start justify-between gap-3 py-3">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium text-ink">{audit.url}</p>
										<p className="mt-1 line-clamp-2 text-xs text-muted">{audit.quick_summary}</p>
									</div>
									<span className="shrink-0 text-sm font-bold text-brand-light">{audit.overall_score}</span>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="rounded-lg border border-line bg-surface/90 p-6">
					<h2 className="flex items-center gap-2 text-lg font-bold text-ink"><FileText className="h-4 w-4 text-brand-light" /> AI pitch scripts</h2>
					{recentAudits.length === 0 ? (
						<p className="mt-4 text-sm text-muted">Generated pitch scripts will appear here.</p>
					) : (
						<ul className="mt-4 divide-y divide-line">
							{recentAudits.map((audit) => (
								<li key={audit.id} className="py-3">
									<p className="truncate text-sm font-medium text-ink">{audit.url}</p>
									<p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted">{audit.video_script}</p>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>
		</main>
	)
}
