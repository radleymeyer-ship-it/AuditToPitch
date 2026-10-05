import { useEffect, useState, type CSSProperties } from 'react'
import { Check, ChevronRight, CircleAlert, Copy, Download, FileText, LockKeyhole, Pause, Play, RotateCcw, ScanLine, ShieldCheck, Sparkles } from 'lucide-react'
import type { PageAudit } from './types'
import { loadExtensionAccount, type ExtensionSession } from './account'
import './App.css'

type PopupProps = {
  onAccountClick?: () => void
}

type AuditResponse = { type: 'PAGE_AUDIT_RESULT'; data: PageAudit }
type AuditPdfExporter = typeof import('./utils/auditPdf').downloadAuditPdf
type AuditPdfLogoLoader = typeof import('./utils/auditPdf').loadAuditLogo
type GeneratedAudit = {
  overall_score: number
  flaws_found: string[]
  video_script: string
  quick_summary: string
  recommended_actions?: string[]
  free_audits_remaining: number | null
  mocked: boolean
}
type AccountState = 'checking' | 'signed-out' | 'unsubscribed' | 'subscribed' | 'error'

const loadingMessages = ['Scanning DOM...', 'Detecting Pixels...', 'Generating Pitch Script...']

function buildScript(audit: PageAudit): string {
  const title = audit.title || 'this page'
  const issues = [
    audit.missingCriticalElements.missingMetaDescription && 'a missing meta description',
    audit.missingCriticalElements.missingH1 && 'a missing H1 heading',
    audit.missingCriticalElements.missingAltTextImages > 0 && `${audit.missingCriticalElements.missingAltTextImages} images without alt text`,
    audit.jsonLd.length === 0 && 'no structured data',
  ].filter(Boolean)

  if (issues.length === 0) {
    return `We took a closer look at ${title}. The technical foundation is in good shape, with the key search signals and structured data in place. That gives your content a stronger chance to stand out in search and social previews.`
  }

  return `We took a closer look at ${title} and found a few opportunities worth fixing: ${issues.join(', ')}. These small technical gaps can make it harder for search engines and social platforms to understand and showcase your page. A focused cleanup could make this page work harder for your business.`
}

function getScore(audit: PageAudit): number {
  const penalties = audit.missingCriticalElements.total * 9 + (audit.jsonLd.length === 0 ? 12 : 0)
  return Math.max(0, Math.min(100, 100 - penalties))
}

function getMissingBadges(audit: PageAudit): string[] {
  const badges: string[] = []
  if (!audit.analytics.metaPixel) badges.push('Missing Meta Pixel')
  if (audit.jsonLd.length === 0) badges.push('No JSON-LD Schema')
  if (!audit.analytics.googleAnalytics4) badges.push('Missing GA4')
  if (!audit.analytics.googleTagManager) badges.push('Missing GTM')
  if (!audit.analytics.tiktokPixel) badges.push('Missing TikTok Pixel')
  if (!audit.analytics.hubspot) badges.push('Missing HubSpot')
  if (audit.missingCriticalElements.missingMetaDescription) badges.push('Missing Meta Description')
  if (audit.missingCriticalElements.missingH1) badges.push('No H1 Heading')
  if (audit.missingCriticalElements.missingAltTextImages > 0) badges.push(`${audit.missingCriticalElements.missingAltTextImages} Images Missing Alt`)
  return badges
}

// Tracking gaps are amber; on-page SEO gaps are red.
function isAmberFlag(flag: string): boolean {
  return /pixel|ga4|gtm|tag manager|analytics|hubspot|tiktok|tracking|canonical|social|sharing/i.test(flag)
}

function getHost(url?: string): string {
  if (!url) return 'Current browser tab'
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function ScoreDonut({ score }: { score: number }) {
  const color = score >= 80 ? '#0f9f5c' : score >= 60 ? '#ffb23e' : '#ff5468'
  const style = { '--p': score, '--c': color } as CSSProperties

  return <div className="donut" data-n={score} style={style} role="img" aria-label={`Page health score: ${score} out of 100`} />
}

function App({ onAccountClick }: PopupProps) {
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null)
  const [audit, setAudit] = useState<PageAudit | null>(null)
  const [generatedAudit, setGeneratedAudit] = useState<GeneratedAudit | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [accountState, setAccountState] = useState<AccountState>('checking')
  const [session, setSession] = useState<ExtensionSession | null>(null)
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  const [freeAuditsRemaining, setFreeAuditsRemaining] = useState(0)
  const [accountError, setAccountError] = useState('')
  const [accountRetry, setAccountRetry] = useState(0)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [auditPdfExporter, setAuditPdfExporter] = useState<AuditPdfExporter | null>(null)
  const [auditPdfLogo, setAuditPdfLogo] = useState<string | null>(null)
  const [isLoadingPdfEngine, setIsLoadingPdfEngine] = useState(false)

  useEffect(() => {
    let isMounted = true

    void loadExtensionAccount()
      .then((account) => {
        if (!isMounted) return
        if (!account) {
          setSession(null)
          setIsSubscribed(null)
          setAccountState('signed-out')
          return
        }

        setSession(account.session)
        setIsSubscribed(account.isSubscribed)
        setFreeAuditsRemaining(account.freeAuditsRemaining ?? 0)
        setAccountState(account.isSubscribed ? 'subscribed' : 'unsubscribed')
      })
      .catch(() => {
        if (!isMounted) return
        setAccountError('Could not verify your account. Check your connection and retry.')
        setAccountState('error')
      })

    return () => {
      isMounted = false
    }
  }, [accountRetry])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return

    const onStorageChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.auditToPitchPendingSession?.newValue) {
        setAccountError('')
        setAccountState('checking')
        setAccountRetry((retry) => retry + 1)
      }
    }

    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [])

  const saveAudit = async (pageAudit: PageAudit) => {
    if (!session) {
      setAccountState('signed-out')
      setLoading(false)
      return
    }

    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 'http://127.0.0.1:3000'
      const response = await fetch(new URL('/api/audit', siteUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pageAudit),
      })
      const result = (await response.json()) as GeneratedAudit & { error?: string; code?: string }

      if (response.status === 401) {
        setSession(null)
        setIsSubscribed(null)
        setAccountState('signed-out')
        setError('Your session expired. Sign in again to continue.')
        return
      }

      if (response.status === 402 && result.code === 'FREE_AUDIT_LIMIT_REACHED') {
        setFreeAuditsRemaining(0)
        setError(result.error || 'Your 3 free audits are used. Upgrade to Pro for unlimited audits.')
        return
      }

      if (!response.ok) throw new Error(result.error || 'Could not complete this audit.')

      setAudit(pageAudit)
      setGeneratedAudit(result)
      if (result.free_audits_remaining !== null) {
        setFreeAuditsRemaining(result.free_audits_remaining)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not complete this audit. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([currentTab]) => {
      setActiveTab(currentTab ?? null)
    })
  }, [])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
  }, [])

  const runAudit = () => {
    if (loading || !session || (!isSubscribed && freeAuditsRemaining <= 0)) return
    if (!activeTab?.id || typeof chrome === 'undefined' || !chrome.tabs) {
      setError('This tab cannot be audited. Open a regular webpage and try again.')
      return
    }

    setLoading(true)
    setError('')
    setLoadingStep(0)
    const interval = window.setInterval(() => {
      setLoadingStep((step) => Math.min(step + 1, loadingMessages.length - 1))
    }, 700)

    try {
      chrome.tabs.sendMessage(activeTab.id, { type: 'RUN_PAGE_AUDIT' }, (response: AuditResponse | undefined) => {
        const deliveryError = chrome.runtime.lastError
        window.clearInterval(interval)

        if (deliveryError || response?.type !== 'PAGE_AUDIT_RESULT' || !response.data) {
          setLoading(false)
          setError('Could not reach the page scanner. Reload this page and try again.')
          return
        }

        void saveAudit(response.data)
      })
    } catch {
      window.clearInterval(interval)
      setLoading(false)
      setError('Could not start the page scan. Try reloading this page.')
    }
  }

  const startUpgrade = async () => {
    if (!session) {
      onAccountClick?.()
      return
    }

    setIsUpgrading(true)
    setError('')
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 'http://127.0.0.1:3000'
      const response = await fetch(new URL('/api/checkout', siteUrl), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) throw new Error(data.error || 'Could not start checkout.')

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        void chrome.tabs.create({ url: data.url })
      } else {
        window.location.assign(data.url)
      }
    } catch {
      setError('Could not start checkout. Please try again.')
    } finally {
      setIsUpgrading(false)
    }
  }

  const pitchScript = generatedAudit?.video_script || (audit ? buildScript(audit) : '')
  const reportFindings = generatedAudit?.flaws_found ?? (audit ? getMissingBadges(audit) : [])
  const reportScore = generatedAudit?.overall_score ?? (audit ? getScore(audit) : 0)

  const toggleVoicePreview = () => {
    if (!pitchScript) return
    if (typeof window.speechSynthesis === 'undefined') {
      setError('Voice preview is not available in this browser.')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(pitchScript)
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.startsWith('en'))
    if (voice) utterance.voice = voice
    utterance.rate = 0.96
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => {
      setIsSpeaking(false)
      setError('Voice preview could not be played. Try again.')
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
    setError('')
  }

  const loadPdfEngine = () => {
    if (auditPdfExporter || isLoadingPdfEngine) return

    setIsLoadingPdfEngine(true)
    void import('./utils/auditPdf')
      .then(async ({ downloadAuditPdf, loadAuditLogo }) => {
        const logoDataUrl = await (loadAuditLogo as AuditPdfLogoLoader)()
        setAuditPdfLogo(logoDataUrl)
        setAuditPdfExporter(() => downloadAuditPdf)
      })
      .catch(() => setError('Could not load the PDF exporter. Please try again.'))
      .finally(() => setIsLoadingPdfEngine(false))
  }

  // The PDF engine is loaded as soon as results appear so the download button is ready.
  useEffect(() => {
    if (audit) loadPdfEngine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit])

  const exportPdf = () => {
    if (!audit) return
    if (!auditPdfExporter) {
      setError('PDF exporter is still loading. Please try again.')
      return
    }
    try {
      auditPdfExporter({
        audit,
        score: reportScore,
        findings: reportFindings,
        recommendations: generatedAudit?.recommended_actions,
        quickSummary: generatedAudit?.quick_summary || 'Audit summary is not available.',
        pitchScript,
        logoDataUrl: auditPdfLogo,
      })
      setError('')
    } catch {
      setError('Could not generate the PDF. Please try again.')
    }
  }

  const copyScript = async () => {
    if (!pitchScript) return
    try {
      await navigator.clipboard.writeText(pitchScript)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Clipboard access is unavailable in this window.')
    }
  }

  const missingBadges = audit ? getMissingBadges(audit) : []
  const displayedBadges = generatedAudit?.flaws_found.length ? generatedAudit.flaws_found : missingBadges
  const needsAccount = accountState === 'signed-out' || accountState === 'unsubscribed'
  const verdict = reportScore >= 80 ? 'Good foundation' : reportScore >= 60 ? 'Room to improve' : 'Needs attention'
  const planLabel = accountState === 'checking'
    ? 'Checking'
    : isSubscribed
      ? 'Pro'
      : accountState === 'unsubscribed'
        ? `Free · ${freeAuditsRemaining} left`
        : 'Free'

  return (
    <div className="audit-popup flex h-[500px] w-[380px] flex-col overflow-hidden text-ink">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel/80 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <img src="/brand-mark.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <span className="text-[15px] font-bold leading-none tracking-tight">AuditToPitch <span className="text-brand">Pro</span></span>
          </div>
          <p className="mt-1 truncate pl-9 text-[10px] text-muted" title={activeTab?.url}>{getHost(activeTab?.url)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${isSubscribed ? 'bg-mint text-[#03120a]' : 'border border-mint/50 text-brand'}`}>
          {planLabel}
        </span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {accountState === 'checking' ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5" aria-live="polite" aria-busy="true">
            <p className="text-[14px] font-semibold">Checking your account...</p>
            <p className="mt-1 text-[11px] text-muted">Loading your plan status.</p>
          </section>
        ) : accountState === 'error' ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5" role="alert">
            <p className="text-[14px] font-semibold">Account status unavailable</p>
            <p className="mt-1 text-[11px] text-muted">{accountError}</p>
            <button type="button" onClick={() => { setAccountError(''); setAccountState('checking'); setAccountRetry((retry) => retry + 1) }} className="mt-4 h-10 rounded-full border border-line text-xs font-semibold text-ink hover:border-mint">Retry</button>
          </section>
        ) : accountState === 'signed-out' ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-mint/20 bg-mint/10 text-brand"><LockKeyhole size={18} /></div>
            <p className="mt-4 text-[14px] font-semibold">Sign in to your workspace</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Connect your AuditToPitch account to check your plan and run audits.</p>
          </section>
        ) : accountState === 'unsubscribed' && freeAuditsRemaining <= 0 && !audit ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-mint/20 bg-mint/10 text-brand"><ShieldCheck size={18} /></div>
            <p className="mt-4 text-[14px] font-semibold">Your 3 free audits are used</p>
            <p className="mt-1 truncate text-[11px] text-muted">Signed in as {session?.user.email || 'your account'}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">Upgrade to Pro for unlimited audits and tailored pitch scripts.</p>
            {error && <p className="mt-3 text-[10px] text-alert" role="alert">{error}</p>}
          </section>
        ) : loading ? (
          <section className="flex min-h-0 flex-1 flex-col px-4 py-4" aria-live="polite" aria-busy="true">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-mint/30 bg-mint/10 text-brand"><Sparkles size={17} /></span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Scanning your prospect</p>
                <p className="mt-0.5 truncate text-[11px] text-muted">{activeTab?.title || 'Current tab'}</p>
              </div>
            </div>
            <div className="scan-window mb-4" aria-hidden="true">
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-line" />
                <span className="ml-2 truncate rounded-full bg-raised px-3 py-0.5">{getHost(activeTab?.url)}</span>
              </div>
              <div className="mt-4 h-3 w-3/5 rounded bg-raised" />
              <div className="mt-2.5 h-3 w-2/5 rounded bg-raised" />
              <div className="mt-2.5 h-3 w-1/2 rounded bg-raised" />
              <div className="scan-line" />
            </div>
            <div className="space-y-2">
              {loadingMessages.map((message, index) => (
                <div key={message} className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 transition-colors ${index === loadingStep ? 'bg-mint/10 text-brand' : 'text-muted'}`}>
                  {index < loadingStep ? <Check size={14} /> : <span className={`h-3.5 w-3.5 rounded-full border ${index === loadingStep ? 'animate-pulse border-mint bg-mint/30' : 'border-line'}`} />}
                  <span className="text-[12px] font-medium">{message}</span>
                </div>
              ))}
            </div>
          </section>
        ) : audit ? (
          <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">
            <div className="flex shrink-0 items-center justify-between">
              <div className="min-w-0 pr-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Audit results</p>
                <p className="mt-0.5 truncate text-[13px] font-semibold">{audit.title || 'Untitled page'}</p>
              </div>
              <button type="button" onClick={() => { setAudit(null); setError('') }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-muted transition hover:bg-raised hover:text-ink" aria-label="Start a new audit" title="New audit"><RotateCcw size={15} /></button>
            </div>

            <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-3">
              <ScoreDonut score={reportScore} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold leading-tight">{verdict}</p>
                <p className="mt-1 text-[11px] leading-[1.45] text-muted">{audit.missingCriticalElements.total} critical {audit.missingCriticalElements.total === 1 ? 'item' : 'items'} need attention</p>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-line bg-panel px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Audit flags</p>
              <div className="flex flex-wrap gap-1.5">
                {displayedBadges.length > 0 ? displayedBadges.map((badge) => (
                  <span key={badge} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium ${isAmberFlag(badge) ? 'border-amber/40 bg-amber/10 text-amber' : 'border-alert/40 bg-alert/10 text-alert'}`}><CircleAlert size={11} />{badge}</span>
                )) : <span className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-medium text-brand"><Check size={11} />No missing signals found</span>}
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-mint/40 bg-raised px-4 py-3">
              <p className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                <span>AI pitch script</span>
                {generatedAudit?.mocked && <span className="rounded-full border border-amber/40 px-2 py-0.5 text-amber">Demo result</span>}
              </p>
              <p className="max-h-[96px] overflow-y-auto text-[12px] leading-[1.6] text-ink/85">{pitchScript}</p>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={copyScript} className="inline-flex h-[32px] flex-1 items-center justify-center gap-1.5 rounded-full border border-mint/50 text-[11px] font-semibold text-brand transition hover:bg-mint hover:text-[#03120a]" aria-label="Copy pitch script">
                  {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy script'}
                </button>
                <button type="button" onClick={toggleVoicePreview} className="inline-flex h-[32px] flex-1 items-center justify-center gap-1.5 rounded-full border border-line text-[11px] font-semibold text-ink transition hover:border-mint">
                  {isSpeaking ? <Pause size={13} /> : <Play size={12} />}{isSpeaking ? 'Stop voice' : 'Play voice'}
                </button>
              </div>
            </div>

            <button type="button" onClick={exportPdf} disabled={isLoadingPdfEngine || !auditPdfExporter} className="inline-flex h-[42px] w-full shrink-0 items-center justify-center gap-2 rounded-[14px] bg-mint px-4 text-[12px] font-bold text-[#03120a] shadow-[0_0_24px_rgb(28_240_140/35%)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:cursor-wait disabled:opacity-70">
              <Download size={14} />{isLoadingPdfEngine ? 'Preparing PDF...' : 'Download White-Labeled PDF'}
            </button>
            {error && <p className="text-[10px] text-alert" role="alert">{error}</p>}
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">Ready when you are</p>
              <p className="mt-1.5 text-[20px] font-bold leading-tight tracking-tight">Audit any site<br /><span className="inline-block rounded-xl bg-[#03120a] px-2.5 py-0.5 text-mint">in 10 seconds.</span></p>
            </div>

            <div className="mb-3 flex min-h-[58px] items-center gap-3 rounded-2xl border border-line bg-panel px-3.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-raised text-muted"><FileText size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">{activeTab?.title || 'Loading active tab...'}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{getHost(activeTab?.url)}</p>
              </div>
              <ChevronRight size={15} className="shrink-0 text-muted" />
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              {['Metadata', 'Pixels', 'Schema'].map((item, index) => (
                <div key={item} className="flex h-[48px] flex-col justify-center rounded-xl border border-line bg-panel px-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">0{index + 1}</span>
                  <span className="mt-0.5 text-[11px] font-medium text-ink">{item}</span>
                </div>
              ))}
            </div>

            {!isSubscribed && accountState === 'unsubscribed' && <p className="mb-2 text-[10px] font-medium text-brand">{freeAuditsRemaining} free {freeAuditsRemaining === 1 ? 'audit' : 'audits'} remaining</p>}

            <button type="button" onClick={runAudit} disabled={loading || !activeTab || (!isSubscribed && freeAuditsRemaining <= 0)} className="mt-auto flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-mint text-[13px] font-bold text-[#03120a] shadow-[0_0_28px_rgb(28_240_140/40%)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
              <ScanLine size={16} />Run 10-Second Audit
            </button>
            {error && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-alert" role="alert"><CircleAlert size={12} />{error}</p>}
          </section>
        )}
      </main>

      {needsAccount && (
        <footer className="flex h-[49px] shrink-0 items-center justify-between border-t border-line bg-panel px-4">
          <span className="flex items-center gap-1.5 text-[10px] text-muted"><LockKeyhole size={12} />{accountState === 'signed-out' ? 'Connect your account' : `${freeAuditsRemaining} free left`}</span>
          <button type="button" onClick={accountState === 'signed-out' ? onAccountClick : startUpgrade} disabled={isUpgrading} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand transition hover:text-ink focus-visible:underline disabled:cursor-wait disabled:opacity-60">{accountState === 'signed-out' ? 'Sign In' : isUpgrading ? 'Opening checkout...' : 'Upgrade to Pro'}<ChevronRight size={13} /></button>
        </footer>
      )}
    </div>
  )
}

export default App
