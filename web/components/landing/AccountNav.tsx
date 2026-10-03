'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function AccountNav() {
	const router = useRouter()
	const [email, setEmail] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		const supabase = createSupabaseBrowserClient()
		let isMounted = true
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			setEmail(session?.user.email ?? null)
			setIsLoading(false)
			setError('')
		})

		void supabase.auth.getSession().then(({ data, error: sessionError }) => {
			if (!isMounted) return
			setEmail(sessionError ? null : data.session?.user.email ?? null)
			setIsLoading(false)
		})

		return () => {
			isMounted = false
			subscription.unsubscribe()
		}
	}, [])

	async function handleSignOut() {
		setError('')
		const supabase = createSupabaseBrowserClient()
		const { error: signOutError } = await supabase.auth.signOut()
		if (signOutError) {
			setError('Could not sign out. Please try again.')
			return
		}

		setEmail(null)
		router.refresh()
	}

	if (isLoading) {
		return <span className="hidden h-8 w-[84px] sm:block" aria-hidden="true" />
	}

	if (!email) {
		return (
			<a
				href="/login"
				className="hidden text-sm font-medium text-muted transition-colors hover:text-ink sm:block"
			>
				Sign In
			</a>
		)
	}

	return (
		<div className="flex max-w-[210px] items-center gap-2">
			<span className="max-w-[170px] truncate text-sm font-medium text-ink" title={email} aria-live="polite">
				{email}
			</span>
			<button
				type="button"
				onClick={handleSignOut}
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
				aria-label="Sign out"
				title="Sign out"
			>
				<LogOut className="h-4 w-4" />
			</button>
			{error && <span className="sr-only" role="alert">{error}</span>}
		</div>
	)
}