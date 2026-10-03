import { AlertTriangle, Sparkles } from 'lucide-react'
import { BrandWordmark } from './BrandWordmark'

const FLAW_BADGES = [
	{ label: 'Meta Pixel', missing: true },
	{ label: 'GA4', missing: true },
	{ label: 'Meta Description', missing: true },
]

export function ExtensionMockup() {
	return (
		<div className="relative mx-auto w-full max-w-md">
			{/* Browser frame */}
			<div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
				<div className="flex items-center gap-1.5 border-b border-line bg-[#0a1710] px-3 py-2">
					<span className="h-2.5 w-2.5 rounded-full bg-red-400" />
					<span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
					<span className="h-2.5 w-2.5 rounded-full bg-green-400" />
					<span className="ml-3 truncate rounded bg-[#030806] px-2 py-0.5 text-xs text-muted">
						prospect-agency.com
					</span>
				</div>

				{/* Extension popup preview */}
				<div className="space-y-4 p-4">
					<div className="flex items-center justify-between">
						<BrandWordmark width={142} className="w-[132px]" />
						<span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-light">
							Scan complete
						</span>
					</div>

					<div className="flex items-center gap-4 rounded-lg border border-line bg-[#0a1710] p-3">
						<div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#101b11] text-xl font-bold text-signal-lime ring-4 ring-lime-300/10">
							61
						</div>
						<div>
							<p className="text-sm font-semibold text-ink">
								Health Score: Needs Work
							</p>
							<p className="text-xs text-muted">
								3 opportunities to improve
							</p>
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						{FLAW_BADGES.map((badge) => (
							<span
								key={badge.label}
								className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
									badge.missing
										? 'bg-alert/10 text-alert'
											: 'bg-brand/10 text-brand-light'
								}`}
							>
								{badge.missing && <AlertTriangle className="h-3 w-3" />}
								{badge.missing ? `Missing ${badge.label}` : `${badge.label} ✓`}
							</span>
						))}
					</div>

						<div className="rounded-lg border border-line bg-[#050d08] p-3">
						<div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-light">
							<Sparkles className="h-3.5 w-3.5" />
							Personalized pitch script
						</div>
						<p className="text-xs leading-relaxed text-muted">
							&ldquo;I noticed a few tracking gaps on your site that could make it harder to see which campaigns are working...&rdquo;
						</p>
					</div>
				</div>
			</div>

			{/* Decorative glow */}
			<div className="absolute inset-x-0 -inset-y-6 -z-10 rounded-3xl bg-brand/10 blur-3xl" />
		</div>
	)
}
