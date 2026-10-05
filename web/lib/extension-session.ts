type ExtensionRuntime = {
	sendMessage: (
		extensionId: string,
		message: unknown,
		callback: (response?: { ok?: boolean }) => void
	) => void
	lastError?: { message?: string }
}

type ChromeWindow = Window & { chrome?: { runtime?: ExtensionRuntime } }

export type ExtensionSessionPayload = {
	access_token: string
	refresh_token: string
	expires_at: number
	user: { id: string; email?: string }
}

export function sendSessionToExtension(session: ExtensionSessionPayload) {
	const extensionId = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
	const runtime = (window as ChromeWindow).chrome?.runtime
	if (!extensionId || !runtime?.sendMessage) return Promise.resolve(false)

	return new Promise<boolean>((resolve) => {
		runtime.sendMessage(
			extensionId,
			{ source: 'audit-to-pitch-auth', type: 'session', session },
			(response) => resolve(!runtime.lastError && response?.ok === true)
		)
	})
}
