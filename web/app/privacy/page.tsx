import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
	title: 'Privacy Policy | AuditToPitch Pro',
	description: 'Learn how AuditToPitch Pro collects, processes, and protects your information.',
}

const sections = [
	{
		title: '1. Information We Collect',
		content: (
			<>
				<p>When you use AuditToPitch Pro, we collect information needed to provide and maintain the service:</p>
				<ul>
					<li><strong>Account details:</strong> your email address and account identifier, managed through Supabase Authentication.</li>
					<li><strong>Audit information:</strong> website URLs you submit, page details collected for the audit, and the resulting findings and pitch scripts. Audit results are saved to your account.</li>
					<li><strong>Payment information:</strong> subscription and transaction metadata, such as plan status and provider identifiers. Lemon Squeezy processes payments; we do not store full payment card details.</li>
				</ul>
			</>
		),
	},
	{
		title: '2. How We Process Audits',
		content: (
			<p>
				When you request an audit, the submitted URL and relevant page information are processed by automated AI models, including Google Gemini, to generate website performance findings and a pitch script. We use this information to provide the requested audit. We do not sell submitted audit data or use it to train public AI models.
			</p>
		),
	},
	{
		title: '3. Data Storage and Security',
		content: (
			<p>
				Supabase stores account profiles, saved audits, and subscription status. Vercel hosts the website and runs server-side functions. We use these providers to operate the service and apply access controls intended to protect account data. No internet service can guarantee absolute security.
			</p>
		),
	},
	{
		title: '4. Cookies and Local Storage',
		content: (
			<p>
				The website uses authentication cookies to maintain your signed-in session. The browser extension stores its session tokens and authentication state in Chrome local storage so it can keep you signed in and make authenticated requests. You can sign out from the extension or clear its stored data through your browser settings.
			</p>
		),
	},
	{
		title: '5. Third-Party Services',
		content: (
			<ul>
				<li><strong>Supabase:</strong> account authentication, database, and saved audit storage.</li>
				<li><strong>Vercel:</strong> website hosting and serverless functions.</li>
				<li><strong>Google Gemini API:</strong> AI processing for audit findings and pitch scripts.</li>
				<li><strong>Lemon Squeezy:</strong> subscription checkout and payment processing.</li>
			</ul>
		),
	},
	{
		title: '6. Your Rights and Contact',
		content: (
			<p>
				You can request access to, correction of, or deletion of your account and associated audit data. For a data request or a privacy question, email{' '}
				<a href="mailto:support@audittopitch.com" className="font-medium text-brand-light underline decoration-brand/40 underline-offset-4 hover:text-brand">
					support@audittopitch.com
				</a>.
			</p>
		),
	},
]

export default function PrivacyPage() {
	return (
		<main className="min-h-screen px-4 py-12 sm:py-16">
			<article className="mx-auto max-w-4xl">
				<Link
					href="/"
					className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-surface/80 px-4 text-sm font-medium text-ink transition hover:border-brand/60 hover:text-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
				>
					<span aria-hidden="true">←</span> Back to Home
				</Link>

				<header className="mt-10 border-b border-line pb-8">
					<p className="text-xs font-semibold uppercase text-brand-light">AuditToPitch Pro</p>
					<h1 className="mt-3 text-4xl font-bold text-ink sm:text-5xl">Privacy Policy</h1>
					<p className="mt-4 max-w-2xl text-base leading-7 text-muted">
						This policy explains what information we use to provide AuditToPitch Pro and how it is handled.
					</p>
				</header>

				<div className="divide-y divide-line">
					{sections.map(({ title, content }) => (
						<section key={title} className="py-7 sm:py-8">
							<h2 className="text-xl font-semibold text-ink">{title}</h2>
							<div className="mt-3 space-y-3 text-sm leading-7 text-muted [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
								{content}
							</div>
						</section>
					))}
				</div>
			</article>
		</main>
	)
}
