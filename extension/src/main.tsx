import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function openAccountPage() {
  const siteUrl = import.meta.env.VITE_SITE_URL || 'http://127.0.0.1:3000'
  const loginUrl = new URL('/login', siteUrl)
  loginUrl.searchParams.set('next', '/#pricing')
  loginUrl.searchParams.set('source', 'extension')

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    void chrome.tabs.create({ url: loginUrl.toString() })
    return
  }

  window.location.assign(loginUrl.toString())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App onAccountClick={openAccountPage} />
  </StrictMode>,
)
