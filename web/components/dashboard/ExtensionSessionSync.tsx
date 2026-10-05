'use client'

import { useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { sendSessionToExtension } from '@/lib/extension-session'

export function ExtensionSessionSync() {
	useEffect(() => {
		void (async () => {
			const { data } = await createSupabaseBrowserClient().auth.getSession()
			const session = data.session
			if (!session) return
			await sendSessionToExtension({
				access_token: session.access_token,
				refresh_token: session.refresh_token,
				expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
				user: { id: session.user.id, email: session.user.email },
			})
		})()
	}, [])

	return null
}
