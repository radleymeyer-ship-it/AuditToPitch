'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import styles from '@/app/dashboard/dashboard.module.css'

export function DashboardHeader({ email, isPro }: { email: string; isPro: boolean }) {
	const router = useRouter()
	const [isSigningOut, setIsSigningOut] = useState(false)
	const [error, setError] = useState('')

	async function handleSignOut() {
		setError('')
		setIsSigningOut(true)
		const supabase = createSupabaseBrowserClient()
		const { error: signOutError } = await supabase.auth.signOut()
		if (signOutError) {
			setError('Could not sign out. Please try again.')
			setIsSigningOut(false)
			return
		}

		router.push('/login')
		router.refresh()
	}

	return (
		<header className={styles.header}>
			<Link href="/dashboard" className={styles.brand} aria-label="AuditToPitch Pro dashboard">
				<div className={styles.logo} aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="#1cf08c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
						<path d="M10 9l5 3-5 3z" fill="#1cf08c" />
					</svg>
				</div>
				<span>AuditToPitch <b>Pro</b></span>
			</Link>

			<div className={styles.who}>
				<span className={styles.email} title={email}>{email}</span>
				<span className={styles.pill}>{isPro ? 'Pro' : 'Free'}</span>
				<button type="button" className={styles.pill} onClick={handleSignOut} disabled={isSigningOut}>
					{isSigningOut ? 'Signing out...' : 'Sign out'}
				</button>
			</div>
			{error && <p className={styles.error} role="alert">{error}</p>}
		</header>
	)
}
