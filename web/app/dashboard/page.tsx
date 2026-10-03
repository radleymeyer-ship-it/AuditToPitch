import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { UpgradeButton } from '@/components/dashboard/UpgradeButton'
import { FREE_AUDIT_LIMIT, getAuditUsage } from '@/lib/audit-quota'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { createSupabaseSessionClient } from '@/lib/supabase/session'
import styles from './dashboard.module.css'

const poppins = Poppins({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700', '800'],
	variable: '--font-poppins',
})

export const metadata: Metadata = {
	title: 'Dashboard | AuditToPitch Pro',
}

export const dynamic = 'force-dynamic'

const EXTENSION_ID = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL
	?? (EXTENSION_ID ? `https://chromewebstore.google.com/detail/${EXTENSION_ID}` : '#')

type Donut = CSSProperties & { '--p': number; '--c'?: string }

function scoreColor(score: number) {
	if (score >= 80) return 'var(--green-d)'
	if (score >= 60) return 'var(--amber)'
	return 'var(--red)'
}

function extractHook(script: string | null) {
	if (!script) return ''
	const match = script.match(/\[Hook\]\s*([\s\S]*?)(?:\n\s*\[|$)/i)
	return (match?.[1] ?? script).trim()
}

function hostLabel(url: string) {
	try {
		const { host, pathname } = new URL(url)
		return `${host.replace(/^www\./, '')}${pathname === '/' ? '' : pathname}`
	} catch {
		return url
	}
}

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
	const usedPercent = Math.min(100, (usage.used / FREE_AUDIT_LIMIT) * 100)
	const usageStyle: Donut = {
		'--p': isPro ? 100 : usedPercent,
		'--c': isPro ? 'var(--green-d)' : usedPercent >= 100 ? 'var(--red)' : 'var(--amber)',
	}

	return (
		<div className={`${styles.page} ${poppins.variable}`}>
			<div className={styles.wrap}>
				<DashboardHeader email={user.email ?? ''} isPro={isPro} />

				<section className={styles.hero}>
					<h1>
						Their site is leaking leads.<br />
						<span className={styles.hl}>Audit any site in 10 sec.</span>
					</h1>
					<div className={styles.timer} aria-hidden="true"><s>90 min</s>00:10</div>
					<p className={styles.sub}>Open a prospect&apos;s site, run the audit, and walk away with a PDF and a Loom script.</p>
				</section>

				<main className={styles.grid}>
					<section className={`${styles.card} ${styles.dark} ${styles.ext}`}>
						<div>
							<h2>Connect the Chrome extension</h2>
							<p style={{ marginTop: 8 }}>Install it, sign in, and audit any prospect&apos;s site in one click.</p>
							<a className={styles.btn} href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
								Download / Connect Chrome extension
							</a>
						</div>
						<div className={styles.browser} aria-hidden="true">
							<div className={styles.dots}><i /><i /><i /><span>prospect-website.com</span></div>
							<div className={styles.bar} />
							<div className={`${styles.bar} ${styles.barShort}`} />
							<div className={styles.scan} />
							<span className={`${styles.chip} ${styles.c1}`}>No GA4 or Meta Pixel</span>
							<span className={`${styles.chip} ${styles.chipAmber} ${styles.c3}`}>Page speed 38/100</span>
							<span className={`${styles.chip} ${styles.c2}`}>No meta description</span>
						</div>
					</section>

					<section className={`${styles.card} ${styles.light} ${styles.usage}`}>
						<div
							className={styles.donut}
							data-n={isPro ? String(usage.used) : `${Math.min(usage.used, FREE_AUDIT_LIMIT)}/${FREE_AUDIT_LIMIT}`}
							style={usageStyle}
						/>
						<div>
							<h2>Audits used</h2>
							<p>
								{isPro
									? 'Unlimited audits on your plan.'
									: `${usage.remaining} free audit${usage.remaining === 1 ? '' : 's'} remaining.`}
							</p>
							<span className={styles.tag}>{isPro ? 'Pro' : 'Free beta'}</span>
						</div>
					</section>

					<section className={styles.plan}>
						<div>
							<h2>Unlimited audits.<br />Zero waiting.</h2>
							<p>{isPro ? 'You\u2019re on Pro. Keep pitching.' : 'Upgrade from the free beta to keep pitching.'}</p>
						</div>
						{!isPro && <UpgradeButton />}
					</section>

					<section className={`${styles.card} ${styles.light} ${styles.col}`}>
						<h2>Recent audits</h2>
						{recentAudits.length === 0 ? (
							<p className={styles.empty}>No audits yet. Run your first one from the Chrome extension.</p>
						) : (
							recentAudits.map((audit) => {
								const score = Math.round(Number(audit.overall_score) || 0)
								const donutStyle: Donut = { '--p': score, '--c': scoreColor(score) }
								return (
									<div className={styles.row} key={audit.id}>
										<div className={`${styles.donut} ${styles.sm}`} data-n={score} style={donutStyle} />
										<div>
											<b>{hostLabel(audit.url)}</b>
											<p>{audit.quick_summary}</p>
										</div>
									</div>
								)
							})
						)}
					</section>

					<section className={`${styles.card} ${styles.dark} ${styles.col}`}>
						<h2>▶ AI pitch scripts</h2>
						{recentAudits.length === 0 ? (
							<p className={styles.empty}>Generated pitch scripts will appear here.</p>
						) : (
							recentAudits.map((audit) => (
								<div className={styles.q} key={audit.id}>
									<b>{hostLabel(audit.url)}</b>
									<span className={styles.hook}>Hook</span>
									<p>&ldquo;{extractHook(audit.video_script)}&rdquo;</p>
								</div>
							))
						)}
					</section>
				</main>
			</div>
		</div>
	)
}
