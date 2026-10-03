import { Globe, Mail, MessageCircle } from 'lucide-react'
import { BrandWordmark } from './BrandWordmark'

const FOOTER_LINKS = [
	{ href: '#features', label: 'Features' },
	{ href: '#how-it-works', label: 'How It Works' },
	{ href: '#pricing', label: 'Pricing' },
	{ href: '#faq', label: 'FAQ' },
]

export function Footer() {
	return (
		<footer className="border-t border-line py-12">
			<div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
				<a href="#top" className="flex items-center">
					<BrandWordmark width={152} />
				</a>

				<nav className="flex flex-wrap items-center justify-center gap-6">
					{FOOTER_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-sm text-muted transition-colors hover:text-brand-light"
						>
							{link.label}
						</a>
					))}
				</nav>

				<div className="flex items-center gap-4">
					<a href="https://twitter.com" aria-label="Twitter" className="text-muted hover:text-brand-light">
						<MessageCircle className="h-5 w-5" />
					</a>
					<a href="https://github.com" aria-label="GitHub" className="text-muted hover:text-brand-light">
						<Globe className="h-5 w-5" />
					</a>
					<a href="https://linkedin.com" aria-label="LinkedIn" className="text-muted hover:text-brand-light">
						<Mail className="h-5 w-5" />
					</a>
				</div>
			</div>

			<p className="mt-8 text-center text-xs text-muted">
				&copy; {new Date().getFullYear()} AuditToPitch. All rights reserved.
			</p>
		</footer>
	)
}
