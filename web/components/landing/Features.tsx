import { FileText, History, Sparkles, Radar } from 'lucide-react'

const FEATURES = [
	{
		icon: Radar,
		title: 'Instant DOM & Pixel Inspector',
		description:
			'Scans any page in seconds for missing analytics, broken tags, and technical SEO gaps.',
	},
	{
		icon: Sparkles,
		title: 'Client Presentation Script',
		description:
			'Turn findings from a requested client-site audit into a concise presentation script for a discovery proposal.',
	},
	{
		icon: FileText,
		title: 'PDF Executive Summary Export',
		description: 'Turn every audit into a polished, client-ready PDF in one click.',
	},
	{
		icon: History,
		title: 'Audit History & Client Reporting',
		description: 'Keep client-site audits and white-label reports organized in one workspace.',
	},
]

export function Features() {
	return (
		<section id="features" className="py-20">
			<div className="mx-auto max-w-6xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-bold text-ink sm:text-4xl">
						Inbound Site Audit & Client Presentation Tool
					</h2>
					<p className="mt-4 text-lg text-muted">
						A practical website-audit and client-presentation workspace for agencies and freelancers.
					</p>
				</div>

				<div className="mt-14 grid gap-6 sm:grid-cols-2">
					{FEATURES.map((feature) => (
						<div
							key={feature.title}
							className="rounded-lg border border-line bg-surface/70 p-6 transition-colors hover:border-brand/50"
						>
							<span className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand-light">
								<feature.icon className="h-5 w-5" />
							</span>
							<h3 className="mt-4 text-lg font-semibold text-ink">
								{feature.title}
							</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}
