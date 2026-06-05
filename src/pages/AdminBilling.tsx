import { useCallback, useEffect, useState } from 'react';
import { listAdminCompanies, toggleCompanyActive, listAdminInvoices, generateMonthlyInvoices } from '../api/adminBilling';
import { SIcon } from '../components/icons/SIcon';
import type { User } from '../types';
import type { CompanyAdmin, Invoice } from '../types/billing';

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);

const STATUS_META: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  PENDING:   { bg: '#fff7ed', fg: '#c2410c', dot: '#f97316', label: 'En attente' },
  PAID:      { bg: '#f0fdf4', fg: '#15803d', dot: '#22c55e', label: 'Payée' },
  CANCELLED: { bg: '#f8fafc', fg: '#64748b', dot: '#94a3b8', label: 'Annulée' },
};

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#3b82f6'], ['#10b981', '#06b6d4'],
  ['#f59e0b', '#f97316'], ['#ec4899', '#a855f7'], ['#14b8a6', '#22d3ee'],
];
const companyGrad = (name: string) => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

/* ─── Company Card ─────────────────────────────────────────────── */
function CompanyCard({ company, onToggle }: { company: CompanyAdmin; onToggle: (c: CompanyAdmin) => void }) {
  const [loading, setLoading] = useState(false);
  const [c1, c2] = companyGrad(company.name);
  const initials = company.name.slice(0, 2).toUpperCase();

  const handleToggle = async () => {
    try { setLoading(true); await onToggle(company); } finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${company.active ? '#e8edf2' : '#fecaca'}`, padding: '20px', boxShadow: '0 1px 4px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 14, transition: 'all 0.2s', opacity: company.active ? 1 : 0.75 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0, boxShadow: `0 4px 12px ${c1}50` }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.name}</div>
          {company.registryNumber && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Reg. {company.registryNumber}</div>}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: company.active ? '#f0fdf4' : '#fef2f2', color: company.active ? '#15803d' : '#b91c1c', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: company.active ? '#22c55e' : '#ef4444' }} />
          {company.active ? 'Actif' : 'Désactivé'}
        </span>
      </div>

      {/* Owner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
        <SIcon name="User" size={13} color="#94a3b8" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{company.ownerName}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{company.ownerEmail}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.4 }}>En attente</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#c2410c', marginTop: 2 }}>{company.pendingInvoicesCount}</div>
          {company.totalPendingAmountCents > 0 && (
            <div style={{ fontSize: 10, color: '#f97316', marginTop: 1 }}>{fmt(company.totalPendingAmountCents, company.currency)}</div>
          )}
        </div>
        <div style={{ padding: '10px 12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.4 }}>Payées</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d', marginTop: 2 }}>{company.paidInvoicesCount}</div>
        </div>
      </div>

      {/* Toggle button */}
      <button onClick={handleToggle} disabled={loading} style={{
        width: '100%', padding: '9px', borderRadius: 10, border: `1.5px solid ${company.active ? '#fecaca' : '#bbf7d0'}`,
        background: company.active ? '#fef2f2' : '#f0fdf4',
        color: company.active ? '#b91c1c' : '#15803d',
        fontWeight: 700, fontSize: 13, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: loading ? 0.6 : 1,
        transition: 'all 0.15s',
      }}>
        <SIcon name={company.active ? 'Ban' : 'CheckCircle'} size={14} color="currentColor" />
        {loading ? '…' : company.active ? 'Désactiver' : 'Réactiver'}
      </button>
    </div>
  );
}

/* ─── Companies Tab ─────────────────────────────────────────────── */
function TabCompanies() {
  const [companies, setCompanies] = useState<CompanyAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const load = useCallback(async () => {
    try { setLoading(true); setError(''); setCompanies((await listAdminCompanies()).companies); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (company: CompanyAdmin) => {
    const updated = await toggleCompanyActive(company.id);
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const filtered = companies.filter((c) => {
    const matchSearch = `${c.name} ${c.ownerName} ${c.ownerEmail}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? c.active : !c.active);
    return matchSearch && matchFilter;
  });

  const stats = {
    total: companies.length,
    active: companies.filter((c) => c.active).length,
    inactive: companies.filter((c) => !c.active).length,
    pendingTotal: companies.reduce((s, c) => s + c.totalPendingAmountCents, 0),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats row */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total sociétés', value: stats.total, icon: 'Building2', grad: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
            { label: 'Actives', value: stats.active, icon: 'CheckCircle', grad: 'linear-gradient(135deg, #10b981, #06b6d4)' },
            { label: 'Désactivées', value: stats.inactive, icon: 'Ban', grad: 'linear-gradient(135deg, #ef4444, #f97316)' },
            { label: 'Total en attente', value: stats.pendingTotal > 0 ? fmt(stats.pendingTotal, 'USD') : '—', icon: 'Clock', grad: 'linear-gradient(135deg, #f97316, #f59e0b)' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: s.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SIcon name={s.icon as any} size={14} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & filter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <SIcon name="Search" size={13} color="#94a3b8" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, fontFamily: 'inherit', width: '100%', color: '#0f172a' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><SIcon name="X" size={13} color="#94a3b8" /></button>}
        </div>
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid', borderColor: filter === f ? '#6366f1' : '#e2e8f0', background: filter === f ? '#f5f3ff' : '#fff', color: filter === f ? '#6366f1' : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {f === 'all' ? 'Toutes' : f === 'active' ? 'Actives' : 'Désactivées'}
          </button>
        ))}
      </div>

      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}><SIcon name="AlertCircle" size={14} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span></div>}

      {/* Company cards grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 220, borderRadius: 16, background: '#e2e8f0' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <SIcon name="Building2" size={40} color="#cbd5e1" />
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '12px 0 0' }}>{search ? 'Aucun résultat' : 'Aucune société'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((c) => (
            <CompanyCard key={c.id} company={c} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Invoices Tab ──────────────────────────────────────────────── */
function TabInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'CANCELLED'>('ALL');
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(''); setInvoices((await listAdminInvoices()).invoices); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleGenerate = async () => {
    try {
      setGenerating(true); setGenerateResult(null);
      const res = await generateMonthlyInvoices();
      setGenerateResult(`${res.generated} facture(s) générée(s) pour ce mois.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur génération'); }
    finally { setGenerating(false); }
  };

  const filtered = invoices.filter((inv) => {
    const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const matchSearch = `${inv.companyName ?? ''} ${inv.ownerEmail ?? ''} ${inv.description} ${inv.invoiceMonth ?? ''}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === 'PENDING').length,
    paid: invoices.filter((i) => i.status === 'PAID').length,
    pendingAmount: invoices.filter((i) => i.status === 'PENDING').reduce((s, i) => s + i.amountCents, 0),
    paidAmount: invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amountCents, 0),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total', value: stats.total, icon: 'FileText', grad: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
            { label: 'En attente', value: `${stats.pending} · ${stats.pendingAmount > 0 ? fmt(stats.pendingAmount, invoices.find(i => i.status === 'PENDING')?.currency ?? 'USD') : '—'}`, icon: 'Clock', grad: 'linear-gradient(135deg, #f97316, #f59e0b)' },
            { label: 'Payées', value: `${stats.paid} · ${stats.paidAmount > 0 ? fmt(stats.paidAmount, invoices.find(i => i.status === 'PAID')?.currency ?? 'USD') : '—'}`, icon: 'CheckCircle', grad: 'linear-gradient(135deg, #10b981, #06b6d4)' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: s.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SIcon name={s.icon as any} size={14} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <SIcon name="Search" size={13} color="#94a3b8" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Société, email, mois…" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, fontFamily: 'inherit', width: '100%', color: '#0f172a' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><SIcon name="X" size={13} color="#94a3b8" /></button>}
        </div>
        {(['ALL', 'PENDING', 'PAID', 'CANCELLED'] as const).map((s) => {
          const labels: Record<string, string> = { ALL: 'Toutes', PENDING: 'En attente', PAID: 'Payées', CANCELLED: 'Annulées' };
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid', borderColor: statusFilter === s ? '#6366f1' : '#e2e8f0', background: statusFilter === s ? '#f5f3ff' : '#fff', color: statusFilter === s ? '#6366f1' : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {labels[s]}
            </button>
          );
        })}
        <button onClick={handleGenerate} disabled={generating} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: 'none', background: generating ? '#c7d2fe' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>
          <SIcon name="Zap" size={14} color="#fff" />
          {generating ? 'Génération…' : 'Générer ce mois'}
        </button>
      </div>

      {generateResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <SIcon name="CheckCircle" size={14} color="#16a34a" /><span style={{ color: '#15803d', fontSize: 13 }}>{generateResult}</span>
        </div>
      )}
      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}><SIcon name="AlertCircle" size={14} color="#ef4444" /><span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span></div>}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8edf2', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', gap: 12, padding: '11px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          {['Description', 'Société', 'Montant', 'Statut', 'Mois', 'Échéance'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>

        {loading && [1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 18px', borderTop: '1px solid #f1f5f9' }}>
            {[160, 120, 70, 70, 60, 80].map((w, j) => <div key={j} style={{ height: 13, width: w, borderRadius: 6, background: '#e2e8f0' }} />)}
          </div>
        ))}

        {!loading && filtered.map((inv) => {
          const sm = STATUS_META[inv.status] ?? STATUS_META.PENDING;
          return (
            <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', gap: 12, padding: '13px 18px', borderTop: '1px solid #f8fafc', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.description}</div>
                {inv.ownerEmail && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{inv.ownerEmail}</div>}
              </div>
              <div style={{ fontSize: 13, color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.companyName ?? '—'}</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{fmt(inv.amountCents, inv.currency)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: sm.bg, color: sm.fg, fontSize: 10, fontWeight: 800, width: 'fit-content' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: sm.dot }} />{sm.label}
              </span>
              <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{inv.invoiceMonth ?? '—'}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <SIcon name="Receipt" size={32} color="#cbd5e1" />
            <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 13 }}>{search || statusFilter !== 'ALL' ? 'Aucun résultat' : 'Aucune facture — cliquez sur « Générer ce mois » pour démarrer'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main AdminBilling Page ──────────────────────────────────────── */
interface Props { user: User }

const TABS = [
  { id: 'companies', label: 'Sociétés', icon: 'Building2' },
  { id: 'invoices',  label: 'Facturations', icon: 'Receipt' },
];

export function AdminBillingPage({ user }: Props) {
  const [activeTab, setActiveTab] = useState('companies');

  if (user.globalRole !== 'ADMIN') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#f8fafc' }}>
        <SIcon name="Lock" size={40} color="#cbd5e1" />
        <p style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'Inter, sans-serif', margin: 0 }}>Accès réservé à l'administrateur</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', flexShrink: 0 }}>
        <div style={{ width: 31, height: 31, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SIcon name="LayoutDashboard" size={14} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Administration — Facturation</span>
        <div style={{ flex: 1 }} />
        {/* Tabs in topbar */}
        <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700,
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#0f172a' : '#64748b',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
              transition: 'all 0.13s',
            }}>
              <SIcon name={tab.icon as any} size={13} color={activeTab === tab.id ? '#6366f1' : '#94a3b8'} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 22px' }}>
        {activeTab === 'companies' && <TabCompanies />}
        {activeTab === 'invoices'  && <TabInvoices />}
      </div>
    </div>
  );
}
