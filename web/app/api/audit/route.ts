import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { FREE_AUDIT_LIMIT, getAuditUsage } from '@/lib/audit-quota'
import { extensionCorsHeaders, extensionOptions } from '@/lib/extension-cors'

const pageAuditSchema = z.object({
	url: z.string().url(),
	title: z.string(),
	metaDescription: z.string().nullable(),
	canonicalUrl: z.string().nullable(),
	openGraph: z.object({
		title: z.string().nullable(),
		image: z.string().nullable(),
		description: z.string().nullable(),
	}),
	jsonLd: z.array(
		z.object({
			raw: z.string(),
			parsed: z.unknown().nullable(),
		})
	),
	analytics: z.object({
		googleTagManager: z.boolean(),
		googleAnalytics4: z.boolean(),
		metaPixel: z.boolean(),
		tiktokPixel: z.boolean(),
		hubspot: z.boolean(),
	}),
	missingCriticalElements: z.object({
		total: z.number(),
		missingAltTextImages: z.number(),
		missingH1: z.boolean(),
		missingMetaDescription: z.boolean(),
	}),
})

const aiResultSchema = z.object({
	overall_score: z.number().min(0).max(100),
	flaws_found: z.array(z.string()),
	video_script: z.string(),
	quick_summary: z.string(),
})

type AiResult = z.infer<typeof aiResultSchema>

const SYSTEM_PROMPT = `You are a blunt, expert website auditor working for a digital marketing agency that pitches cold leads. \
Given structured metadata scraped from a prospect's website, you must:
1. Score the site's overall marketing/technical health from 0-100 (overall_score).
2. List the concrete flaws you found (flaws_found), e.g. missing meta description, no analytics tracking, missing alt text, no schema markup, weak SEO tags, etc.
3. Write a 60-second cold pitch video script (video_script) formatted in Markdown with exactly these sections, in order: [Hook], [The Problem], [The Solution], [Call to Action]. Keep it conversational, punchy, and speakable in ~60 seconds.
4. Write a 2-3 sentence quick_summary of the audit for an internal dashboard.

Respond ONLY with a single JSON object with exactly these keys: overall_score (number), flaws_found (string array), video_script (string), quick_summary (string). Do not include any other keys or commentary.`

function respond(request: NextRequest, body: unknown, status: number) {
	return NextResponse.json(body, {
		status,
		headers: extensionCorsHeaders(request, 'POST, OPTIONS'),
	})
}

function createMockAuditResult(pageAudit: z.infer<typeof pageAuditSchema>): AiResult {
	const findings: string[] = []
	const nextSteps: string[] = []
	let score = 100

	if (!pageAudit.analytics.googleAnalytics4) {
		findings.push('Google Analytics 4 is not detected')
		nextSteps.push('Add GA4 and verify key events so campaign traffic can be tied to leads.')
		score -= 9
	}
	if (!pageAudit.analytics.metaPixel) {
		findings.push('Meta Pixel is not detected')
		nextSteps.push('Install the Meta Pixel and configure conversion events for paid campaigns.')
		score -= 9
	}
	if (!pageAudit.analytics.googleTagManager) {
		findings.push('Google Tag Manager is not detected')
		nextSteps.push('Use a tag manager to keep analytics and advertising tags easier to maintain.')
		score -= 5
	}
	if (!pageAudit.analytics.tiktokPixel) {
		findings.push('TikTok Pixel is not detected')
		score -= 3
	}
	if (!pageAudit.analytics.hubspot) {
		findings.push('HubSpot tracking is not detected')
		score -= 2
	}
	if (!pageAudit.metaDescription) {
		findings.push('The page is missing a meta description')
		nextSteps.push('Write a concise search snippet that explains the offer and gives visitors a reason to click.')
		score -= 12
	}
	if (pageAudit.missingCriticalElements.missingH1) {
		findings.push('The page has no H1 heading')
		nextSteps.push('Add one descriptive H1 so visitors and search engines can identify the page topic.')
		score -= 12
	}
	if (pageAudit.missingCriticalElements.missingAltTextImages > 0) {
		findings.push(`${pageAudit.missingCriticalElements.missingAltTextImages} images are missing alt text`)
		nextSteps.push('Add concise, descriptive alt text to meaningful images for accessibility and context.')
		score -= Math.min(pageAudit.missingCriticalElements.missingAltTextImages * 2, 12)
	}
	if (pageAudit.jsonLd.length === 0) {
		findings.push('No structured data is detected')
		nextSteps.push('Add relevant structured data to make eligible business details clearer to search engines.')
		score -= 8
	}
	if (!pageAudit.canonicalUrl) {
		findings.push('No canonical URL is declared')
		score -= 4
	}
	if (!pageAudit.openGraph.image) {
		findings.push('No social sharing image is configured')
		nextSteps.push('Set an Open Graph image so shared links have a clear, branded preview.')
		score -= 4
	}

	const subject = pageAudit.title || new URL(pageAudit.url).hostname
	const leadFinding = findings[0] || 'the page has a solid technical baseline'
	const recommendation = nextSteps[0] || 'review the conversion journey and test how well the page turns visits into enquiries'
	const summary = findings.length
		? `${findings.length} potential improvement${findings.length === 1 ? '' : 's'} were identified. The strongest starting point is to address ${leadFinding.toLowerCase()}.`
		: 'No major tracking or metadata gaps were detected. A conversion review can identify opportunities beyond this technical scan.'

	return {
		overall_score: Math.max(35, score),
		flaws_found: findings.length ? findings : ['No high-impact tracking or metadata gaps detected'],
		video_script: [
			`[Hook]\nI took a quick look at ${subject} and noticed ${leadFinding.toLowerCase()}.`,
			`[The Problem]\n${recommendation} Without clear measurement and a focused page, it is harder to see which marketing efforts are creating real enquiries.`,
			`[The Solution]\nOur team can help close those gaps, improve the measurement setup, and make the page work harder for your next campaign.`,
			`[Call to Action]\nWould you be open to a short conversation this week about a few practical improvements?`,
		].join('\n\n'),
		quick_summary: summary,
	}
}

export function OPTIONS(request: NextRequest) {
	return extensionOptions(request, 'POST, OPTIONS')
}

export async function POST(request: NextRequest) {
	try {
		return await handleAudit(request)
	} catch (err: any) {
		console.error('Audit route crashed:', err)
		return respond(request, { error: err?.message || 'Audit generation failed' }, 500)
	}
}

async function handleAudit(request: NextRequest) {
	const authHeader = request.headers.get('authorization')
	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

	if (!token) {
		return respond(request, { error: 'Missing bearer token' }, 401)
	}

	const supabase = createSupabaseServiceClient()
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser(token)

	if (authError || !user) {
		return respond(request, { error: 'Invalid or expired session' }, 401)
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return respond(request, { error: 'Invalid JSON body' }, 400)
	}

	const parsedAudit = pageAuditSchema.safeParse(body)
	if (!parsedAudit.success) {
		return respond(request, { error: 'Invalid audit payload', details: parsedAudit.error.flatten() }, 400)
	}
	const pageAudit = parsedAudit.data

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('is_subscribed')
		.eq('id', user.id)
		.maybeSingle()

	if (profileError) {
		return respond(request, { error: 'Failed to load profile' }, 500)
	}

	const isSubscribed = profile?.is_subscribed === true
	let freeAuditsRemaining: number | null = null

	if (!isSubscribed) {
		const usage = await getAuditUsage(supabase, user.id)
		if (usage.error) return respond(request, { error: 'Failed to check free audit limit' }, 500)
		freeAuditsRemaining = usage.remaining
		if (freeAuditsRemaining <= 0) {
			return respond(
				request,
				{
					error: `You have used all ${FREE_AUDIT_LIMIT} free audits. Upgrade to Pro for unlimited audits.`,
					code: 'FREE_AUDIT_LIMIT_REACHED',
					free_audits_remaining: 0,
				},
				402
			)
		}
	}

	const useMockAudit = process.env.AUDIT_MOCK_MODE === 'true' || process.env.NODE_ENV !== 'production'
	let result: AiResult

	if (useMockAudit) {
		result = createMockAuditResult(pageAudit)
	} else {
		if (!process.env.GEMINI_API_KEY) {
			return respond(request, { error: 'Missing GEMINI_API_KEY in environment' }, 500)
		}
		const openai = new OpenAI({
			apiKey: process.env.GEMINI_API_KEY,
			baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
		})
		let completion
		try {
			completion = await openai.chat.completions.create({
				model: 'gemini-1.5-flash',
				response_format: { type: 'json_object' },
				temperature: 0.7,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: JSON.stringify(pageAudit) },
				],
			})
		} catch (error) {
			const upstreamStatus =
				error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
					? error.status
					: undefined

			if (upstreamStatus === 401) {
				return respond(
					request,
					{
						error: 'The AI service rejected its API key. Update GEMINI_API_KEY in web/.env.local and restart the web server.',
						code: 'OPENAI_AUTH_FAILED',
					},
					503
				)
			}

			if (upstreamStatus === 429) {
				return respond(
					request,
					{
						error: 'The AI service rate or usage limit was reached. Check your Gemini usage and limits.',
						code: 'OPENAI_LIMIT_REACHED',
					},
					503
				)
			}

			console.error('Gemini request failed:', error)
			const detail = error instanceof Error ? error.message : 'Failed to generate audit'
			return respond(request, { error: `Failed to generate audit: ${detail}` }, 502)
		}

		const rawContent = completion.choices[0]?.message?.content
		if (!rawContent) {
			return respond(request, { error: 'Empty response from AI' }, 502)
		}

		let parsedContent: unknown
		try {
			parsedContent = JSON.parse(rawContent)
		} catch {
			return respond(request, { error: 'AI returned malformed JSON' }, 502)
		}

		const parsedResult = aiResultSchema.safeParse(parsedContent)
		if (!parsedResult.success) {
			return respond(request, { error: 'AI response failed validation', details: parsedResult.error.flatten() }, 502)
		}
		result = parsedResult.data
	}

	if (!isSubscribed) {
		const latestUsage = await getAuditUsage(supabase, user.id)
		if (latestUsage.error) return respond(request, { error: 'Failed to check free audit limit' }, 500)
		if (latestUsage.remaining <= 0) {
			return respond(
				request,
				{
					error: `You have used all ${FREE_AUDIT_LIMIT} free audits. Upgrade to Pro for unlimited audits.`,
					code: 'FREE_AUDIT_LIMIT_REACHED',
					free_audits_remaining: 0,
				},
				402
			)
		}
		freeAuditsRemaining = latestUsage.remaining - 1
	}

	const { data: savedAudit, error: insertError } = await supabase
		.from('audits')
		.insert({
			user_id: user.id,
			url: pageAudit.url,
			page_audit: pageAudit,
			overall_score: result.overall_score,
			flaws_found: result.flaws_found,
			video_script: result.video_script,
			quick_summary: result.quick_summary,
		})
		.select()
		.single()

	if (insertError) {
		return respond(request, { error: 'Failed to save audit' }, 500)
	}

	return respond(
		request,
		{
			id: savedAudit.id,
			overall_score: result.overall_score,
			flaws_found: result.flaws_found,
			video_script: result.video_script,
			quick_summary: result.quick_summary,
			is_subscribed: isSubscribed,
			free_audits_remaining: isSubscribed ? null : freeAuditsRemaining,
			mocked: useMockAudit,
		},
		200
	)
}
