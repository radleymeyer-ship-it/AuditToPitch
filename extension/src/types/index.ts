export type AnalyticsPresence = {
	googleTagManager: boolean
	googleAnalytics4: boolean
	metaPixel: boolean
	tiktokPixel: boolean
	hubspot: boolean
}

export type JsonLdBlock = {
	raw: string
	parsed: unknown | null
}

export type PageAudit = {
	url: string
	title: string
	metaDescription: string | null
	canonicalUrl: string | null
	openGraph: {
		title: string | null
		image: string | null
		description: string | null
	}
	jsonLd: JsonLdBlock[]
	analytics: AnalyticsPresence
	missingCriticalElements: {
		total: number
		missingAltTextImages: number
		missingH1: boolean
		missingMetaDescription: boolean
	}
}

export type AuditMessage = {
	type: 'PAGE_AUDIT_COLLECTED'
	data: PageAudit
}

export type AuditResponse = {
	type: 'PAGE_AUDIT_RESULT'
	data: PageAudit
}
