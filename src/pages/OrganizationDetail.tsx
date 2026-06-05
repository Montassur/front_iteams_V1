import { useEffect, useMemo, useState } from 'react';
import { listMemberships, removeMembership } from '../api/memberships';
import { getOrganization } from '../api/organizations';
import { getMeetingStats, getMeetings } from '../api/meetings';
import { SIcon } from '../components/icons/SIcon';
import type { User as SessionUser } from '../types';
import type { OrganizationDetail, OrganizationMembershipResponse } from '../types/admin';
import type { MeetingListItem, MeetingStatsDto } from '../types/meeting';

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

function StatsPanel({ stats, meetings, loading }: { stats: MeetingStatsDto | null; meetings: MeetingListItem[]; loading: boolean }) {
  // ── Frequency: meetings per week over the last 8 weeks ──────────────────────
  const weekBuckets = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; count: number; startMs: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now); start.setDate(now.getDate() - i * 7); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      const startMs = start.getTime();
      const endMs = end.getTime();
      const count = meetings.filter((m) => {
        const t = new Date(m.scheduledDateTime).getTime();
        return t >= startMs && t < endMs;
      }).length;
      buckets.push({
        label: start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        count,
        startMs,
      });
    }
    return buckets;
  }, [meetings]);

  const last30dCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return meetings.filter((m) => new Date(m.scheduledDateTime).getTime() >= cutoff).length;
  }, [meetings]);

  const last7dCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return meetings.filter((m) => new Date(m.scheduledDateTime).getTime() >= cutoff).length;
  }, [meetings]);

  const peakWeek = weekBuckets.reduce((max, b) => Math.max(max, b.count), 0);

  // ── Efficacité ──────────────────────────────────────────────────────────────
  const taskCompletion = stats && stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : null;
  const completionRate = stats && stats.totalMeetings > 0
    ? Math.round((stats.completedMeetings / stats.totalMeetings) * 100)
    : null;
  const cancellationRate = stats && stats.totalMeetings > 0
    ? Math.round((stats.cancelledMeetings / stats.totalMeetings) * 100)
    : null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
      <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SIcon name="BarChart3" size={14} color="#64748b" />
          <strong style={{ fontSize: 14, color: '#0f172a' }}>Statistiques</strong>
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Réservé aux managers et superviseurs</span>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chargement…</div>
      ) : !stats || stats.totalMeetings === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <SIcon name="BarChart3" size={20} color="#cbd5e1" />
          </div>
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Pas encore de données</p>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>Les statistiques apparaîtront après les premières réunions.</p>
        </div>
      ) : (
        <div style={{ padding: '18px 20px', display: 'grid', gap: 20 }}>
          {/* Top metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <MetricBlock icon="CalendarDays" accent="#0ea5e9"
              value={stats.totalMeetings.toString()} label="Réunions au total"
              sub={`${last30dCount} sur 30 j · ${last7dCount} sur 7 j`} />
            <MetricBlock icon="Clock" accent="#f59e0b"
              value={`${Math.round(stats.averageDurationMinutes)} min`} label="Durée moyenne"
              sub="par réunion" />
            <MetricBlock icon="Target" accent="#10b981"
              value={completionRate != null ? `${completionRate}%` : '—'} label="Taux de complétion"
              sub={`${stats.completedMeetings} terminées · ${stats.cancelledMeetings} annulées`} />
            <MetricBlock icon="CheckSquare" accent="#7c3aed"
              value={taskCompletion != null ? `${taskCompletion}%` : '—'} label="Efficacité (tâches)"
              sub={`${stats.completedTasks}/${stats.totalTasks} faites`} />
          </div>

          {/* Weekly frequency chart */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>Fréquence — 8 dernières semaines</strong>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round((last30dCount / 4) * 10) / 10} réunions/semaine en moyenne</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 4px' }}>
              {weekBuckets.map((b) => {
                const heightPct = peakWeek > 0 ? (b.count / peakWeek) * 100 : 0;
                return (
                  <div key={b.startMs} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{b.count || ''}</div>
                    <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${Math.max(heightPct, b.count > 0 ? 6 : 0)}%`,
                        background: b.count > 0 ? 'linear-gradient(180deg, #6366f1, #8b5cf6)' : '#f1f5f9',
                        borderRadius: 4,
                        transition: 'height 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Effectiveness rows */}
          <div style={{ display: 'grid', gap: 10 }}>
            <ProgressRow label="Réunions terminées" value={completionRate ?? 0} color="#10b981"
              caption={`${stats.completedMeetings}/${stats.totalMeetings}`} />
            <ProgressRow label="Tâches accomplies" value={taskCompletion ?? 0} color="#7c3aed"
              caption={`${stats.completedTasks}/${stats.totalTasks}`} />
            <ProgressRow label="Réunions annulées" value={cancellationRate ?? 0} color="#ef4444"
              caption={`${stats.cancelledMeetings}/${stats.totalMeetings}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBlock({ icon, accent, value, label, sub }: { icon: string; accent: string; value: string; label: string; sub?: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SIcon name={icon as any} size={15} color={accent} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ProgressRow({ label, value, color, caption }: { label: string; value: number; color: string; caption?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: '#475569', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#94a3b8' }}>{caption} · <strong style={{ color: '#0f172a' }}>{value}%</strong></span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export function OrganizationDetailPage({ organizationId, user, onBack }: Props) {
  const canRemove = ['OWNER', 'ADMIN'].includes(user.globalRole ?? '');
  const canSeeStats = ['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER'].includes(user.globalRole ?? '');
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<OrganizationMembershipResponse[]>([]);
  const [stats, setStats] = useState<MeetingStatsDto | null>(null);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
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

  useEffect(() => {
    if (!canSeeStats) return;
    setStatsLoading(true);
    Promise.all([
      getMeetingStats(organizationId).catch(() => null),
      getMeetings(organizationId).catch(() => [] as MeetingListItem[]),
    ]).then(([s, m]) => {
      setStats(s);
      setMeetings(m);
    }).finally(() => setStatsLoading(false));
  }, [organizationId, canSeeStats]);

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

            {/* Statistiques (managers / supervisors / owners only) */}
            {canSeeStats && (
              <StatsPanel stats={stats} meetings={meetings} loading={statsLoading} />
            )}

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
