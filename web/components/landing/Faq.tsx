'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
	{
		question: 'Do I need a credit card to try 3 audits?',
		answer: 'No, start instantly — no credit card is required for your first 3 audits.',
	},
	{
		question: 'Can my agency sales team share an account?',
		answer: 'Yes, Pro accounts cover your core pitch team.',
	},
	{
		question: 'How does the AI create the video script?',
		answer:
			'It analyzes scraped technical gaps and maps them to high-converting agency sales angles.',
	},
]

export function Faq() {
	const [openIndex, setOpenIndex] = useState<number | null>(0)

	return (
		<section id="faq" className="border-t border-line py-20">
			<div className="mx-auto max-w-3xl px-6">
				<h2 className="text-center text-3xl font-bold text-ink sm:text-4xl">
					Frequently Asked Questions
				</h2>

				<div className="mt-10 space-y-3">
					{FAQS.map((faq, index) => {
						const isOpen = openIndex === index
						return (
							<div
								key={faq.question}
								className="rounded-lg border border-line bg-surface/65"
							>
								<button
									type="button"
									onClick={() => setOpenIndex(isOpen ? null : index)}
									aria-expanded={isOpen}
									className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink"
								>
									{faq.question}
									<ChevronDown
										className={`h-4 w-4 shrink-0 text-brand-light transition-transform ${isOpen ? 'rotate-180' : ''}`}
									/>
								</button>
								{isOpen && (
									<p className="px-5 pb-4 text-sm leading-relaxed text-muted">
										{faq.answer}
									</p>
								)}
							</div>
						)
					})}
				</div>
			</div>
		</section>
	)
}
