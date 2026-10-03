'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import styles from '@/app/dashboard/dashboard.module.css'

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
			<button type="button" className={styles.btn} onClick={handleUpgrade} disabled={isRedirecting}>
				{isRedirecting ? 'Redirecting...' : 'Get Pro for $39'}
			</button>
			{error && <p className={styles.error} role="alert">{error}</p>}
		</div>
	)
}
