import { BrandWordmark } from './BrandWordmark'
import { AccountNav } from './AccountNav'

const NAV_LINKS = [
	{ href: '#features', label: 'Features' },
	{ href: '#how-it-works', label: 'How It Works' },
	{ href: '#pricing', label: 'Pricing' },
]

export function Navbar() {
	return (
		<header className="sticky top-0 z-50 border-b border-line bg-[#030806]/90 backdrop-blur-xl">
			<nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-6">
				<a href="#top" className="flex items-center">
					<BrandWordmark width={180} className="w-[148px] sm:w-[180px]" />
				</a>

				<div className="hidden items-center gap-8 md:flex">
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-sm font-medium text-muted transition-colors hover:text-brand-light"
						>
							{link.label}
						</a>
					))}
				</div>

				<div className="flex items-center gap-3">
					<AccountNav />
					<a
						href="#pricing"
						className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-[#03120a] shadow-[0_0_22px_rgba(0,245,160,0.18)] transition-colors hover:bg-brand-light"
					>
						Try 3 Free Audits
					</a>
				</div>
			</nav>
		</header>
	)
}
