import { useState, useEffect, useCallback } from 'react';
import { SIcon } from '../components/icons/SIcon';
import { MeetingReportModal } from '../components/MeetingReportModal';
import type { PageId, User } from '../types';
import type { MeetingListItem, MeetingStatus, CreateMeetingPayload } from '../types/meeting';
import { getMeetings, createMeeting, deleteMeeting, updateMeeting } from '../api/meetings';
import { listOrganizations } from '../api/organizations';
import { todayInputValue, tomorrowInputValue, nextQuarterHourValue, localTimeInputValue } from '../utils/dateInput';
import type { OrganizationSummary } from '../types/admin';

interface MeetingsProps {
  user: User;
  selectedOrgId: number | null;
  setPage: (p: PageId) => void;
  onJoinMeeting: (meetingId: number, orgId: number) => void;
}

type Filter = 'all' | 'upcoming' | 'past';

export function Meetings({ user, selectedOrgId, setPage: _setPage, onJoinMeeting }: MeetingsProps) {
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<number | null>(selectedOrgId);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MeetingListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reportFor, setReportFor] = useState<{ orgId: number; meetingId: number } | null>(null);
  const [startingInstant, setStartingInstant] = useState(false);

  // Create a meeting that's scheduled "right now" and immediately jump into it.
  const handleStartInstant = async () => {
    if (!activeOrgId || startingInstant) return;
    setStartingInstant(true);
    try {
      // Stamp 60s in the past so the server's "scheduled in the future" gate
      // can't reject the join due to clock skew between client and server.
      const start = new Date(Date.now() - 60_000);
      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}T${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}:${String(start.getSeconds()).padStart(2, '0')}`;
      const created = await createMeeting(activeOrgId, {
        subject: 'Réunion instantanée',
        description: 'Démarrée à la volée',
        scheduledDateTime: iso,
        plannedDurationMinutes: 60,
      });
      const item: MeetingListItem = {
        id: created.id, subject: created.subject, description: created.description,
        scheduledDateTime: created.scheduledDateTime, plannedDurationMinutes: created.plannedDurationMinutes,
        status: created.status, organizationId: created.organizationId, organizationName: created.organizationName,
        moderatorId: created.moderatorId, moderatorName: created.moderatorName,
        participantCount: created.participants.length,
        agendaItemCount: created.agendaItems.length,
        taskCount: created.tasks.length,
      };
      setMeetings((prev) => [item, ...prev]);
      onJoinMeeting(created.id, created.organizationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer la réunion');
    } finally {
      setStartingInstant(false);
    }
  };

  const canManage = ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(user.globalRole ?? '');

  useEffect(() => {
    listOrganizations().then(({ organizations }) => {
      setOrgs(organizations);
      if (!activeOrgId && organizations.length > 0) setActiveOrgId(organizations[0].id);
    }).catch(() => {});
  }, []);

  const loadMeetings = useCallback(async (orgId: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await getMeetings(orgId);
      setMeetings(data);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeOrgId) loadMeetings(activeOrgId);
    else setMeetings([]);
  }, [activeOrgId, loadMeetings]);

  const now = new Date().toISOString();
  const filtered = meetings.filter((m) => {
    if (filter === 'upcoming' && (m.status === 'COMPLETED' || m.status === 'CANCELLED' || m.scheduledDateTime < now)) return false;
    if (filter === 'past' && m.scheduledDateTime >= now && m.status !== 'COMPLETED' && m.status !== 'CANCELLED') return false;
    if (search && !m.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const today = todayInputValue();
  const tomorrow = tomorrowInputValue();
  const grouped = filtered.reduce<Record<string, MeetingListItem[]>>((acc, m) => {
    const day = m.scheduledDateTime.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(m);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (d: string) => {
    if (d === today) return "Aujourd'hui";
    if (d === tomorrow) return 'Demain';
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const handleDelete = async (m: MeetingListItem) => {
    if (!activeOrgId || !window.confirm(`Supprimer "${m.subject}" ?`)) return;
    try {
      await deleteMeeting(activeOrgId, m.id);
      setMeetings((prev) => prev.filter((x) => x.id !== m.id));
      if (selected?.id === m.id) setSelected(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleStatusChange = async (m: MeetingListItem, status: MeetingStatus) => {
    if (!activeOrgId) return;
    try {
      await updateMeeting(activeOrgId, m.id, { status });
      setMeetings((prev) => prev.map((x) => x.id === m.id ? { ...x, status } : x));
      if (selected?.id === m.id) setSelected((s) => s ? { ...s, status } : s);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f1f5f9', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: 'var(--ms-border-width) solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 var(--ms-pad)', gap: 10, flexShrink: 0, position: 'sticky', top: 0, zIndex: 5, boxShadow: 'var(--ms-shadow-top)' }}>
          <h2 style={{ color: '#0f172a', fontWeight: 700, fontSize: 15, marginRight: 4, flexShrink: 0 }}>Réunions</h2>

          {/* Org selector */}
          {orgs.length > 1 && (
            <select value={activeOrgId ?? ''} onChange={(e) => setActiveOrgId(Number(e.target.value))}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #e2e8f0', background: '#f8fafc', color: '#334155', fontFamily: 'inherit', cursor: 'pointer' }}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {orgs.length === 1 && (
            <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #e2e8f0' }}>{orgs[0]?.name}</span>
          )}

          {(['all', 'upcoming', 'past'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 10px', borderRadius: 'var(--ms-radius-sm)', border: 'none', cursor: 'pointer',
              background: filter === f ? 'var(--ms-accent-pale)' : 'transparent',
              color: filter === f ? 'var(--ms-accent)' : '#64748b',
              fontWeight: filter === f ? 600 : 400, fontSize: 12, transition: 'all 0.13s', fontFamily: 'inherit',
            }}>
              {f === 'all' ? 'Toutes' : f === 'upcoming' ? 'À venir' : 'Passées'}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 'var(--ms-radius-sm)', padding: '5px 10px', border: 'var(--ms-border-width) solid #e2e8f0' }}>
            <SIcon name="Search" size={13} color="#94a3b8" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#0f172a', fontFamily: 'inherit', width: 150 }} />
          </div>

          {canManage && activeOrgId && (
            <>
              <button onClick={() => setShowCreate(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 'var(--ms-radius-sm)', border: 'none',
                background: 'var(--ms-accent)', color: '#fff', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px var(--ms-accent-glow)', flexShrink: 0,
              }}>
                <SIcon name="Plus" size={14} color="#fff" sw={2.5} />
                Nouvelle réunion
              </button>
              <button onClick={handleStartInstant} disabled={startingInstant} title="Créer et démarrer immédiatement" style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 'var(--ms-radius-sm)', border: '1px solid #16a34a',
                background: startingInstant ? '#86efac' : '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13,
                cursor: startingInstant ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                boxShadow: '0 1px 4px rgba(22,163,74,0.35)',
              }}>
                <SIcon name="Video" size={14} color="#fff" sw={2.5} />
                {startingInstant ? 'Démarrage…' : 'Démarrer maintenant'}
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px var(--ms-pad) 32px' }}>
          {!activeOrgId ? (
            <EmptyState icon="Building2" message="Aucune organisation sélectionnée" />
          ) : loading ? (
            <EmptyState icon="Loader" message="Chargement…" />
          ) : error ? (
            <EmptyState icon="AlertCircle" message={error} />
          ) : sortedDates.length === 0 ? (
            <EmptyState icon="CalendarX" message="Aucune réunion trouvée" />
          ) : sortedDates.map((date) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ color: date === today ? 'var(--ms-accent)' : '#64748b', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{formatDate(date)}</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{grouped[date].length} réunion{grouped[date].length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[date].map((m) => (
                  <MeetingRow key={m.id} meeting={m}
                    selected={selected?.id === m.id}
                    canManage={canManage}
                    onClick={() => setSelected((s) => s?.id === m.id ? null : m)}
                    onJoin={() => onJoinMeeting(m.id, m.organizationId)}
                    onDelete={() => handleDelete(m)}
                    onStatusChange={(st) => handleStatusChange(m, st)}
                    onReport={() => setReportFor({ orgId: m.organizationId, meetingId: m.id })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <MeetingDetailPanel
          meeting={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onJoin={() => onJoinMeeting(selected.id, selected.organizationId)}
          onDelete={() => handleDelete(selected)}
          onReport={() => setReportFor({ orgId: selected.organizationId, meetingId: selected.id })}
        />
      )}

      {reportFor && (
        <MeetingReportModal
          orgId={reportFor.orgId}
          meetingId={reportFor.meetingId}
          onClose={() => setReportFor(null)}
        />
      )}

      {showCreate && activeOrgId && (
        <CreateMeetingModal
          orgId={activeOrgId}
          onClose={() => setShowCreate(false)}
          onCreated={(m) => { setMeetings((prev) => [m, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function statusColor(s: MeetingStatus) {
  if (s === 'COMPLETED') return '#10b981';
  if (s === 'IN_PROGRESS') return '#f59e0b';
  if (s === 'CANCELLED') return '#ef4444';
  return '#3b82f6';
}
function statusLabel(s: MeetingStatus) {
  if (s === 'COMPLETED') return 'Terminée';
  if (s === 'IN_PROGRESS') return 'En cours';
  if (s === 'CANCELLED') return 'Annulée';
  return 'Planifiée';
}

interface MeetingRowProps {
  meeting: MeetingListItem;
  selected: boolean;
  canManage: boolean;
  onClick: () => void;
  onJoin: () => void;
  onDelete: () => void;
  onStatusChange: (s: MeetingStatus) => void;
  onReport: () => void;
}

function MeetingRow({ meeting: m, selected, canManage, onClick, onJoin, onDelete, onStatusChange, onReport }: MeetingRowProps) {
  const color = statusColor(m.status);
  const time = new Date(m.scheduledDateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div onClick={onClick} style={{
      background: selected ? 'var(--ms-accent-pale)' : '#fff',
      borderRadius: 'var(--ms-radius)', padding: '13px 16px',
      border: `var(--ms-border-width) solid ${selected ? 'var(--ms-accent-border)' : '#e8edf2'}`,
      cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: selected ? 'var(--ms-shadow-md)' : 'var(--ms-shadow)',
    }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = '#cbd5e1'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = '#e8edf2'; }}>
      <div style={{ width: 40, height: 40, borderRadius: 'var(--ms-radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <SIcon name="Video" size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, flexShrink: 0, background: `${color}15`, color }}>{statusLabel(m.status)}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, color: '#94a3b8', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><SIcon name="Clock" size={12} color="#cbd5e1" />{time}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><SIcon name="Timer" size={12} color="#cbd5e1" />{m.plannedDurationMinutes} min</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><SIcon name="Users" size={12} color="#cbd5e1" />{m.participantCount}</span>
          {m.agendaItemCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><SIcon name="List" size={12} color="#cbd5e1" />{m.agendaItemCount} pts</span>}
          {m.taskCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><SIcon name="CheckSquare" size={12} color="#cbd5e1" />{m.taskCount}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {m.status === 'SCHEDULED' && (
          <>
            {new Date(m.scheduledDateTime).getTime() <= Date.now() ? (
              <>
                <button onClick={onJoin} style={{ padding: '5px 12px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Rejoindre</button>
                {canManage && (
                  <button onClick={() => onStatusChange('COMPLETED')} title="Marquer terminée" style={{ padding: '5px 8px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                )}
              </>
            ) : (
              <>
                <span title={`Démarre à ${time}`} style={{ padding: '5px 10px', borderRadius: 'var(--ms-radius-sm)', background: '#f1f5f9', color: '#64748b', fontSize: 11, fontWeight: 600 }}>Pas encore</span>
                {canManage && (
                  <button onClick={() => onStatusChange('CANCELLED')} title="Annuler la réunion" style={{ padding: '5px 8px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                )}
              </>
            )}
          </>
        )}
        {m.status === 'COMPLETED' && (
          <>
            <button onClick={onReport} title="Voir le rapport" style={{ padding: '5px 10px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
              <SIcon name="FileText" size={12} color="#475569" /> Rapport
            </button>
            <span style={{ padding: '3px 8px', borderRadius: 'var(--ms-radius-sm)', background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600 }}>Terminée</span>
          </>
        )}
        {m.status === 'IN_PROGRESS' && (
          <button onClick={onJoin} style={{ padding: '5px 12px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Rejoindre</button>
        )}
        {canManage && (
          <button onClick={() => onDelete()} title="Supprimer" style={{ padding: '5px 6px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #fecaca', background: '#fff5f5', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            <SIcon name="Trash2" size={12} color="#ef4444" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  meeting: MeetingListItem;
  canManage: boolean;
  onClose: () => void;
  onJoin: () => void;
  onDelete: () => void;
  onReport: () => void;
}

function MeetingDetailPanel({ meeting: m, canManage, onClose, onJoin, onDelete, onReport }: DetailPanelProps) {
  const color = statusColor(m.status);
  const dt = new Date(m.scheduledDateTime);
  const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ width: 340, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>Détails</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <SIcon name="X" size={15} color="#94a3b8" />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--ms-radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SIcon name="Video" size={20} color={color} />
          </div>
          <div>
            <h2 style={{ color: '#0f172a', fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{m.subject}</h2>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: `${color}15`, color }}>{statusLabel(m.status)}</span>
          </div>
        </div>
        {m.description && (
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{m.description}</p>
        )}
        {[
          { icon: 'Calendar', label: 'Date', value: dateStr },
          { icon: 'Clock', label: 'Heure', value: timeStr },
          { icon: 'Timer', label: 'Durée', value: `${m.plannedDurationMinutes} minutes` },
          { icon: 'Users', label: 'Participants', value: `${m.participantCount} personne${m.participantCount > 1 ? 's' : ''}` },
          { icon: 'List', label: 'Agenda', value: `${m.agendaItemCount} point${m.agendaItemCount > 1 ? 's' : ''}` },
          { icon: 'CheckSquare', label: 'Tâches', value: `${m.taskCount} tâche${m.taskCount > 1 ? 's' : ''}` },
          { icon: 'Building2', label: 'Organisation', value: m.organizationName },
          { icon: 'User', label: 'Modérateur', value: m.moderatorName ?? '—' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
            <SIcon name={row.icon} size={14} color="#94a3b8" />
            <span style={{ color: '#94a3b8', fontSize: 12, width: 90, flexShrink: 0 }}>{row.label}</span>
            <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', gap: 8 }}>
        {canManage && (
          <button onClick={onDelete} style={{ padding: '8px 12px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #fecaca', background: '#fff5f5', color: '#ef4444', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <SIcon name="Trash2" size={13} color="#ef4444" />
          </button>
        )}
        {m.status === 'IN_PROGRESS' && (
          <button onClick={onJoin} style={{ flex: 1, padding: 9, borderRadius: 'var(--ms-radius-sm)', border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 8px ${color}44` }}>Rejoindre</button>
        )}
        {m.status === 'COMPLETED' && (
          <button onClick={onReport} style={{ flex: 1, padding: 9, borderRadius: 'var(--ms-radius-sm)', border: 'none', background: 'var(--ms-accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px var(--ms-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <SIcon name="FileText" size={14} color="#fff" /> Voir le rapport
          </button>
        )}
        {m.status === 'SCHEDULED' && (
          new Date(m.scheduledDateTime).getTime() <= Date.now() ? (
            <button onClick={onJoin} style={{ flex: 1, padding: 9, borderRadius: 'var(--ms-radius-sm)', border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 8px ${color}44` }}>Rejoindre</button>
          ) : (
            <div style={{ flex: 1, padding: 9, borderRadius: 'var(--ms-radius-sm)', background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }}>
              Pas encore commencée
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  orgId: number;
  onClose: () => void;
  onCreated: (m: MeetingListItem) => void;
}

function CreateMeetingModal({ orgId, onClose, onCreated }: CreateModalProps) {
  const today = todayInputValue();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  // Default time = next quarter-hour from now (today's date), so the meeting is
  // never auto-scheduled in the past.
  const [time, setTime] = useState(nextQuarterHourValue());
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [agendaItems, setAgendaItems] = useState<{ title: string; allocatedDurationMinutes: number }[]>([]);

  // When the date is today, restrict the time input to "now or later".
  // (When the date is in the future, no time constraint.)
  const isTodaySelected = date === today;
  const minTime = isTodaySelected ? localTimeInputValue() : undefined;

  // If the user picks today and the current `time` value is already in the past,
  // bump it forward to the next quarter-hour so submit can't fail.
  useEffect(() => {
    if (!isTodaySelected) return;
    const nowHM = localTimeInputValue();
    if (time < nowHM) setTime(nextQuarterHourValue());
  }, [isTodaySelected, date, time]);

  const addAgendaItem = () => setAgendaItems((prev) => [...prev, { title: '', allocatedDurationMinutes: 15 }]);
  const removeAgendaItem = (i: number) => setAgendaItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateAgendaItem = (i: number, field: string, value: string | number) =>
    setAgendaItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = async () => {
    if (!subject.trim()) { setErr("L'objet est requis"); return; }
    const scheduledMs = new Date(`${date}T${time}:00`).getTime();
    if (!Number.isFinite(scheduledMs) || scheduledMs <= Date.now()) {
      setErr('La date/heure doit être dans le futur.'); return;
    }
    setSaving(true); setErr('');
    try {
      const payload: CreateMeetingPayload = {
        subject: subject.trim(),
        description: description.trim() || undefined,
        scheduledDateTime: `${date}T${time}:00`,
        plannedDurationMinutes: duration,
        agendaItems: agendaItems.filter((a) => a.title.trim()),
      };
      const created = await createMeeting(orgId, payload);
      const item: MeetingListItem = {
        id: created.id, subject: created.subject, description: created.description,
        scheduledDateTime: created.scheduledDateTime, plannedDurationMinutes: created.plannedDurationMinutes,
        status: created.status, organizationId: created.organizationId, organizationName: created.organizationName,
        moderatorId: created.moderatorId, moderatorName: created.moderatorName,
        participantCount: created.participants.length,
        agendaItemCount: created.agendaItems.length,
        taskCount: created.tasks.length,
      };
      onCreated(item);
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 'var(--ms-radius)', width: 520, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px #0003', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: '#0f172a', fontSize: 15, fontWeight: 700 }}>Nouvelle réunion</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <SIcon name="X" size={16} color="#94a3b8" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Objet *">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Point hebdomadaire"
              style={inputStyle} />
          </FormField>
          <FormField label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Objectif de la réunion…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} />
          </FormField>
          <div style={{ display: 'flex', gap: 10 }}>
            <FormField label="Date *" style={{ flex: 1 }}>
              <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Heure *" style={{ width: 110 }}>
              <input type="time" value={time} min={minTime} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Durée (min)" style={{ width: 110 }}>
              <input type="number" value={duration} min={5} max={480} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle} />
            </FormField>
          </div>

          {/* Agenda */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Points de l'agenda</label>
              <button onClick={addAgendaItem} style={{ fontSize: 11, color: 'var(--ms-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>+ Ajouter</button>
            </div>
            {agendaItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input value={item.title} onChange={(e) => updateAgendaItem(i, 'title', e.target.value)} placeholder="Titre du point"
                  style={{ ...inputStyle, flex: 1 }} />
                <input type="number" value={item.allocatedDurationMinutes} min={1} onChange={(e) => updateAgendaItem(i, 'allocatedDurationMinutes', Number(e.target.value))}
                  title="Durée (min)" style={{ ...inputStyle, width: 70 }} />
                <span style={{ color: '#94a3b8', fontSize: 11 }}>min</span>
                <button onClick={() => removeAgendaItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                  <SIcon name="X" size={13} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: 13 }}>{err}</p>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: saving ? '#94a3b8' : 'var(--ms-accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Création…' : 'Créer la réunion'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--ms-radius-sm)',
  border: 'var(--ms-border-width) solid #e2e8f0', fontSize: 13, color: '#0f172a',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', background: '#fafafa',
};

function FormField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 12 }}>
      <SIcon name={icon} size={40} color="#cbd5e1" />
      <p style={{ color: '#94a3b8', fontSize: 14 }}>{message}</p>
    </div>
  );
}
