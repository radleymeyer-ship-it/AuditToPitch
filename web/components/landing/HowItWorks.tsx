import { Download, ScanSearch, Video } from 'lucide-react'

const STEPS = [
	{
		icon: Download,
		title: 'Install & Open',
		description: "Install the Chrome extension and open any prospect's website.",
	},
	{
		icon: ScanSearch,
		title: 'Auto-Detect Flaws',
		description:
			'Auto-detect missing Meta pixels, GA4 tags, schema markup, and speed flaws.',
	},
	{
		icon: Video,
		title: 'Pitch & Close',
		description:
			'Use a prospect-specific pitch script to start a useful conversation with the client.',
	},
]

export function HowItWorks() {
	return (
		<section id="how-it-works" className="border-y border-line bg-surface/60 py-20">
			<div className="mx-auto max-w-6xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="text-3xl font-bold text-ink sm:text-4xl">
						How It Works
					</h2>
					<p className="mt-4 text-lg text-muted">
						From open tab to closed deal in three steps.
					</p>
				</div>

				<div className="mt-14 grid gap-8 sm:grid-cols-3">
					{STEPS.map((step, index) => (
						<div key={step.title} className="relative rounded-lg border border-line bg-[#08150e] p-6">
							<span className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full border border-brand/30 bg-brand text-sm font-bold text-[#03120a]">
								{index + 1}
							</span>
							<step.icon className="mt-4 h-8 w-8 text-brand-light" />
							<h3 className="mt-4 text-lg font-semibold text-ink">
								{step.title}
							</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}
