import { jsPDF } from 'jspdf'
import type { PageAudit } from '../types'

type AuditPdfData = {
	audit: PageAudit
	score: number
	findings: string[]
	quickSummary: string
	pitchScript: string
	logoDataUrl?: string | null
}

const COLORS = {
	ink: [20, 34, 27] as const,
	muted: [91, 107, 98] as const,
	mint: [0, 145, 94] as const,
	line: [214, 224, 217] as const,
	soft: [244, 248, 245] as const,
	alert: [173, 72, 53] as const,
}

function printableText(value: string) {
	return value
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201c\u201d]/g, '"')
		.replace(/[\u2013\u2014]/g, '-')
}

export async function loadAuditLogo(): Promise<string | null> {
	let objectUrl: string | null = null
	try {
		const response = await fetch('/brand-wordmark.png')
		if (!response.ok) return null
		const blob = await response.blob()
		objectUrl = URL.createObjectURL(blob)
		const image = new Image()
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve()
			image.onerror = () => reject(new Error('Could not load the report logo'))
			image.src = objectUrl as string
		})

		const maxWidth = 800
		const scale = Math.min(1, maxWidth / image.naturalWidth)
		const canvas = document.createElement('canvas')
		canvas.width = Math.round(image.naturalWidth * scale)
		canvas.height = Math.round(image.naturalHeight * scale)
		const context = canvas.getContext('2d')
		if (!context) return null
		context.drawImage(image, 0, 0, canvas.width, canvas.height)
		return canvas.toDataURL('image/png')
	} catch {
		return null
	} finally {
		if (objectUrl) URL.revokeObjectURL(objectUrl)
	}
}

function recommendationForFinding(finding: string): string {
	const normalized = finding.toLowerCase()
	if (normalized.includes('google analytics 4')) return 'Install GA4 and configure lead events to connect campaign traffic with enquiries.'
	if (normalized.includes('meta pixel')) return 'Add the Meta Pixel and verify conversion events for campaign optimization.'
	if (normalized.includes('tag manager')) return 'Centralize marketing tags so tracking changes can be reviewed and maintained consistently.'
	if (normalized.includes('meta description')) return 'Write a concise search description that communicates the offer and encourages qualified clicks.'
	if (normalized.includes('h1')) return 'Add one descriptive H1 that makes the page offer clear to visitors and search engines.'
	if (normalized.includes('alt text')) return 'Add concise alt text to meaningful images for accessibility and search context.'
	if (normalized.includes('structured data')) return 'Add structured data relevant to the organization and the page content.'
	if (normalized.includes('canonical')) return 'Set a canonical URL to clarify the preferred page when similar URLs exist.'
	if (normalized.includes('social sharing image')) return 'Set a branded social preview image to make shared links more recognizable.'
	return 'Review this item against the page goal and prioritize the change most likely to improve qualified enquiries.'
}

export function downloadAuditPdf({ audit, score, findings, quickSummary, pitchScript, logoDataUrl }: AuditPdfData) {
	const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
	const pageWidth = pdf.internal.pageSize.getWidth()
	const pageHeight = pdf.internal.pageSize.getHeight()
	const margin = 44
	const contentWidth = pageWidth - margin * 2
	const bottomLimit = pageHeight - 48
	let y = 0

	const ensureSpace = (height: number) => {
		if (y + height <= bottomLimit) return
		pdf.addPage()
		y = margin
	}

	const getLines = (value: string, width: number, size: number, bold = false) => {
		pdf.setFont('helvetica', bold ? 'bold' : 'normal')
		pdf.setFontSize(size)
		return pdf.splitTextToSize(printableText(value), width) as string[]
	}

	const writeParagraph = (value: string, options: { size?: number; color?: readonly [number, number, number]; bold?: boolean; indent?: number } = {}) => {
		const size = options.size ?? 9.5
		const indent = options.indent ?? 0
		const lineHeight = size * 1.42
		const lines = getLines(value, contentWidth - indent, size, options.bold)
		pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
		pdf.setFontSize(size)
		pdf.setTextColor(...(options.color ?? COLORS.ink))

		for (const line of lines) {
			ensureSpace(lineHeight)
			pdf.text(line, margin + indent, y)
			y += lineHeight
		}
		y += 4
	}

	const writeSectionTitle = (title: string) => {
		ensureSpace(30)
		y += 5
		pdf.setFillColor(...COLORS.mint)
		pdf.rect(margin, y - 10, 3, 13, 'F')
		pdf.setFont('helvetica', 'bold')
		pdf.setFontSize(9)
		pdf.setTextColor(...COLORS.ink)
		const label = title.toUpperCase()
		pdf.text(label, margin + 9, y)
		const ruleStart = margin + 18 + pdf.getTextWidth(label)
		pdf.setDrawColor(...COLORS.line)
		pdf.setLineWidth(0.6)
		pdf.line(ruleStart, y - 3, pageWidth - margin, y - 3)
		y += 14
	}

	pdf.setFillColor(3, 8, 6)
	pdf.rect(0, 0, pageWidth, 142, 'F')
	if (logoDataUrl) {
		pdf.addImage(logoDataUrl, 'PNG', margin, 13, 150, 30)
	} else {
		pdf.setFont('helvetica', 'bold')
		pdf.setFontSize(10)
		pdf.setTextColor(149, 255, 197)
		pdf.text('AUDITTOPITCH PRO', margin, 33)
	}
	pdf.setFont('helvetica', 'normal')
	pdf.setFontSize(8)
	pdf.setTextColor(174, 195, 182)
	pdf.text('WEBSITE PERFORMANCE REPORT', margin, 61)
	pdf.text(new Date().toLocaleDateString(), pageWidth - margin, 61, { align: 'right' })
	pdf.setFont('helvetica', 'bold')
	pdf.setFontSize(20)
	pdf.setTextColor(245, 255, 248)
	pdf.text('Executive website audit', margin, 88)
	const titleLines = pdf.splitTextToSize(printableText(audit.title || audit.url), contentWidth)
	pdf.setFont('helvetica', 'normal')
	pdf.setFontSize(9)
	pdf.setTextColor(205, 220, 211)
	pdf.text(titleLines.slice(0, 1), margin, 112)
	y = 160

	pdf.setDrawColor(...COLORS.line)
	pdf.setFillColor(...COLORS.soft)
	const metricsY = y
	const metricsHeight = 62
	pdf.roundedRect(margin, metricsY, contentWidth, metricsHeight, 5, 5, 'FD')
	const detectedTags = [audit.analytics.googleAnalytics4, audit.analytics.googleTagManager, audit.analytics.metaPixel, audit.analytics.tiktokPixel, audit.analytics.hubspot].filter(Boolean).length
	const seoChecks = [Boolean(audit.metaDescription), !audit.missingCriticalElements.missingH1, Boolean(audit.canonicalUrl), audit.jsonLd.length > 0].filter(Boolean).length
	const metrics = [
		[String(score), 'HEALTH SCORE'],
		[String(findings.length), 'FINDINGS'],
		[`${detectedTags} / 5`, 'TRACKING TAGS'],
		[`${seoChecks} / 4`, 'SEO SIGNALS'],
	]
	const metricWidth = contentWidth / metrics.length
	metrics.forEach(([value, label], index) => {
		const x = margin + metricWidth * index
		if (index > 0) {
			pdf.setDrawColor(...COLORS.line)
			pdf.setLineWidth(0.6)
			pdf.line(x, metricsY + 11, x, metricsY + metricsHeight - 11)
		}
		pdf.setFont('helvetica', 'bold')
		pdf.setFontSize(index === 0 ? 19 : 16)
		pdf.setTextColor(index === 0 ? COLORS.mint[0] : COLORS.ink[0], index === 0 ? COLORS.mint[1] : COLORS.ink[1], index === 0 ? COLORS.mint[2] : COLORS.ink[2])
		pdf.text(value, x + metricWidth / 2, metricsY + 29, { align: 'center' })
		pdf.setFont('helvetica', 'normal')
		pdf.setFontSize(6.5)
		pdf.setTextColor(...COLORS.muted)
		pdf.text(label, x + metricWidth / 2, metricsY + 46, { align: 'center' })
	})
	y += metricsHeight + 10

	writeSectionTitle('Executive summary')
	writeParagraph(quickSummary, { size: 9.5, color: COLORS.muted })

	writeSectionTitle('Findings and recommended actions')
	const findingWidth = 190
	const actionX = margin + findingWidth + 24
	const actionWidth = contentWidth - findingWidth - 24
	pdf.setFont('helvetica', 'bold')
	pdf.setFontSize(7)
	pdf.setTextColor(...COLORS.muted)
	pdf.text('FINDING', margin + 24, y)
	pdf.text('RECOMMENDED ACTION', actionX, y)
	y += 9
	pdf.setDrawColor(...COLORS.line)
	pdf.line(margin, y, pageWidth - margin, y)
	y += 8

	const reportFindings = findings.length ? findings : ['No high-impact tracking or metadata gaps detected']
	for (const [index, finding] of reportFindings.entries()) {
		const findingLines = getLines(finding, findingWidth - 26, 8.5, true)
		const actionLines = getLines(
			findings.length ? recommendationForFinding(finding) : 'Review the conversion journey and test whether the page turns visits into qualified enquiries.',
			actionWidth,
			8
		)
		const rowHeight = Math.max(findingLines.length * 11, actionLines.length * 10.5) + 10
		ensureSpace(rowHeight)
		pdf.setFont('helvetica', 'bold')
		pdf.setFontSize(8)
		pdf.setTextColor(...COLORS.mint)
		pdf.text(String(index + 1).padStart(2, '0'), margin, y + 8)
		pdf.setFont('helvetica', 'bold')
		pdf.setFontSize(8.5)
		pdf.setTextColor(...COLORS.ink)
		pdf.text(findingLines, margin + 24, y + 8)
		pdf.setFont('helvetica', 'normal')
		pdf.setFontSize(8)
		pdf.setTextColor(...COLORS.muted)
		pdf.text(actionLines, actionX, y + 8)
		pdf.setDrawColor(...COLORS.line)
		pdf.setLineWidth(0.45)
		pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
		y += rowHeight + 3
	}

	writeSectionTitle('Tracking and technical signals')
	const signals: Array<[string, boolean]> = [
		['Google Analytics 4', audit.analytics.googleAnalytics4],
		['Google Tag Manager', audit.analytics.googleTagManager],
		['Meta Pixel', audit.analytics.metaPixel],
		['TikTok Pixel', audit.analytics.tiktokPixel],
		['HubSpot', audit.analytics.hubspot],
		['Meta description', Boolean(audit.metaDescription)],
		['H1 heading', !audit.missingCriticalElements.missingH1],
		['Canonical URL', Boolean(audit.canonicalUrl)],
		['Structured data', audit.jsonLd.length > 0],
	]
	for (const [label, present] of signals) {
		ensureSpace(18)
		pdf.setFont('helvetica', 'normal')
		pdf.setFontSize(8.5)
		pdf.setTextColor(...COLORS.ink)
		pdf.text(label, margin + 8, y)
		pdf.setFont('helvetica', 'bold')
		pdf.setFontSize(7)
		const statusColor = present ? COLORS.mint : COLORS.muted
		pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
		pdf.text(present ? 'DETECTED' : 'NOT DETECTED', pageWidth - margin - 8, y, { align: 'right' })
		pdf.setDrawColor(...COLORS.line)
		pdf.setLineWidth(0.4)
		pdf.line(margin, y + 5, pageWidth - margin, y + 5)
		y += 14
	}

	writeSectionTitle('Personalized pitch script')
	const pitchLines = getLines(pitchScript, contentWidth - 26, 9, false)
	const pitchHeight = Math.max(46, pitchLines.length * 13 + 22)
	ensureSpace(pitchHeight + 8)
	pdf.setFillColor(...COLORS.soft)
	pdf.roundedRect(margin, y, contentWidth, pitchHeight, 5, 5, 'F')
	pdf.setFillColor(...COLORS.mint)
	pdf.rect(margin, y, 3, pitchHeight, 'F')
	pdf.setFont('helvetica', 'normal')
	pdf.setFontSize(9)
	pdf.setTextColor(...COLORS.ink)
	pdf.text(pitchLines, margin + 13, y + 17)
	y += pitchHeight + 8

	const pageCount = pdf.getNumberOfPages()
	for (let page = 1; page <= pageCount; page += 1) {
		pdf.setPage(page)
		pdf.setDrawColor(...COLORS.line)
		pdf.line(margin, pageHeight - 31, pageWidth - margin, pageHeight - 31)
		pdf.setFont('helvetica', 'normal')
		pdf.setFontSize(7)
		pdf.setTextColor(...COLORS.muted)
		pdf.text('AUDITTOPITCH PRO  |  CONFIDENTIAL PROSPECT REPORT', margin, pageHeight - 17)
		pdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 17, { align: 'right' })
	}

	const host = new URL(audit.url).hostname.replace(/[^a-z0-9.-]/gi, '-') || 'website'
	const blob = pdf.output('blob')
	const objectUrl = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = objectUrl
	link.download = `AuditToPitch-${host}.pdf`
	link.style.display = 'none'
	document.body.appendChild(link)
	link.click()
	link.remove()
	window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
}