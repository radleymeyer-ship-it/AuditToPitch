'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function UpgradeButton() {
	const [isRedirecting, setIsRedirecting] = useState(false)
	const [error, setError] = useState('')

	async function handleUpgrade() {
		setIsRedirecting(true)
		setError('')
		try {
			const supabase = createSupabaseBrowserClient()
			const { data: { session } } = await supabase.auth.getSession()
			if (!session) {
				window.location.href = '/login'
				return
			}

			const response = await fetch('/api/checkout', {
				method: 'POST',
				headers: { Authorization: `Bearer ${session.access_token}` },
			})
			const data = (await response.json()) as { url?: string }
			if (!response.ok || !data.url) throw new Error('Checkout failed')

			window.location.href = data.url
		} catch {
			setError('Could not start checkout. Please try again.')
			setIsRedirecting(false)
		}
	}

	return (
		<div>
			<button
				type="button"
				onClick={handleUpgrade}
				disabled={isRedirecting}
				className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-[#03120a] transition hover:bg-brand-light disabled:cursor-wait disabled:opacity-60"
			>
				<Sparkles className="h-4 w-4" />
				{isRedirecting ? 'Redirecting...' : 'Get Pro for $39'}
			</button>
			{error && <p className="mt-2 text-sm text-alert" role="alert">{error}</p>}
		</div>
	)
}
