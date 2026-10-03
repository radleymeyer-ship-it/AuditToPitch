import { ArrowRight, Sparkles } from 'lucide-react'
import { ExtensionMockup } from './ExtensionMockup'

export function Hero() {
	return (
		<section id="top" className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-6 sm:pt-20">
			<div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
				<div>
					<span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/8 px-3 py-1.5 text-xs font-semibold text-brand-light">
						<Sparkles className="h-4 w-4 text-signal-lime" />
						3 free audits <span className="text-muted">/</span> no card required
					</span>

					<h1 className="mt-6 max-w-2xl text-5xl font-bold leading-[1.04] text-ink sm:text-6xl">
						Find the gaps.
						<br />
						<span className="text-brand-light">Start the conversation.</span>
					</h1>

					<p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
						Audit a prospect&apos;s site for missing tracking and SEO signals. Turn real findings
						into a personalized pitch script your agency can use to start a sales conversation.
					</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<a
							href="#pricing"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-[#03120a] shadow-[0_0_28px_rgba(0,245,160,0.2)] transition-colors hover:bg-brand-light"
						>
							Try 3 Free Audits
							<ArrowRight className="h-4 w-4" />
						</a>
						<a
							href="#how-it-works"
							className="rounded-full border border-line px-6 py-3 text-center text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-light"
						>
							See how it works
						</a>
					</div>
				</div>

				<ExtensionMockup />
			</div>
		</section>
	)
}
