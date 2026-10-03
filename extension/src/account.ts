export type ExtensionSession = {
	access_token: string
	refresh_token: string
	expires_at: number
	user: { id: string; email?: string }
}

export type ExtensionAccount = {
	session: ExtensionSession
	isSubscribed: boolean
	freeAuditsRemaining: number | null
}

type ProfileResponse = {
	is_subscribed: boolean
	free_audits_remaining: number | null
}

type ApiError = Error & { status?: number }

const SITE_URL = import.meta.env.VITE_SITE_URL || 'http://127.0.0.1:3000'
const SESSION_KEY = 'auditToPitchSession'
const PENDING_SESSION_KEY = 'auditToPitchPendingSession'

function isSession(value: unknown): value is ExtensionSession {
	if (!value || typeof value !== 'object') return false
	const session = value as Partial<ExtensionSession>
	return (
		typeof session.access_token === 'string' &&
		typeof session.refresh_token === 'string' &&
		typeof session.expires_at === 'number' &&
		typeof session.user?.id === 'string'
	)
}

function storageGet(key: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(key, (result) => {
			const error = chrome.runtime.lastError
			if (error) {
				reject(new Error(error.message || 'Could not read extension storage'))
				return
			}
			resolve(result[key])
		})
	})
}

function storageSet(key: string, value: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set({ [key]: value }, () => {
			const error = chrome.runtime.lastError
			if (error) {
				reject(new Error(error.message || 'Could not save extension session'))
				return
			}
			resolve()
		})
	})
}

function storageRemove(key: string): Promise<void> {
	return new Promise((resolve, reject) => {
		chrome.storage.local.remove(key, () => {
			const error = chrome.runtime.lastError
			if (error) {
				reject(new Error(error.message || 'Could not clear extension session'))
				return
			}
			resolve()
		})
	})
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
	const url = new URL(path, `${SITE_URL.replace(/\/+$/, '')}/`)
	const response = await fetch(url, init)
	let body: unknown
	try {
		body = await response.json()
	} catch {
		body = {}
	}

	if (!response.ok) {
		const message =
			typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
				? body.error
				: 'Account request failed'
		const error = new Error(message) as ApiError
		error.status = response.status
		throw error
	}

	return body as T
}

async function refreshSession(refreshToken: string): Promise<ExtensionSession> {
	return requestJson<ExtensionSession>('/api/extension/session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh_token: refreshToken }),
	})
}

async function getProfile(accessToken: string): Promise<ProfileResponse> {
	return requestJson<ProfileResponse>('/api/extension/profile', {
		headers: { Authorization: `Bearer ${accessToken}` },
	})
}

export async function loadExtensionAccount(): Promise<ExtensionAccount | null> {
	if (typeof chrome === 'undefined' || !chrome.storage?.local) return null

	const pendingValue = await storageGet(PENDING_SESSION_KEY)
	const storedValue = await storageGet(SESSION_KEY)
	let session = isSession(pendingValue) ? pendingValue : isSession(storedValue) ? storedValue : null

	if (isSession(pendingValue)) {
		await storageSet(SESSION_KEY, pendingValue)
		await storageRemove(PENDING_SESSION_KEY)
	} else if (pendingValue !== undefined) {
		await storageRemove(PENDING_SESSION_KEY)
	}

	if (!session) return null

	try {
		if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
			session = await refreshSession(session.refresh_token)
		}

		let profile: ProfileResponse
		try {
			profile = await getProfile(session.access_token)
		} catch (error) {
			if (!(error instanceof Error) || (error as ApiError).status !== 401) throw error
			session = await refreshSession(session.refresh_token)
			profile = await getProfile(session.access_token)
		}

		await storageSet(SESSION_KEY, session)
		return {
			session,
			isSubscribed: profile.is_subscribed === true,
			freeAuditsRemaining: profile.free_audits_remaining ?? null,
		}
	} catch (error) {
		if (error instanceof Error && (error as ApiError).status === 401) {
			await storageRemove(SESSION_KEY)
			return null
		}
		throw error
	}
}