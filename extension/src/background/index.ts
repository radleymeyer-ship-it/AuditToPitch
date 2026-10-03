const SITE_ORIGIN = new URL(import.meta.env.VITE_SITE_URL || 'http://127.0.0.1:3000').origin
const PENDING_SESSION_KEY = 'auditToPitchPendingSession'

type SessionMessage = {
	source: 'audit-to-pitch-auth'
	type: 'session'
	session: {
		access_token: string
		refresh_token: string
		expires_at: number
		user: { id: string; email?: string }
	}
}

function isSessionMessage(message: unknown): message is SessionMessage {
	if (!message || typeof message !== 'object') return false
	const candidate = message as Partial<SessionMessage>
	const session = candidate.session
	return (
		candidate.source === 'audit-to-pitch-auth' &&
		candidate.type === 'session' &&
		!!session &&
		typeof session.access_token === 'string' &&
		typeof session.refresh_token === 'string' &&
		typeof session.expires_at === 'number' &&
		typeof session.user?.id === 'string'
	)
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
	let senderOrigin: string
	try {
		senderOrigin = new URL(sender.url ?? '').origin
	} catch {
		sendResponse({ ok: false })
		return false
	}

	if (senderOrigin !== SITE_ORIGIN || !isSessionMessage(message)) {
		sendResponse({ ok: false })
		return false
	}

	chrome.storage.local.set({ [PENDING_SESSION_KEY]: message.session }, () => {
		const error = chrome.runtime.lastError
		sendResponse({ ok: !error })
	})
	return true
})
