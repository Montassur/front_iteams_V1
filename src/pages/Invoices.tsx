import { useCallback, useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  getBillingConfig, listInvoices, listPaymentMethods,
  payInvoice, confirmPayment, getSetupIntent,
} from '../api/billing';
import { SIcon } from '../components/icons/SIcon';
import type { User } from '../types';
import type { Invoice, SavedCard } from '../types/billing';

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);

const STATUS_META: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  PENDING:   { bg: '#fff7ed', fg: '#c2410c', dot: '#f97316', label: 'En attente' },
  PAID:      { bg: '#f0fdf4', fg: '#15803d', dot: '#22c55e', label: 'Payée' },
  CANCELLED: { bg: '#f8fafc', fg: '#64748b', dot: '#94a3b8', label: 'Annulée' },
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: { fontSize: '14px', color: '#0f172a', fontFamily: 'Inter, sans-serif', '::placeholder': { color: '#94a3b8' } },
    invalid: { color: '#ef4444' },
  },
};

/* ── Add-card inline form ── */
function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;
    try {
      setLoading(true); setError('');
      const { clientSecret } = await getSetupIntent();
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl },
      });
      if (result.error) { setError(result.error.message ?? 'Erreur carte'); return; }
      onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
          <SIcon name="AlertCircle" size={13} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 11, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
        <button onClick={submit} disabled={loading || !stripe} style={{ flex: 2, padding: '11px', borderRadius: 11, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? 'Enregistrement…' : <><SIcon name="CreditCard" size={14} color="#fff" /> Enregistrer la carte</>}
        </button>
      </div>
    </div>
  );
}

/* ── Pay-invoice modal ── */
function PayModal({ open, invoice, cards, stripeInstance, onClose, onPaid, onNeedCard }: {
  open: boolean; invoice: Invoice | null; cards: SavedCard[];
  stripeInstance: Stripe | null;
  onClose: () => void; onPaid: () => void; onNeedCard: () => void;
}) {
  const [selectedCard, setSelectedCard] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && cards.length > 0) setSelectedCard(cards[0].id);
    setError('');
  }, [open, cards]);

  if (!open || !invoice) return null;

  const submit = async () => {
    if (!selectedCard) return setError('Sélectionnez une carte.');
    try {
      setLoading(true); setError('');
      const res = await payInvoice(invoice.id, selectedCard);
      if (res.status === 'succeeded') { onPaid(); onClose(); return; }
      if (res.clientSecret && stripeInstance) {
        const result = await stripeInstance.confirmCardPayment(res.clientSecret);
        if (result.error) { setError(result.error.message ?? 'Échec du paiement'); return; }
        await confirmPayment(invoice.id, result.paymentIntent!.id);
        onPaid(); onClose();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(15,23,42,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #10b981, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="CreditCard" size={19} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Payer la facture</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{invoice.description} — {fmt(invoice.amountCents, invoice.currency)}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="X" size={14} color="#64748b" />
          </button>
        </div>
        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <SIcon name="CreditCard" size={36} color="#cbd5e1" />
              <p style={{ color: '#64748b', fontSize: 13, margin: '10px 0 0' }}>Aucune carte enregistrée.</p>
              <button onClick={() => { onClose(); onNeedCard(); }} style={{ marginTop: 12, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Ajouter une carte dans Mon profil
              </button>
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'block' }}>Sélectionner une carte</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map((card) => (
                    <label key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${selectedCard === card.id ? '#6366f1' : '#e2e8f0'}`, background: selectedCard === card.id ? '#f5f3ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <input type="radio" name="card" checked={selectedCard === card.id} onChange={() => setSelectedCard(card.id)} style={{ accentColor: '#6366f1' }} />
                      <span style={{ fontSize: 16 }}>💳</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{card.brand} •••• {card.last4}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Exp. {String(card.expMonth).padStart(2, '0')}/{card.expYear}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                  <SIcon name="AlertCircle" size={13} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: loading ? '#6ee7b7' : 'linear-gradient(135deg, #10b981, #0ea5e9)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? 'Paiement…' : <><SIcon name="Check" size={15} color="#fff" /> Payer {fmt(invoice.amountCents, invoice.currency)}</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Invoices Page ── */
interface Props { user: User; onGoToProfile?: () => void }

export function InvoicesPage({ user, onGoToProfile }: Props) {
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);

  const isOwner = user.globalRole === 'OWNER';

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const [config, invRes, cardsRes] = await Promise.all([
        getBillingConfig(),
        listInvoices(),
        listPaymentMethods(),
      ]);
      setInvoices(invRes.invoices);
      setCards(cardsRes);
      if (!stripePromise && config.publishableKey && !config.publishableKey.includes('placeholder')) {
        const sp = loadStripe(config.publishableKey);
        setStripePromise(sp);
        sp.then((s) => setStripeInstance(s));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur chargement'); }
    finally { setLoading(false); }
  }, [stripePromise]);

  useEffect(() => { if (isOwner) void loadData(); }, [isOwner, loadData]);

  if (!isOwner) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#f8fafc' }}>
        <SIcon name="Lock" size={40} color="#cbd5e1" />
        <p style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'Inter, sans-serif', margin: 0 }}>Accès réservé au propriétaire</p>
      </div>
    );
  }

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === 'PENDING').length,
    paid: invoices.filter((i) => i.status === 'PAID').length,
    totalAmount: invoices.reduce((s, i) => s + i.amountCents, 0),
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', flexShrink: 0 }}>
        <div style={{ width: 31, height: 31, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SIcon name="Receipt" size={14} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Mes factures</span>
        {!loading && <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{invoices.length}</span>}
        <div style={{ flex: 1 }} />
        <button onClick={onGoToProfile} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
          <SIcon name="CreditCard" size={13} color="#6366f1" />Gérer mes cartes
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>

        {error && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, marginBottom: 14 }}><SIcon name="AlertCircle" size={15} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span></div>}

        {/* Stats */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total factures', value: stats.total, icon: 'FileText', grad: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
              { label: 'En attente', value: stats.pending, icon: 'Clock', grad: 'linear-gradient(135deg, #f97316, #f59e0b)' },
              { label: 'Payées', value: stats.paid, icon: 'CheckCircle', grad: 'linear-gradient(135deg, #10b981, #06b6d4)' },
              { label: 'Montant total', value: stats.totalAmount > 0 ? fmt(stats.totalAmount, invoices[0]?.currency ?? 'USD') : '—', icon: 'DollarSign', grad: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
            ].map((s) => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf2', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SIcon name={s.icon as any} size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notice */}
        {!loading && invoices.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, marginBottom: 20 }}>
            <SIcon name="Info" size={15} color="#0ea5e9" />
            <span style={{ color: '#0369a1', fontSize: 13 }}>Vos factures mensuelles apparaîtront ici dès leur génération par l'administrateur.</span>
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8edf2', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 120px', gap: 16, padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            {['Description', 'Mois', 'Montant', 'Statut', 'Échéance', 'Actions'].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</span>
            ))}
          </div>

          {loading && [1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 120px', gap: 16, padding: '14px 20px', borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
              {[200, 60, 80, 70, 80, 80].map((w, j) => <div key={j} style={{ height: 13, width: w, borderRadius: 6, background: '#e2e8f0' }} />)}
            </div>
          ))}

          {!loading && invoices.map((inv) => {
            const sm = STATUS_META[inv.status] ?? STATUS_META.PENDING;
            return (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 120px', gap: 16, padding: '14px 20px', borderTop: '1px solid #f8fafc', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{inv.description}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>#{inv.id} · {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('fr-FR') : '—'}</div>
                </div>
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{inv.invoiceMonth ?? '—'}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{fmt(inv.amountCents, inv.currency)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: sm.bg, color: sm.fg, fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.dot }} />{sm.label}
                </span>
                <span style={{ fontSize: 13, color: '#64748b' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}</span>
                <div>
                  {inv.status === 'PENDING' && (
                    <button onClick={() => setPayTarget(inv)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #10b981, #0ea5e9)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <SIcon name="CreditCard" size={12} color="#fff" />Payer
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!loading && invoices.length === 0 && (
            <div style={{ padding: '52px 20px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <SIcon name="Receipt" size={24} color="#cbd5e1" />
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Aucune facture</p>
              <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>Les factures mensuelles sont générées automatiquement</p>
            </div>
          )}
        </div>
      </div>

      {/* Add card modal (Stripe Elements) */}
      {stripePromise && showAddCard && (
        <Elements stripe={stripePromise}>
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={(e) => e.target === e.currentTarget && setShowAddCard(false)}>
            <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(15,23,42,0.22)', overflow: 'hidden' }}>
              <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SIcon name="CreditCard" size={19} color="#fff" />
                </div>
                <div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Ajouter une carte</h2></div>
                <button onClick={() => setShowAddCard(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SIcon name="X" size={14} color="#64748b" />
                </button>
              </div>
              <div style={{ padding: '20px 26px' }}>
                <AddCardForm onSuccess={() => { setShowAddCard(false); void loadData(); }} onCancel={() => setShowAddCard(false)} />
              </div>
            </div>
          </div>
        </Elements>
      )}

      <PayModal
        open={!!payTarget} invoice={payTarget} cards={cards} stripeInstance={stripeInstance}
        onClose={() => setPayTarget(null)}
        onPaid={() => void loadData()}
        onNeedCard={() => setShowAddCard(true)}
      />
    </div>
  );
}
