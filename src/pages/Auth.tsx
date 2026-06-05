import { useEffect, useRef, useState } from 'react';
import { SIcon } from '../components/icons/SIcon';
import type { AuthSession } from '../types/auth';
import { Field } from '../components/auth/Field';
import { Spinner } from '../components/auth/Spinner';
import { validateAuthForm } from '../utils/validators';
import { FEATURES } from '../constants/auth';
import { completeCompany, googleAuth, login, microsoftAuth, register, verifyOtp } from '../api/auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const MICROSOFT_TENANT = (import.meta.env.VITE_MICROSOFT_TENANT as string | undefined) || 'organizations';
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="0" y="0" width="7" height="7" fill="#F25022"/>
      <rect x="9" y="0" width="7" height="7" fill="#7FBA00"/>
      <rect x="0" y="9" width="7" height="7" fill="#00A4EF"/>
      <rect x="9" y="9" width="7" height="7" fill="#FFB900"/>
    </svg>
  );
}

interface MsalAuthResult { idToken: string; account?: { username?: string } }
interface MsalApp {
  initialize: () => Promise<void>;
  loginPopup: (req: { scopes: string[]; prompt?: string }) => Promise<MsalAuthResult>;
}
type MsalConstructor = new (cfg: { auth: { clientId: string; authority: string; redirectUri: string } }) => MsalApp;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          prompt: () => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
    msal?: {
      PublicClientApplication: MsalConstructor;
    };
  }
}

interface AuthProps { onLogin: (session: AuthSession) => void; }

export function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', companyName: '', registryNumber: '' });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [remember, setRemember] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [companyForm, setCompanyForm] = useState({ companyName: '', registryNumber: '' });
  const [companyError, setCompanyError] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current || otpMode || pendingSession) return;
    const tryInit = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) {
        window.setTimeout(tryInit, 200);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => { void handleGoogleCredential(response.credential); },
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', width: 360, text: mode === 'login' ? 'signin_with' : 'signup_with',
      });
    };
    tryInit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, otpMode, pendingSession, remember]);

  const handleGoogleClick = () => {
    const btn = googleBtnRef.current?.querySelector('div[role="button"]') as HTMLDivElement | null;
    if (btn) { btn.click(); return; }
    setSubmitError('Google sign-in non disponible.');
  };

  const handleMicrosoftClick = async () => {
    if (!MICROSOFT_CLIENT_ID) {
      setSubmitError("Microsoft SSO non configuré (VITE_MICROSOFT_CLIENT_ID manquant).");
      return;
    }
    if (!window.msal?.PublicClientApplication) {
      setSubmitError("MSAL non chargé. Rechargez la page.");
      return;
    }
    setSubmitError(''); setLoading(true);
    try {
      const app = new window.msal.PublicClientApplication({
        auth: {
          clientId: MICROSOFT_CLIENT_ID,
          authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT}`,
          redirectUri: window.location.origin,
        },
      });
      await app.initialize();
      const result = await app.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
      if (!result?.idToken) throw new Error('Microsoft n’a pas renvoyé d’ID token');
      const session = await microsoftAuth({ idToken: result.idToken, remember });
      if (session.needsCompany) {
        setPendingSession({ token: session.token, user: session.user, remember: session.remember });
      } else {
        onLogin({ token: session.token, user: session.user, remember: session.remember });
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erreur Microsoft');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setSubmitError(''); setLoading(true);
    try {
      const result = await googleAuth({ credential, remember });
      if (result.needsCompany) {
        setPendingSession({ token: result.token, user: result.user, remember: result.remember });
      } else {
        onLogin({ token: result.token, user: result.user, remember: result.remember });
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erreur Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCompany = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!companyForm.companyName.trim() || !companyForm.registryNumber.trim()) {
      setCompanyError('Renseignez le nom et le numéro de la société.'); return;
    }
    if (!pendingSession) { setCompanyError('Session manquante.'); return; }
    setCompanyError(''); setLoading(true);
    try {
      const session = await completeCompany({ ...companyForm, token: pendingSession.token });
      onLogin({ ...session, remember: pendingSession.remember });
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Erreur création société');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
    setSubmitError('');
  };

  const validate = () => validateAuthForm(mode, form);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setLoading(true);
    setSubmitError('');

    const request = mode === 'login'
      ? login({ email: form.email, password: form.password, remember })
      : register({
          name: form.name,
          email: form.email,
          password: form.password,
          companyName: form.companyName,
          registryNumber: form.registryNumber,
          remember,
        });

    request
      .then((res) => {
        // res may be AuthSession or { otpRequired: true }
        if ((res as any).otpRequired) {
          setOtpEmail(form.email);
          setOtpMode(true);
          setOtpError('Code OTP envoye a votre email.');
          return;
        }
        onLogin({ ...(res as any), remember });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Une erreur est survenue';
        setSubmitError(message);
      })
      .finally(() => setLoading(false));
  };

  const handleVerifyOtp = () => {
    setLoading(true);
    setOtpError('');
    verifyOtp({ email: otpEmail || form.email, code: otpCode, remember })
      .then((session) => {
        onLogin({ ...session, remember });
      })
      .catch((err: unknown) => setOtpError(err instanceof Error ? err.message : 'Erreur OTP'))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      {/* Panneau gauche */}
      <div style={{
        flex: '0 0 480px',
        background: 'linear-gradient(145deg, var(--ms-sidebar) 0%, var(--ms-sidebar-gradient-mid) 60%, var(--ms-sidebar-gradient-end) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, var(--ms-accent-glow) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--ms-radius-sm)', background: 'linear-gradient(135deg, var(--ms-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px var(--ms-accent-glow)' }}>
            <SIcon name="Video" size={20} color="#fff" sw={2.2} />
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>MeetSync</span>
        </div>

        <div>
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.8, marginBottom: 16 }}>
            La gestion des<br />réunions,<br />
            <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>réinventée.</span>
          </h1>
          <p style={{ color: '#93c5fd', fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
            Pilotez vos réunions, vos équipes et vos actions depuis une seule interface.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map((f) => (
              <div key={f.icon} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 'var(--ms-radius-sm)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SIcon name={f.icon} size={16} color="#93c5fd" />
                </div>
                <span style={{ color: '#bfdbfe', fontSize: 14 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 'var(--ms-radius)', padding: '16px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#bfdbfe', fontSize: 13, lineHeight: 1.6, marginBottom: 12, fontStyle: 'italic' }}>
            "MeetSync a transformé la façon dont notre équipe collabore. Les réunions sont plus courtes et plus efficaces."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ms-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>JM</div>
            <div>
              <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>Jean-Marc Vidal</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>CTO · Groupe Horizon</div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {pendingSession && (
            <div style={{ background: '#fff', borderRadius: 'var(--ms-radius)', border: '1px solid #e2e8f0', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ms-accent-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SIcon name="Building2" size={18} color="var(--ms-accent)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 700 }}>Dernière étape</h3>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 13 }}>
                    Bienvenue {pendingSession.user.name.split(' ')[0]}. Ajoutez votre société pour accéder à MeetSync.
                  </p>
                </div>
              </div>
              <form onSubmit={handleSubmitCompany} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Nom de la société" icon="Building2" value={companyForm.companyName}
                  onChange={(v) => { setCompanyForm((f) => ({ ...f, companyName: v })); setCompanyError(''); }}
                  placeholder="MeetSync SAS" />
                <Field label="Numéro d'immatriculation" icon="BadgeCheck" value={companyForm.registryNumber}
                  onChange={(v) => { setCompanyForm((f) => ({ ...f, registryNumber: v })); setCompanyError(''); }}
                  placeholder="RCS 123 456 789" />
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--ms-radius-sm)', border: 'none',
                  background: loading ? '#93c5fd' : 'var(--ms-accent)', color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 2px 8px var(--ms-accent-glow)', fontFamily: 'inherit',
                }}>
                  {loading ? <><Spinner /> Création…</> : 'Créer ma société'}
                </button>
                {companyError && <p style={{ color: '#dc2626', fontSize: 12, textAlign: 'center', margin: 0 }}>{companyError}</p>}
              </form>
            </div>
          )}

          {!otpMode && !pendingSession && (
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 'var(--ms-radius-sm)', padding: 3, marginBottom: 32 }}>
              {([{ k: 'login', l: 'Connexion' }, { k: 'register', l: 'Inscription' }] as const).map((m) => (
                <button key={m.k} onClick={() => { setMode(m.k); setErrors({}); setOtpMode(false); setOtpCode(''); setOtpError(''); }} style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--ms-radius-sm)', border: 'none', cursor: 'pointer',
                  background: mode === m.k ? '#fff' : 'transparent',
                  color: mode === m.k ? '#0f172a' : '#64748b',
                  fontWeight: mode === m.k ? 600 : 400, fontSize: 13,
                  boxShadow: mode === m.k ? 'var(--ms-shadow)' : 'none',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                }}>{m.l}</button>
              ))}
            </div>
          )}

          {otpMode && !pendingSession && (
            <div style={{ background: '#fff', borderRadius: 'var(--ms-radius)', border: '1px solid #e2e8f0', padding: 20 }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 20, fontWeight: 700 }}>Verification OTP</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 8, marginBottom: 16 }}>
                Entrez le code envoye a <strong>{otpEmail || form.email}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Code a 6 chiffres"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--ms-radius-sm)', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: 14 }}
                />
                <button
                  type="button"
                  disabled={loading || !otpCode.trim()}
                  onClick={handleVerifyOtp}
                  style={{ padding: '10px 14px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: 'var(--ms-accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {loading ? 'Verification...' : 'Verifier'}
                </button>
              </div>
              {otpError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>{otpError}</p>}
              <button
                type="button"
                onClick={() => { setOtpMode(false); setOtpCode(''); setOtpError(''); }}
                style={{ marginTop: 10, border: 'none', background: 'none', color: 'var(--ms-accent)', cursor: 'pointer', fontSize: 13 }}
              >
                Retour
              </button>
            </div>
          )}

          {!otpMode && !pendingSession && (
          <>
          <h2 style={{ color: '#0f172a', fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
            {mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
            {mode === 'login' ? 'Connectez-vous pour accéder à votre espace.' : 'Rejoignez MeetSync et commencez gratuitement.'}
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button type="button" disabled={!GOOGLE_CLIENT_ID || loading} onClick={handleGoogleClick} style={{
              flex: 1, padding: '10px 0', border: '1.5px solid #e2e8f0',
              borderRadius: 'var(--ms-radius-sm)', background: '#fff',
              cursor: GOOGLE_CLIENT_ID && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 13, fontWeight: 500, color: '#334155', transition: 'all 0.15s', fontFamily: 'inherit',
              opacity: GOOGLE_CLIENT_ID ? 1 : 0.6,
            }}
              onMouseEnter={(e) => { if (GOOGLE_CLIENT_ID) e.currentTarget.style.borderColor = '#94a3b8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <GoogleLogo /> Google
            </button>
            <button type="button" disabled={!MICROSOFT_CLIENT_ID || loading} onClick={handleMicrosoftClick} style={{
              flex: 1, padding: '10px 0', border: '1.5px solid #e2e8f0',
              borderRadius: 'var(--ms-radius-sm)', background: '#fff',
              cursor: MICROSOFT_CLIENT_ID && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 13, fontWeight: 500, color: '#334155', transition: 'all 0.15s', fontFamily: 'inherit',
              opacity: MICROSOFT_CLIENT_ID ? 1 : 0.6,
            }}
              onMouseEnter={(e) => { if (MICROSOFT_CLIENT_ID) e.currentTarget.style.borderColor = '#94a3b8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <MicrosoftLogo /> Microsoft
            </button>
          </div>
          {/* Hidden Google-rendered button (real click target — clicked programmatically) */}
          <div ref={googleBtnRef} style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ color: '#94a3b8', fontSize: 12 }}>ou par email</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <Field label="Nom complet" icon="User" value={form.name} onChange={(v) => set('name', v)} placeholder="Jean Dupont" error={errors.name} />
            )}
            {mode === 'register' && (
              <Field label="Nom de la société" icon="Building2" value={form.companyName} onChange={(v) => set('companyName', v)} placeholder="MeetSync SAS" error={errors.companyName} />
            )}
            {mode === 'register' && (
              <Field label="Numéro d'immatriculation" icon="BadgeCheck" value={form.registryNumber} onChange={(v) => set('registryNumber', v)} placeholder="RCS 123 456 789" error={errors.registryNumber} />
            )}
            <Field label="Adresse email" icon="Mail" value={form.email} onChange={(v) => set('email', v)} placeholder="jean@entreprise.fr" error={errors.email} type="email" />
            <Field
              label="Mot de passe" icon="Lock" value={form.password}
              onChange={(v) => set('password', v)} placeholder="••••••••"
              error={errors.password} type={showPass ? 'text' : 'password'}
              suffix={
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 2 }}>
                  <SIcon name={showPass ? 'EyeOff' : 'Eye'} size={15} color="#94a3b8" />
                </button>
              }
            />
            {mode === 'register' && (
              <Field label="Confirmer le mot de passe" icon="Lock" value={form.confirm} onChange={(v) => set('confirm', v)} placeholder="••••••••" error={errors.confirm} type={showPass ? 'text' : 'password'} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <label htmlFor="remember" style={{ fontSize: 13, color: '#64748b' }}>Se souvenir de moi (15 jours)</label>
            </div>
            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -6 }}>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--ms-accent)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                  Mot de passe oublié ?
                </a>
              </div>
            )}
            <div>
              <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 'var(--ms-radius-sm)', border: 'none',
              background: loading ? '#93c5fd' : 'var(--ms-accent)', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s', boxShadow: '0 2px 8px var(--ms-accent-glow)', fontFamily: 'inherit',
            }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--ms-accent-dark)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--ms-accent)'; }}
            >
              {loading ? <><Spinner />{mode === 'login' ? 'Connexion…' : 'Création…'}</> : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
            </button>
            {submitError && <p style={{ color: '#dc2626', fontSize: 12, textAlign: 'center', marginTop: 4 }}>{submitError}</p>}
            </div>
          </form>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: 20, color: '#64748b', fontSize: 13 }}>
              Pas encore de compte ?{' '}
              <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-accent)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
                S'inscrire gratuitement
              </button>
            </p>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// Field et Spinner extraits vers des composants réutilisables
