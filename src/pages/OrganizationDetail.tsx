import { useEffect, useMemo, useState } from 'react';
import { listMemberships, removeMembership } from '../api/memberships';
import { getOrganization } from '../api/organizations';
import { SIcon } from '../components/icons/SIcon';
import type { User as SessionUser } from '../types';
import type { OrganizationDetail, OrganizationMembershipResponse } from '../types/admin';

interface Props { organizationId: number; user: SessionUser; onBack: () => void; }

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#3b82f6'], ['#10b981', '#06b6d4'],
  ['#f59e0b', '#f97316'], ['#ec4899', '#a855f7'], ['#14b8a6', '#22d3ee'],
];
const orgGradient = (name: string) => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

const avatarGradients = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#6366f1'], ['#10b981', '#0ea5e9'],
  ['#f59e0b', '#ef4444'], ['#ec4899', '#8b5cf6'], ['#14b8a6', '#06b6d4'],
];
const memberAvatar = (name: string) => avatarGradients[name.charCodeAt(0) % avatarGradients.length];

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <SIcon name={icon as any} size={18} color={accent} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{value}</div>
      </div>
    </div>
  );
}

export function OrganizationDetailPage({ organizationId, user, onBack }: Props) {
  const canRemove = ['OWNER', 'ADMIN'].includes(user.globalRole ?? '');
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<OrganizationMembershipResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [org, memberList] = await Promise.all([
        getOrganization(organizationId),
        listMemberships(organizationId),
      ]);
      setOrganization(org);
      setMembers(memberList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [organizationId]);

  const filtered = useMemo(
    () => members.filter((m) => `${m.userName ?? ''} ${m.userId}`.toLowerCase().includes(search.toLowerCase())),
    [members, search],
  );

  const remove = async (membershipId: number) => {
    if (!window.confirm(`Retirer ce membre de l'organisation ?`)) return;
    setRemoving(membershipId);
    try {
      await removeMembership(organizationId, membershipId);
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } finally {
      setRemoving(null);
    }
  };

  const [c1, c2] = organization ? orgGradient(organization.name) : ['#6366f1', '#8b5cf6'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#475569', fontFamily: 'inherit' }}>
          <SIcon name="ArrowLeft" size={14} color="#475569" />
          Retour
        </button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        {organization && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 11 }}>
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{organization.name}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 12px' }}>
          <SIcon name="Search" size={13} color="#94a3b8" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer les membres…" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, fontFamily: 'inherit', width: 160 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><SIcon name="X" size={13} color="#94a3b8" /></button>}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, marginBottom: 16 }}>
            <SIcon name="AlertCircle" size={15} color="#ef4444" />
            <span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ height: 130, borderRadius: 16, background: '#fff', border: '1px solid #e8edf2' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 72, borderRadius: 14, background: '#fff', border: '1px solid #e8edf2' }} />)}
            </div>
            <div style={{ height: 200, borderRadius: 16, background: '#fff', border: '1px solid #e8edf2' }} />
          </div>
        )}

        {!loading && organization && (
          <div style={{ display: 'grid', gap: 16 }}>

            {/* Hero card */}
            <div style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
              <div style={{ height: 6, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 58, height: 58, borderRadius: 14, flexShrink: 0, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 20, boxShadow: `0 4px 14px ${c1}50` }}>
                  {organization.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a' }}>{organization.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 13, marginTop: 4 }}>
                    <SIcon name="MapPin" size={12} color="#94a3b8" />
                    {organization.address ?? 'Adresse non renseignée'}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <StatCard icon="Briefcase" label="Société" value={organization.companyName ?? (organization.companyId ? `#${organization.companyId}` : '—')} accent="#0ea5e9" />
              <StatCard icon="Shield" label="Propriétaire" value={organization.ownerName ?? (organization.ownerId ? `#${organization.ownerId}` : '—')} accent="#7c3aed" />
              <StatCard icon="Users" label="Membres" value={members.length} accent="#10b981" />
            </div>

            {/* Members list */}
            <div style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
              <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SIcon name="Users" size={14} color="#64748b" />
                  <strong style={{ fontSize: 14, color: '#0f172a' }}>Membres</strong>
                </div>
                <span style={{ background: '#e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{filtered.length}</span>
              </div>

              {filtered.map((m) => {
                const initials = (m.userName ?? '?').split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
                const [a1, a2] = memberAvatar(m.userName ?? '?');
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 18px', borderTop: '1px solid #f8fafc', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${a1}, ${a2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, boxShadow: `0 2px 6px ${a1}50` }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{m.userName ?? `Utilisateur #${m.userId}`}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>ID {m.userId}{m.createdAt ? ` · Ajouté le ${new Date(m.createdAt).toLocaleDateString('fr-FR')}` : ''}</div>
                    </div>
                    {canRemove && (
                      <button
                        onClick={() => remove(m.id)}
                        disabled={removing === m.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #fecaca', color: removing === m.id ? '#94a3b8' : '#b91c1c', background: '#fff', borderRadius: 9, cursor: removing === m.id ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.12s' }}
                        onMouseEnter={(e) => { if (removing !== m.id) { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#f87171'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#fecaca'; }}>
                        <SIcon name="UserMinus" size={13} color={removing === m.id ? '#94a3b8' : '#b91c1c'} />
                        {removing === m.id ? 'Retrait…' : 'Retirer'}
                      </button>
                    )}
                  </div>
                );
              })}

              {!filtered.length && (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <SIcon name="Users" size={20} color="#cbd5e1" />
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{search ? 'Aucun résultat' : 'Aucun membre'}</p>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
                    {search ? `Aucun membre ne correspond à « ${search} »` : "Cette organisation n'a encore aucun membre."}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
