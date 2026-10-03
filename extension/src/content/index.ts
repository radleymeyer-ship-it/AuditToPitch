import type { AuditMessage, JsonLdBlock, PageAudit } from '../types'

type ChromeRuntime = {
	lastError?: { message?: string }
	sendMessage: (message: AuditMessage, callback?: () => void) => unknown
}

type ChromeGlobal = typeof globalThis & {
	chrome?: { runtime?: ChromeRuntime }
}

const IMAGE_BATCH_SIZE = 200
const SCRIPT_BATCH_SIZE = 100
const MAX_INLINE_SCRIPT_LENGTH = 10_000

function getMetaContent(selector: string): string | null {
	try {
		const content = document.querySelector<HTMLMetaElement>(selector)?.content.trim()
		return content || null
	} catch {
		return null
	}
}

function getCanonicalUrl(): string | null {
	try {
		const href = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.trim()
		return href || null
	} catch {
		return null
	}
}

function readJsonLd(): JsonLdBlock[] {
	try {
		return Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))
			.map((script) => {
				const raw = script.textContent?.trim() ?? ''
				let parsed: unknown | null = null

				try {
					parsed = JSON.parse(raw) as unknown
				} catch {
					// Keep malformed JSON-LD available to the audit consumer.
				}

				return { raw, parsed }
			})
	} catch {
		return []
	}
}

function createAudit(): Promise<PageAudit> {
	return new Promise((resolve) => {
		let missingAltTextImages = 0
		let imageIndex = 0
		let scriptIndex = 0
		let googleTagManager = false
		let googleAnalytics4 = false
		let metaPixel = false
		let tiktokPixel = false
		let hubspot = false
		let imageCount = 0
		let scriptCount = 0

		try {
			imageCount = document.images.length
			scriptCount = document.scripts.length
		} catch {
			// A partially available document still yields the metadata it can provide.
		}

		const scanBatch = () => {
			try {
				const imageEnd = Math.min(imageIndex + IMAGE_BATCH_SIZE, imageCount)
				for (; imageIndex < imageEnd; imageIndex += 1) {
					try {
						if (!document.images.item(imageIndex)?.hasAttribute('alt')) {
							missingAltTextImages += 1
						}
					} catch {
						// Ignore an image that becomes unavailable while the page is changing.
					}
				}

				const scriptEnd = Math.min(scriptIndex + SCRIPT_BATCH_SIZE, scriptCount)
				for (; scriptIndex < scriptEnd; scriptIndex += 1) {
					try {
						const script = document.scripts.item(scriptIndex)
						if (!script) continue

						const source = script.src.toLowerCase()
						const inlineCode = (script.textContent ?? '').slice(0, MAX_INLINE_SCRIPT_LENGTH).toLowerCase()
						const text = `${source}\n${inlineCode}`

						googleTagManager ||= /googletagmanager\.com\/gtm\.js|gtm-[a-z0-9]+/.test(text)
						googleAnalytics4 ||= /googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\/collect|\bg-[a-z0-9]{6,}\b/.test(text)
						metaPixel ||= /connect\.facebook\.net\/.+\/fbevents\.js|\bfbq\s*\(/.test(text)
						tiktokPixel ||= /analytics\.tiktok\.com\/.+\/pixel|\bttq\.(?:load|page|track)\s*\(/.test(text)
						hubspot ||= /js\.hs-scripts\.com|js\.hs-analytics\.net|\b_hsq\b/.test(text)
					} catch {
						// Ignore a script that becomes unavailable while the page is changing.
					}
				}

				if (imageIndex < imageCount || scriptIndex < scriptCount) {
					schedule(scanBatch)
					return
				}

				const missingH1 = (() => {
					try {
						return document.querySelector('h1') === null
					} catch {
						return true
					}
				})()
				const metaDescription = getMetaContent('meta[name="description"]')

				resolve({
					url: safeRead(() => location.href, ''),
					title: safeRead(() => document.title, ''),
					metaDescription,
					canonicalUrl: getCanonicalUrl(),
					openGraph: {
						title: getMetaContent('meta[property="og:title"]'),
						image: getMetaContent('meta[property="og:image"]'),
						description: getMetaContent('meta[property="og:description"]'),
					},
					jsonLd: readJsonLd(),
					analytics: { googleTagManager, googleAnalytics4, metaPixel, tiktokPixel, hubspot },
					missingCriticalElements: {
						total: missingAltTextImages + Number(missingH1) + Number(metaDescription === null),
						missingAltTextImages,
						missingH1,
						missingMetaDescription: metaDescription === null,
					},
				})
			} catch {
				resolve(createFallbackAudit())
			}
		}

		schedule(scanBatch)
	})
}

function safeRead<T>(read: () => T, fallback: T): T {
	try {
		return read()
	} catch {
		return fallback
	}
}

function createFallbackAudit(): PageAudit {
	return {
		url: '',
		title: '',
		metaDescription: null,
		canonicalUrl: null,
		openGraph: { title: null, image: null, description: null },
		jsonLd: [],
		analytics: {
			googleTagManager: false,
			googleAnalytics4: false,
			metaPixel: false,
			tiktokPixel: false,
			hubspot: false,
		},
		missingCriticalElements: {
			total: 2,
			missingAltTextImages: 0,
			missingH1: true,
			missingMetaDescription: true,
		},
	}
}

function schedule(callback: () => void): void {
	try {
		const idleWindow = window as typeof window & {
			requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
		}
		if (idleWindow.requestIdleCallback) {
			idleWindow.requestIdleCallback(callback, { timeout: 1000 })
		} else {
			window.setTimeout(callback, 0)
		}
	} catch {
		try {
			window.setTimeout(callback, 0)
		} catch {
			callback()
		}
	}
}

function sendAudit(data: PageAudit): void {
	try {
		const runtime = (globalThis as ChromeGlobal).chrome?.runtime
		if (!runtime?.sendMessage) return

		runtime.sendMessage({ type: 'PAGE_AUDIT_COLLECTED', data }, () => {
			try {
				void runtime.lastError
			} catch {
				// A missing receiving context must not interrupt the page.
			}
		})
	} catch {
		// The extension context may be unavailable, for example after a reload.
	}
}

void createAudit().then(sendAudit).catch(() => sendAudit(createFallbackAudit()))

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'RUN_PAGE_AUDIT') return

	void createAudit()
		.then((data) => sendResponse({ type: 'PAGE_AUDIT_RESULT', data }))
		.catch(() => sendResponse({ type: 'PAGE_AUDIT_RESULT', data: createFallbackAudit() }))
	return true
})
