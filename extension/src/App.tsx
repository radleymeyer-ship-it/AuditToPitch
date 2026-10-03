import { useEffect, useState } from 'react'
import { Check, ChevronRight, CircleAlert, Copy, Download, FileText, LockKeyhole, Pause, Play, RotateCcw, ScanLine, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import type { PageAudit } from './types'
import { loadExtensionAccount, type ExtensionSession } from './account'
import './App.css'

type PopupProps = {
  onAccountClick?: () => void
}

type PopupTab = 'voice' | 'summary'
type AuditResponse = { type: 'PAGE_AUDIT_RESULT'; data: PageAudit }
type AuditPdfExporter = typeof import('./utils/auditPdf').downloadAuditPdf
type AuditPdfLogoLoader = typeof import('./utils/auditPdf').loadAuditLogo
type GeneratedAudit = {
  overall_score: number
  flaws_found: string[]
  video_script: string
  quick_summary: string
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

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 39

  return (
    <div className="relative h-[100px] w-[100px] shrink-0" role="img" aria-label={`Page health score: ${score} out of 100`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="39" fill="none" stroke="#1c3629" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="39"
          fill="none"
          stroke={score >= 75 ? '#00f5a0' : score >= 45 ? '#c3ff6b' : '#ff8066'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-ink">
        <span className="text-[27px] font-semibold leading-none tracking-normal">{score}</span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">health</span>
      </div>
    </div>
  )
}

function App({ onAccountClick }: PopupProps) {
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null)
  const [audit, setAudit] = useState<PageAudit | null>(null)
  const [generatedAudit, setGeneratedAudit] = useState<GeneratedAudit | null>(null)
  const [tab, setTab] = useState<PopupTab>('voice')
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
      setTab('voice')
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

  const openPdfSummary = () => {
    setTab('summary')
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

  return (
    <div className="audit-popup flex h-[500px] w-[380px] flex-col overflow-hidden text-ink">
      <header className="flex h-[58px] shrink-0 items-center justify-between border-b border-line bg-panel/90 px-5">
        <div className="flex items-center gap-2.5">
          <img src="/brand-wordmark.png" alt="AuditToPitch Pro" width={180} height={36} className="h-auto w-[150px] shrink-0 object-contain object-left" />
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.11em] ${isSubscribed ? 'text-mint-light' : 'text-muted'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isSubscribed ? 'bg-mint shadow-[0_0_8px_var(--mint)]' : 'bg-muted'}`} />
          {accountState === 'checking'
            ? 'Checking'
            : isSubscribed
              ? 'Pro active'
              : accountState === 'unsubscribed'
                ? `${freeAuditsRemaining} free left`
                : 'Page audit'}
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
            <button type="button" onClick={() => { setAccountError(''); setAccountState('checking'); setAccountRetry((retry) => retry + 1) }} className="mt-4 h-10 rounded-full border border-line text-xs font-semibold text-ink hover:border-brand">Retry</button>
          </section>
        ) : accountState === 'signed-out' ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-mint/20 bg-mint/10 text-mint-light"><LockKeyhole size={18} /></div>
            <p className="mt-4 text-[14px] font-semibold">Sign in to your workspace</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Connect your AuditToPitch account to check your plan and run audits.</p>
          </section>
        ) : accountState === 'unsubscribed' && freeAuditsRemaining <= 0 && !audit ? (
          <section className="flex min-h-0 flex-1 flex-col justify-center px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-mint/20 bg-mint/10 text-mint-light"><ShieldCheck size={18} /></div>
            <p className="mt-4 text-[14px] font-semibold">Your 3 free audits are used</p>
            <p className="mt-1 truncate text-[11px] text-muted">Signed in as {session?.user.email || 'your account'}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">Upgrade to Pro for unlimited audits and tailored pitch scripts.</p>
            {error && <p className="mt-3 text-[10px] text-alert" role="alert">{error}</p>}
          </section>
        ) : loading ? (
          <section className="flex min-h-0 flex-1 flex-col px-5 py-5" aria-live="polite" aria-busy="true">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-mint/20 bg-mint/10 text-mint-light"><Sparkles size={17} /></span>
              <div>
                <p className="text-[14px] font-semibold">Building your audit</p>
                <p className="mt-0.5 max-w-[285px] truncate text-[11px] text-muted">{activeTab?.title || 'Current tab'}</p>
              </div>
            </div>
            <div className="mb-4 h-[90px] animate-pulse rounded-[8px] border border-line bg-panel p-4">
              <div className="h-3 w-24 rounded bg-raised" />
              <div className="mt-4 h-2.5 w-full rounded bg-raised" />
              <div className="mt-2 h-2.5 w-4/5 rounded bg-raised" />
            </div>
            <div className="space-y-2.5">
              {loadingMessages.map((message, index) => (
                <div key={message} className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 transition-colors ${index === loadingStep ? 'bg-mint/10 text-mint-light' : 'text-muted'}`}>
                  {index < loadingStep ? <Check size={14} /> : <span className={`h-3.5 w-3.5 rounded-full border ${index === loadingStep ? 'animate-pulse border-mint bg-mint/30' : 'border-line'}`} />}
                  <span className="text-[12px] font-medium">{message}</span>
                </div>
              ))}
            </div>
          </section>
        ) : audit ? (
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
              <div className="min-w-0 pr-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Audit results</p>
                <p className="mt-1 truncate text-[13px] font-semibold">{audit.title || 'Untitled page'}</p>
              </div>
              <button type="button" onClick={() => { setAudit(null); setError('') }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-muted transition hover:bg-raised hover:text-ink" aria-label="Start a new audit" title="New audit"><RotateCcw size={15} /></button>
            </div>

            <div className="mx-5 flex shrink-0 items-center gap-4 rounded-[8px] border border-line bg-panel px-4 py-3">
              <ScoreGauge score={generatedAudit?.overall_score ?? getScore(audit)} />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[18px] font-semibold leading-tight">{(generatedAudit?.overall_score ?? getScore(audit)) >= 75 ? 'Good foundation' : (generatedAudit?.overall_score ?? getScore(audit)) >= 45 ? 'Room to improve' : 'Needs attention'}</p>
                <p className="mt-1 text-[11px] leading-[1.45] text-muted">{audit.missingCriticalElements.total} critical {audit.missingCriticalElements.total === 1 ? 'item' : 'items'} need attention</p>
              </div>
              <ShieldCheck className="shrink-0 text-mint-light" size={19} />
            </div>

            <div className="mx-5 mt-3 flex min-h-[42px] shrink-0 flex-wrap content-start gap-1.5">
              {displayedBadges.length > 0 ? displayedBadges.slice(0, 5).map((badge) => (
                <span key={badge} className="inline-flex items-center gap-1 rounded-[5px] border border-alert/30 bg-alert/10 px-2 py-1 text-[10px] font-medium text-alert"><CircleAlert size={11} />{badge}</span>
              )) : <span className="inline-flex items-center gap-1 rounded-[5px] border border-mint/25 bg-mint/10 px-2 py-1 text-[10px] font-medium text-mint-light"><Check size={11} />No missing signals found</span>}
              {displayedBadges.length > 5 && <span className="self-center text-[10px] text-muted">+{displayedBadges.length - 5} more</span>}
            </div>

            <div className="mx-5 mt-3 grid shrink-0 grid-cols-2 rounded-t-[8px] border-b border-line bg-panel" role="tablist" aria-label="Audit output">
              <button type="button" role="tab" aria-selected={tab === 'voice'} onClick={() => setTab('voice')} className={`flex h-[38px] items-center justify-center gap-1.5 border-b-2 text-[11px] font-semibold transition ${tab === 'voice' ? 'border-mint text-mint-light' : 'border-transparent text-muted hover:text-ink'}`}><Volume2 size={13} />Voice Preview</button>
              <button type="button" role="tab" aria-selected={tab === 'summary'} onClick={openPdfSummary} className={`flex h-[38px] items-center justify-center gap-1.5 border-b-2 text-[11px] font-semibold transition ${tab === 'summary' ? 'border-mint text-mint-light' : 'border-transparent text-muted hover:text-ink'}`}><FileText size={13} />PDF Summary</button>
            </div>

            <div className="mx-5 min-h-0 flex-1 overflow-y-auto rounded-b-[8px] border-x border-b border-line bg-panel px-4 py-3.5" role="tabpanel">
              {tab === 'voice' ? (
                <>
                  <p className="mb-2 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                    <span>AI-written pitch</span>
                    {generatedAudit?.mocked && <span className="rounded border border-signal-lime/25 px-1.5 py-0.5 text-signal-lime">Demo result</span>}
                  </p>
                  <p className="mb-3 text-[10px] leading-relaxed text-muted">Spoken using a voice available in this browser.</p>
                  <p className="text-[12px] leading-[1.65] text-ink/85">{pitchScript}</p>
                </>
              ) : (
                <div className="space-y-2.5 text-[11px]">
                  <p className="mb-3 font-serif text-[16px] font-semibold">Audit summary</p>
                  <p className="mb-3 leading-relaxed text-ink/85">{generatedAudit?.quick_summary || 'Summary unavailable.'}</p>
                  <SummaryRow label="Health score" value={`${reportScore} / 100`} />
                  <SummaryRow label="Findings" value={String(reportFindings.length)} />
                  <SummaryRow label="Page title" value={audit.title || 'Not set'} />
                  <SummaryRow label="Meta description" value={audit.metaDescription ? 'Present' : 'Missing'} />
                  <SummaryRow label="Canonical URL" value={audit.canonicalUrl ? 'Present' : 'Missing'} />
                  <SummaryRow label="JSON-LD blocks" value={String(audit.jsonLd.length)} />
                  <SummaryRow label="Images missing alt" value={String(audit.missingCriticalElements.missingAltTextImages)} />
                  <SummaryRow label="Analytics detected" value={String(Object.values(audit.analytics).filter(Boolean).length)} />
                </div>
              )}
              {error && <p className="mt-3 text-[10px] text-alert" role="alert">{error}</p>}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-3 pt-2.5">
              {tab === 'voice' ? (
                <>
                  <button type="button" onClick={copyScript} className="flex h-[34px] w-[38px] items-center justify-center rounded-[7px] border border-line text-muted transition hover:bg-raised hover:text-ink" aria-label="Copy pitch script" title="Copy pitch script">
                    {copied ? <Check size={14} /> : <Copy size={13} />}
                  </button>
                  <button type="button" onClick={toggleVoicePreview} className="inline-flex h-[34px] flex-1 items-center justify-center gap-2 rounded-[7px] bg-mint px-3.5 text-[11px] font-bold text-[#03120a] transition hover:bg-mint-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
                    {isSpeaking ? <Pause size={14} /> : <Play size={13} />}
                    {isSpeaking ? 'Stop voice preview' : 'Play voice preview'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={exportPdf} disabled={isLoadingPdfEngine || !auditPdfExporter} className="inline-flex h-[34px] w-full items-center justify-center gap-2 rounded-[7px] bg-mint px-3.5 text-[11px] font-bold text-[#03120a] transition hover:bg-mint-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:cursor-wait disabled:opacity-70">
                  <Download size={14} />{isLoadingPdfEngine ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-mint/20 bg-mint/10 text-mint-light"><ScanLine size={20} /></div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-tight">Ready when you are</p>
                <p className="mt-1 text-[11px] text-muted">Review this page's marketing signals.</p>
              </div>
            </div>

            <div className="mb-4 flex min-h-[62px] items-center gap-3 rounded-[8px] border border-line bg-panel px-3.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-raised text-muted"><FileText size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">{activeTab?.title || 'Loading active tab...'}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{activeTab?.url ? new URL(activeTab.url).hostname : 'Current browser tab'}</p>
              </div>
              <ChevronRight size={15} className="shrink-0 text-muted" />
            </div>

            {!isSubscribed && accountState === 'unsubscribed' && <p className="-mt-2 mb-3 text-[10px] font-medium text-mint-light">{freeAuditsRemaining} free {freeAuditsRemaining === 1 ? 'audit' : 'audits'} remaining</p>}

            <div className="mb-4 grid grid-cols-3 gap-2">
              {['Metadata', 'Pixels', 'Schema'].map((item, index) => (
                <div key={item} className="flex h-[52px] flex-col justify-center rounded-[8px] border border-line bg-panel px-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">0{index + 1}</span>
                  <span className="mt-0.5 text-[11px] font-medium text-ink">{item}</span>
                </div>
              ))}
            </div>

            <button type="button" onClick={runAudit} disabled={loading || !activeTab || (!isSubscribed && freeAuditsRemaining <= 0)} className="mt-auto flex h-[43px] w-full items-center justify-center gap-2 rounded-[8px] bg-mint text-[12px] font-bold text-[#03120a] transition hover:bg-mint-light disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
              <ScanLine size={15} />Audit This Page
            </button>
            {error && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-alert" role="alert"><CircleAlert size={12} />{error}</p>}
          </section>
        )}
      </main>

      {needsAccount && (
        <footer className="flex h-[49px] shrink-0 items-center justify-between border-t border-line bg-panel px-5">
          <span className="flex items-center gap-1.5 text-[10px] text-muted"><LockKeyhole size={12} />{accountState === 'signed-out' ? 'Connect your account' : `${freeAuditsRemaining} free left`}</span>
          <button type="button" onClick={accountState === 'signed-out' ? onAccountClick : startUpgrade} disabled={isUpgrading} className="inline-flex items-center gap-1 text-[11px] font-semibold text-mint-light transition hover:text-ink focus-visible:underline disabled:cursor-wait disabled:opacity-60">{accountState === 'signed-out' ? 'Sign In' : isUpgrading ? 'Opening checkout...' : 'Upgrade to Pro'}<ChevronRight size={13} /></button>
        </footer>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-line pb-2"><span className="text-muted">{label}</span><span className="truncate text-right font-semibold text-ink">{value}</span></div>
}

export default App
