import { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { updateProfile, changePassword, getProfile } from '../api/profile';
import { getBillingConfig, getSetupIntent, listPaymentMethods, detachPaymentMethod } from '../api/billing';
import { SIcon } from '../components/icons/SIcon';
import type { User } from '../types';
import type { SavedCard } from '../types/billing';

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', background: '#f8fafc',
  color: '#0f172a', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: { fontSize: '14px', color: '#0f172a', fontFamily: 'Inter, sans-serif', '::placeholder': { color: '#94a3b8' } },
    invalid: { color: '#ef4444' },
  },
};

const ROLE_META: Record<string, { bg: string; fg: string; dot: string }> = {
  OWNER:      { bg: '#f5f3ff', fg: '#6d28d9', dot: '#7c3aed' },
  ADMIN:      { bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6' },
  SUPERVISOR: { bg: '#f0fdf4', fg: '#15803d', dot: '#22c55e' },
  MANAGER:    { bg: '#fff7ed', fg: '#c2410c', dot: '#f97316' },
  EMPLOYEE:   { bg: '#f8fafc', fg: '#475569', dot: '#94a3b8' },
};

const avatarGradients = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#6366f1'], ['#10b981', '#0ea5e9'],
  ['#f59e0b', '#ef4444'], ['#ec4899', '#8b5cf6'], ['#14b8a6', '#06b6d4'],
];
function avatarColors(name: string) {
  return avatarGradients[name.charCodeAt(0) % avatarGradients.length];
}

function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;
    try {
      setLoading(true); setError(''); setSuccess(false);
      const { clientSecret } = await getSetupIntent();
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl },
      });
      if (result.error) { setError(result.error.message ?? 'Erreur carte'); return; }
      setSuccess(true);
      cardEl.clear();
      onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '13px 14px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
          <SIcon name="AlertCircle" size={13} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <SIcon name="CheckCircle" size={13} color="#16a34a" /><span style={{ color: '#15803d', fontSize: 13 }}>Carte enregistrée avec succès !</span>
        </div>
      )}
      <button onClick={submit} disabled={loading || !stripe} style={{ padding: '12px', borderRadius: 12, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? 'Enregistrement…' : <><SIcon name="CreditCard" size={15} color="#fff" /> Enregistrer la carte</>}
      </button>
    </div>
  );
}

/* ── Tab 1 – Personal info ── */
function TabInfo({ user, onUpdated }: { user: User; onUpdated: (name: string, email: string) => void }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const rm = ROLE_META[user.globalRole ?? 'EMPLOYEE'] ?? ROLE_META.EMPLOYEE;
  const [c1, c2] = avatarColors(user.name);
  const initials = user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const submit = async () => {
    if (!form.name.trim()) return setError('Le nom est obligatoire.');
    try {
      setLoading(true); setError(''); setSuccess(false);
      const updated = await updateProfile(form);
      onUpdated(updated.name, updated.email);
      setSuccess(true);
      setEditMode(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Avatar section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: 'linear-gradient(135deg, #fafbff, #f1f5f9)', borderRadius: 16, border: '1px solid #e8edf2' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22, boxShadow: `0 4px 16px ${c1}60`, flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>{user.name}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{user.email}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: rm.bg, color: rm.fg, fontSize: 11, fontWeight: 800 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: rm.dot }} />{user.globalRole}
            </span>
          </div>
        </div>
      </div>

      {success && !editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <SIcon name="CheckCircle" size={14} color="#16a34a" /><span style={{ color: '#15803d', fontSize: 13 }}>Profil mis à jour avec succès !</span>
        </div>
      )}

      {editMode ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}><SIcon name="User" size={12} color="#64748b" /> Nom complet</label>
            <input style={inp} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}><SIcon name="Mail" size={12} color="#64748b" /> Adresse email</label>
            <input style={inp} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}><SIcon name="AlertCircle" size={13} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span></div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setEditMode(false); setError(''); setForm({ name: user.name, email: user.email }); }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? 'Enregistrement…' : <><SIcon name="Check" size={15} color="#fff" /> Enregistrer</>}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            { icon: 'User', label: 'Nom', value: user.name },
            { icon: 'Mail', label: 'Email', value: user.email },
            { icon: 'Shield', label: 'Rôle', value: user.globalRole ?? 'EMPLOYEE' },
          ].map((row) => (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e8edf2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <SIcon name={row.icon as any} size={13} color="#94a3b8" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
          <button onClick={() => setEditMode(true)} style={{ marginTop: 4, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <SIcon name="Pencil" size={15} color="#fff" /> Modifier les informations
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Tab 2 – Change password ── */
function TabPassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirm) return setError('Tous les champs sont obligatoires.');
    if (form.newPassword.length < 6) return setError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
    if (form.newPassword !== form.confirm) return setError('Les mots de passe ne correspondent pas.');
    try {
      setLoading(true); setError(''); setSuccess(false);
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const passField = (label: string, key: keyof typeof form, showKey: keyof typeof show) => (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}>
        <SIcon name="Lock" size={12} color="#64748b" /> {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input style={{ ...inp, paddingRight: 42 }} type={show[showKey] ? 'text' : 'password'} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder="••••••••" />
        <button type="button" onClick={() => setShow((s) => ({ ...s, [showKey]: !s[showKey] }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <SIcon name={show[showKey] ? 'EyeOff' : 'Eye'} size={15} color="#94a3b8" />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e8edf2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
          <SIcon name="Info" size={14} color="#94a3b8" />
          Saisissez votre mot de passe actuel pour en définir un nouveau.
        </div>
      </div>
      {passField('Mot de passe actuel', 'currentPassword', 'current')}
      {passField('Nouveau mot de passe', 'newPassword', 'new')}
      {passField('Confirmer le nouveau mot de passe', 'confirm', 'confirm')}
      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}><SIcon name="AlertCircle" size={13} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span></div>}
      {success && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}><SIcon name="CheckCircle" size={13} color="#16a34a" /><span style={{ color: '#15803d', fontSize: 13 }}>Mot de passe modifié avec succès !</span></div>}
      <button onClick={submit} disabled={loading} style={{ padding: '12px', borderRadius: 12, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? 'Modification…' : <><SIcon name="Lock" size={15} color="#fff" /> Changer le mot de passe</>}
      </button>
    </div>
  );
}

/* ── Tab 3 – Payment cards (OWNER only) ── */
function TabPayment() {
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const [config, cardsRes] = await Promise.all([getBillingConfig(), listPaymentMethods()]);
      setCards(cardsRes);
      if (!stripePromise && config.publishableKey && !config.publishableKey.includes('placeholder')) {
        setStripePromise(loadStripe(config.publishableKey));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  }, [stripePromise]);

  useEffect(() => { void loadData(); }, [loadData]);

  const removeCard = async (pmId: string) => {
    try {
      setRemoving(pmId);
      await detachPaymentMethod(pmId);
      setCards((c) => c.filter((card) => card.id !== pmId));
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur suppression'); }
    finally { setRemoving(null); }
  };

  const brandColors: Record<string, string> = { visa: '#1a1f71', mastercard: '#eb001b', amex: '#007bc1', discover: '#ff6000' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Cartes enregistrées</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Utilisées pour payer les factures</div>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: showAdd ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: showAdd ? '#475569' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
          <SIcon name={showAdd ? 'X' : 'Plus'} size={13} color="currentColor" />{showAdd ? 'Annuler' : 'Ajouter une carte'}
        </button>
      </div>

      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}><SIcon name="AlertCircle" size={13} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span></div>}

      {showAdd && (
        stripePromise ? (
          <Elements stripe={stripePromise}>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: 14, border: '1.5px dashed #c7d2fe' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <SIcon name="CreditCard" size={14} color="#6366f1" /> Nouvelle carte
              </div>
              <AddCardForm onSuccess={() => { setShowAdd(false); void loadData(); }} />
            </div>
          </Elements>
        ) : (
          <div style={{ padding: '16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, fontSize: 13, color: '#92400e' }}>
            Stripe n'est pas configuré. Ajoutez votre clé Stripe dans la configuration du serveur.
          </div>
        )
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map((i) => <div key={i} style={{ height: 72, borderRadius: 14, background: '#e2e8f0' }} />)}
        </div>
      ) : cards.length === 0 && !showAdd ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <SIcon name="CreditCard" size={22} color="#cbd5e1" />
          </div>
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Aucune carte enregistrée</p>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>Ajoutez une carte pour payer les factures</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((card) => (
            <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#fff', borderRadius: 14, border: '1px solid #e8edf2', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
              <div style={{ width: 46, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${brandColors[card.brand] ?? '#6366f1'}22, ${brandColors[card.brand] ?? '#6366f1'}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${brandColors[card.brand] ?? '#6366f1'}40` }}>
                <SIcon name="CreditCard" size={16} color={brandColors[card.brand] ?? '#6366f1'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', textTransform: 'capitalize' }}>{card.brand} •••• {card.last4}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Expire {String(card.expMonth).padStart(2, '0')}/{card.expYear}</div>
              </div>
              <button onClick={() => removeCard(card.id)} disabled={removing === card.id} title="Supprimer" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', cursor: removing === card.id ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: removing === card.id ? 0.5 : 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                <SIcon name="Trash2" size={13} color="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Profile Page ── */
interface Props { user: User; onProfileUpdated: (name: string, email: string) => void }

const TABS = [
  { id: 'info', label: 'Informations', icon: 'User' },
  { id: 'password', label: 'Mot de passe', icon: 'Lock' },
  { id: 'payment', label: 'Paiement', icon: 'CreditCard' },
];

export function ProfilePage({ user, onProfileUpdated }: Props) {
  const isOwner = user.globalRole === 'OWNER';
  const [activeTab, setActiveTab] = useState('info');
  const [, setServerProfile] = useState({ name: user.name, email: user.email });

  useEffect(() => { void getProfile().then((p) => setServerProfile({ name: p.name, email: p.email })).catch(() => {}); }, []);

  const visibleTabs = TABS.filter((t) => t.id !== 'payment' || isOwner);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', flexShrink: 0 }}>
        <div style={{ width: 31, height: 31, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SIcon name="UserCircle" size={15} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Mon profil</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 24, width: 'fit-content' }}>
            {visibleTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                background: activeTab === tab.id ? '#fff' : 'transparent',
                color: activeTab === tab.id ? '#0f172a' : '#64748b',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
                <SIcon name={tab.icon as any} size={14} color={activeTab === tab.id ? '#6366f1' : '#94a3b8'} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8edf2', padding: '24px', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
            {activeTab === 'info' && <TabInfo user={user} onUpdated={(name, email) => { onProfileUpdated(name, email); }} />}
            {activeTab === 'password' && <TabPassword />}
            {activeTab === 'payment' && isOwner && <TabPayment />}
          </div>
        </div>
      </div>
    </div>
  );
}
