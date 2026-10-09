import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, ChevronRight, CircleAlert, Copy, Download, LockKeyhole, Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react'
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
const scanProgress = [18, 52, 88]
const FREE_AUDIT_TOTAL = 3

type IconProps = { size?: number; className?: string }

// Icon shapes copied from the popup.html design.
function PopupIcon({ size = 14, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

const TagIcon = (props: IconProps) => <PopupIcon {...props}><path d="M12 2H2v10l9.3 9.3a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7" cy="7" r="1.5" /></PopupIcon>
const PixelsIcon = (props: IconProps) => <PopupIcon {...props}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></PopupIcon>
const SchemaIcon = (props: IconProps) => <PopupIcon {...props}><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" /></PopupIcon>
const GlobeIcon = (props: IconProps) => <PopupIcon {...props}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20" /></PopupIcon>
const PdfIcon = (props: IconProps) => <PopupIcon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></PopupIcon>
const PlayIcon = (props: IconProps) => <PopupIcon {...props}><path d="M6 4l14 8-14 8z" /></PopupIcon>
const ScanPlayIcon = (props: IconProps) => <PopupIcon {...props}><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M10 9l5 3-5 3z" /></PopupIcon>
const SparkleIcon = (props: IconProps) => <PopupIcon {...props}><path d="M12 3q1 7 9 9q-8 2-9 9q-1-7-9-9q8-2 9-9z" /></PopupIcon>

const checkTiles = [
  { label: 'Metadata', hint: 'Titles, meta, OG', Icon: TagIcon },
  { label: 'Pixels', hint: 'GA4, Meta, GTM', Icon: PixelsIcon },
  { label: 'Schema', hint: 'Structured data', Icon: SchemaIcon },
]

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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceUri, setSelectedVoiceUri] = useState('')
  const [voicePreferenceLoaded, setVoicePreferenceLoaded] = useState(false)
  const [auditPdfExporter, setAuditPdfExporter] = useState<AuditPdfExporter | null>(null)
  const [auditPdfLogo, setAuditPdfLogo] = useState<string | null>(null)
  const [isLoadingPdfEngine, setIsLoadingPdfEngine] = useState(false)

  useEffect(() => {
    if (typeof window.speechSynthesis === 'undefined') return

    const updateVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith('en')))
    }
    const timeoutId = window.setTimeout(updateVoices, 0)
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get('auditToPitchVoiceUri', (result) => {
        setSelectedVoiceUri(typeof result.auditToPitchVoiceUri === 'string' ? result.auditToPitchVoiceUri : '')
        setVoicePreferenceLoaded(true)
      })
    } else {
      setVoicePreferenceLoaded(true)
    }

    return () => {
      window.clearTimeout(timeoutId)
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
    }
  }, [])

  useEffect(() => {
    if (!voicePreferenceLoaded || availableVoices.length === 0) return
    if (availableVoices.some((voice) => (voice.voiceURI || voice.name) === selectedVoiceUri)) return
    const preferredVoice = availableVoices.find((voice) => /natural|neural|premium|enhanced/i.test(voice.name))
      ?? availableVoices.find((voice) => voice.lang.toLowerCase().startsWith('en-us'))
      ?? availableVoices[0]
    const voiceUri = preferredVoice.voiceURI || preferredVoice.name
    setSelectedVoiceUri(voiceUri)
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ auditToPitchVoiceUri: voiceUri })
    }
  }, [availableVoices, selectedVoiceUri, voicePreferenceLoaded])

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

    const tabId = activeTab.id
    const requestAudit = (canInject: boolean) => {
      chrome.tabs.sendMessage(tabId, { type: 'RUN_PAGE_AUDIT' }, (response: AuditResponse | undefined) => {
        const deliveryError = chrome.runtime.lastError

        // Tabs opened before the extension was installed or reloaded have no scanner yet.
        if (deliveryError && canInject && chrome.scripting) {
          chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
            .then(() => requestAudit(false))
            .catch(() => failScan())
          return
        }

        if (deliveryError || response?.type !== 'PAGE_AUDIT_RESULT' || !response.data) {
          failScan()
          return
        }

        window.clearInterval(interval)
        void saveAudit(response.data)
      })
    }
    const failScan = () => {
      window.clearInterval(interval)
      setLoading(false)
      setError('Could not reach the page scanner. Reload this page and try again.')
    }

    try {
      requestAudit(true)
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

    const spokenScript = pitchScript.replace(/^\s{0,3}#{1,6}\s+/gm, '')
    const utterance = new SpeechSynthesisUtterance(spokenScript)
    const voice = availableVoices.find((candidate) => (candidate.voiceURI || candidate.name) === selectedVoiceUri)
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

  const selectVoice = (voiceUri: string) => {
    setSelectedVoiceUri(voiceUri)
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ auditToPitchVoiceUri: voiceUri })
    }
  }

  const missingBadges = audit ? getMissingBadges(audit) : []
  const displayedBadges = generatedAudit?.flaws_found.length ? generatedAudit.flaws_found : missingBadges
  const needsAccount = accountState === 'signed-out' || accountState === 'unsubscribed'
  const verdict = reportScore >= 80 ? 'Good foundation' : reportScore >= 60 ? 'Room to improve' : 'Needs attention'

  return (
    <div className="audit-popup flex h-[500px] w-[380px] flex-col overflow-hidden text-ink">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel/80 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/brand-mark.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
          <span className="truncate text-[15px] font-bold leading-none tracking-tight">AuditToPitch <span className="text-brand">Pro</span></span>
        </div>
        {isSubscribed ? (
          <span className="shrink-0 rounded-full bg-mint px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#03120a]">Pro</span>
        ) : accountState === 'unsubscribed' ? (
          <span className="meter" aria-label={`${freeAuditsRemaining} free audits left`}>
            <i aria-hidden="true">{Array.from({ length: FREE_AUDIT_TOTAL }, (_, index) => <s key={index} className={index < freeAuditsRemaining ? 'on' : ''} />)}</i>
            {freeAuditsRemaining} {freeAuditsRemaining === 1 ? 'audit' : 'audits'} left
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-mint/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand">{accountState === 'checking' ? 'Checking' : 'Free'}</span>
        )}
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
                {availableVoices.length > 0 && (
                  <label className="flex h-[32px] min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-panel px-2 text-[10px] text-muted">
                    <span className="shrink-0">Voice</span>
                    <select
                      aria-label="Speech voice"
                      value={selectedVoiceUri}
                      onChange={(event) => selectVoice(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-[10px] text-ink outline-none"
                    >
                      {availableVoices.map((voice) => (
                        <option key={voice.voiceURI || voice.name} value={voice.voiceURI || voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
          <section className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-3 pt-3" aria-live="polite" aria-busy={loading}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">Ready when you are</p>
              <p className="mt-1 text-[22px] font-extrabold leading-[1.05] tracking-tight">Audit any site<br /><span className="inline-block rounded-lg bg-[#03120a] px-2 py-0.5 text-mint">in 10 seconds.</span></p>
              <p className="mt-1.5 text-[11px] leading-[1.45] text-muted">Scan tags, pixels and schema, then get a white-label report and a Loom pitch script.</p>
            </div>

            <div className={`target ${loading ? 'scanning' : ''}`}>
              <span className="bk a" /><span className="bk b" /><span className="bk c" /><span className="bk d" />
              {loading && <div className="sweep" aria-hidden="true" />}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-line bg-panel text-brand"><GlobeIcon size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">{activeTab?.title || 'Loading active tab...'}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{getHost(activeTab?.url)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${loading ? 'bg-[#03120a] text-mint' : 'border border-mint/50 text-brand'}`}>{loading ? 'Scanning' : 'Ready'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {checkTiles.map(({ label, hint, Icon }) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-xl border border-line bg-panel px-2.5 py-2">
                  <Icon size={14} className="text-brand" />
                  <span className="mt-0.5 text-[11px] font-semibold text-ink">{label}</span>
                  <span className="text-[9px] leading-tight text-muted">{hint}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span className="font-medium">You get</span>
              <em className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 not-italic text-ink"><PdfIcon size={11} className="text-brand" />PDF report</em>
              <em className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 not-italic text-ink"><PlayIcon size={11} className="text-brand" />Loom script</em>
            </div>

            <div className="prog">
              <p><span>{loading ? loadingMessages[loadingStep] : 'Waiting to scan'}</span><b>{loading ? scanProgress[loadingStep] : 0}%</b></p>
              <div className="bar"><i style={{ '--p': `${loading ? scanProgress[loadingStep] : 0}%` } as CSSProperties} /></div>
            </div>

            <button type="button" onClick={runAudit} disabled={loading || !activeTab || (!isSubscribed && freeAuditsRemaining <= 0)} className="mt-auto flex h-[46px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-mint text-[13px] font-bold text-[#03120a] shadow-[0_0_24px_rgb(28_240_140/35%)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
              {loading ? <SparkleIcon size={16} /> : <ScanPlayIcon size={16} />}{loading ? 'Scanning…' : 'Run 10-Second Audit'}
            </button>
            {error && <p className="flex items-center gap-1.5 text-[10px] text-alert" role="alert"><CircleAlert size={12} />{error}</p>}
          </section>
        )}
      </main>

      <footer className="flex h-[42px] shrink-0 items-center justify-between border-t border-line bg-panel px-4">
        <span className="flex items-center gap-1.5 text-[10px] text-muted"><LockKeyhole size={12} />{accountState === 'signed-out' ? 'Connect your account' : isSubscribed ? 'Pro plan' : 'Free plan'}</span>
        {needsAccount && (
          <button type="button" onClick={accountState === 'signed-out' ? onAccountClick : startUpgrade} disabled={isUpgrading} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand transition hover:text-ink focus-visible:underline disabled:cursor-wait disabled:opacity-60">
            {accountState !== 'signed-out' && <SparkleIcon size={12} />}{accountState === 'signed-out' ? 'Sign In' : isUpgrading ? 'Opening checkout...' : 'Upgrade to Pro'}<ChevronRight size={13} />
          </button>
        )}
      </footer>
    </div>
  )
}

export default App
