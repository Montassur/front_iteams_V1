import { useEffect, useState } from 'react';
import { SIcon } from './icons/SIcon';

// `beforeinstallprompt` is a Chromium-only event (Android Chrome, Edge, Samsung Internet).
// We keep our own typed wrapper since TS DOM lib types are still experimental for it.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'meetsync_pwa_prompt_dismissed_at';
// Re-show the prompt at most once every 7 days after a dismiss.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  // Android/Chrome: matchMedia. iOS Safari: navigator.standalone.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  // Exclude in-app browsers (Instagram, Facebook, etc.) where add-to-home doesn't work.
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|LinkedInApp/.test(ua);
  return isIos && !isInAppBrowser;
}

function isFreshlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    return Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosCard, setShowIosCard] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());

  // 1. Chromium path: capture `beforeinstallprompt` so we can trigger it from our button.
  useEffect(() => {
    if (installed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setShowIosCard(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  // 2. iOS path: no native event. Surface the "how to install" card after a small delay
  //    so it doesn't fight the login screen.
  useEffect(() => {
    if (installed) return;
    if (!isIosSafari()) return;
    if (isFreshlyDismissed()) return;
    const t = window.setTimeout(() => setShowIosCard(true), 1200);
    return () => window.clearTimeout(t);
  }, [installed]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setDeferred(null);
    setShowIosCard(false);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      else dismiss();
    } catch { /* user cancelled or unsupported */ }
    setDeferred(null);
  };

  if (installed) return null;

  // ── Android/Chromium install button ─────────────────────────────────────────
  if (deferred) {
    return (
      <div style={banner}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SIcon name="Download" size={16} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 700 }}>Installer MeetSync</div>
          <div style={{ color: '#64748b', fontSize: 11 }}>Accès rapide depuis votre écran d'accueil.</div>
        </div>
        <button onClick={handleInstall} style={primaryBtn}>Installer</button>
        <button onClick={dismiss} title="Plus tard" style={iconBtn}>
          <SIcon name="X" size={14} color="#64748b" />
        </button>
      </div>
    );
  }

  // ── iOS Safari instructions card ────────────────────────────────────────────
  if (showIosCard) {
    return (
      <div style={banner}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SIcon name="Share" size={16} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 700 }}>Installer sur iPhone</div>
          <div style={{ color: '#475569', fontSize: 11, lineHeight: 1.5 }}>
            Appuyez sur <SIcon name="Share" size={11} color="#475569" /> Partager
            {' '}puis sur <strong style={{ color: '#0f172a' }}>« Sur l'écran d'accueil »</strong>.
          </div>
        </div>
        <button onClick={dismiss} title="J'ai compris" style={iconBtn}>
          <SIcon name="X" size={14} color="#64748b" />
        </button>
      </div>
    );
  }

  return null;
}

const banner: React.CSSProperties = {
  position: 'fixed',
  left: 16,
  right: 16,
  bottom: 16,
  margin: '0 auto',
  maxWidth: 420,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
  zIndex: 500,
  fontFamily: 'Inter, sans-serif',
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 9,
  border: 'none',
  background: 'var(--ms-accent)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 2px 6px var(--ms-accent-glow)',
  flexShrink: 0,
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  display: 'flex',
  flexShrink: 0,
};
