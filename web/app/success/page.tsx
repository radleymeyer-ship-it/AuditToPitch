import Link from 'next/link'

export default function SuccessPage() {
	return (
		<div className="flex min-h-full flex-1 items-center justify-center bg-black px-6 py-24">
			<div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
				<h1 className="text-3xl font-bold tracking-tight text-zinc-50">
					🎉 Subscription Activated!
				</h1>

				<p className="mt-4 text-base leading-relaxed text-zinc-400">
					Thank you for upgrading to AuditToPitch Pro. Your account now has unlimited
					website audits.
				</p>

				<p className="mt-4 text-sm leading-relaxed text-zinc-500">
					Open your AuditToPitch Chrome extension on any website to generate your AI
					video pitch scripts.
				</p>

				<Link
					href="/"
					className="mt-8 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
				>
					Return to Home
				</Link>
			</div>
		</div>
	)
}
