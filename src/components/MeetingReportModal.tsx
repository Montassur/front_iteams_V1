import { useEffect, useState } from 'react';
import { SIcon } from './icons/SIcon';
import { getMeeting } from '../api/meetings';
import type { MeetingDto, TaskStatus } from '../types/meeting';

interface Props {
  orgId: number;
  meetingId: number;
  onClose: () => void;
}

const TASK_LABEL: Record<TaskStatus, string> = {
  TO_DO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Faite',
};
const TASK_COLOR: Record<TaskStatus, string> = {
  TO_DO: '#64748b',
  IN_PROGRESS: '#f59e0b',
  DONE: '#10b981',
};

function fmtDateLong(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}
function fmtDateShort(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
}
function fmtTime(iso?: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export function MeetingReportModal({ orgId, meetingId, onClose }: Props) {
  const [meeting, setMeeting] = useState<MeetingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getMeeting(orgId, meetingId)
      .then(setMeeting)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [orgId, meetingId]);

  const print = () => window.print();

  const tasksByAssignee = (meeting?.tasks ?? []).reduce<Record<string, MeetingDto['tasks']>>((acc, t) => {
    const key = t.assigneeName ?? '— non assignée —';
    (acc[key] = acc[key] ?? []).push(t);
    return acc;
  }, {});

  return (
    <div className="ms-report-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .ms-report-overlay { position: static !important; background: #fff !important; padding: 0 !important; backdrop-filter: none !important; }
          .ms-report-overlay, .ms-report-overlay * { visibility: visible !important; }
          .ms-report-card { box-shadow: none !important; border: none !important; max-height: none !important; width: 100% !important; max-width: 100% !important; }
          .ms-report-no-print { display: none !important; }
        }
      `}</style>

      <div className="ms-report-card" style={{ width: '100%', maxWidth: 880, maxHeight: '94vh', background: '#fff', borderRadius: 16, boxShadow: '0 32px 80px rgba(15,23,42,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header with controls (hidden in print) */}
        <div className="ms-report-no-print" style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--ms-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="FileText" size={17} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Rapport de réunion</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Synthèse automatique — agenda, décisions et actions</p>
          </div>
          <button onClick={print} disabled={!meeting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: meeting ? 'var(--ms-accent)' : '#e2e8f0', color: meeting ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 13, cursor: meeting ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            <SIcon name="Printer" size={13} color={meeting ? '#fff' : '#94a3b8'} />
            Imprimer / PDF
          </button>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="X" size={14} color="#64748b" />
          </button>
        </div>

        {/* Report body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', color: '#0f172a' }}>
          {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div>}
          {error && <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>}

          {meeting && (
            <>
              {/* Cover */}
              <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 18, marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Rapport de réunion</div>
                <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{meeting.subject}</h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, fontSize: 12, color: '#475569' }}>
                  <Field icon="Building2" label="Organisation" value={meeting.organizationName} />
                  <Field icon="Calendar" label="Date" value={fmtDateLong(meeting.scheduledDateTime)} />
                  <Field icon="Clock" label="Heure" value={`${fmtTime(meeting.scheduledDateTime)} · ${meeting.plannedDurationMinutes} min`} />
                  <Field icon="UserCheck" label="Modérateur" value={meeting.moderatorName ?? '—'} />
                </div>
                {meeting.description && (
                  <p style={{ marginTop: 14, color: '#475569', fontSize: 13, lineHeight: 1.55 }}>{meeting.description}</p>
                )}
              </div>

              {/* Participants */}
              <Section title="Participants" icon="Users" count={meeting.participants.length}>
                {meeting.participants.length === 0 ? (
                  <Empty text="Aucun participant enregistré." />
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#0f172a', fontSize: 13, lineHeight: 1.8 }}>
                    {meeting.participants.map((p) => (
                      <li key={p.id}>
                        <strong>{p.userName}</strong> <span style={{ color: '#94a3b8' }}>· {p.role}</span> <span style={{ color: '#94a3b8' }}>({p.userEmail})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Points abordés (agenda) */}
              <Section title="Points abordés" icon="List" count={meeting.agendaItems.length}>
                {meeting.agendaItems.length === 0 ? (
                  <Empty text="Aucun point d'agenda renseigné." />
                ) : (
                  <ol style={{ margin: 0, paddingLeft: 20, color: '#0f172a', fontSize: 13, lineHeight: 1.7 }}>
                    {[...meeting.agendaItems].sort((a, b) => a.orderIndex - b.orderIndex).map((a) => (
                      <li key={a.id} style={{ marginBottom: 8 }}>
                        <strong>{a.title}</strong>
                        <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>
                          ({a.actualDurationMinutes != null
                            ? `${a.actualDurationMinutes} min sur ${a.allocatedDurationMinutes} prévues`
                            : `${a.allocatedDurationMinutes} min prévues`})
                        </span>
                        {a.description && (
                          <div style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>{a.description}</div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              {/* Décisions / Notes */}
              <Section title="Décisions et notes" icon="StickyNote">
                {meeting.collaborativeNote && meeting.collaborativeNote.trim().length > 0 ? (
                  <div style={{ whiteSpace: 'pre-wrap', color: '#0f172a', fontSize: 13, lineHeight: 1.65, background: '#fafbfc', border: '1px solid #e8edf2', borderRadius: 10, padding: '14px 16px' }}>
                    {meeting.collaborativeNote}
                  </div>
                ) : (
                  <Empty text="Aucune note collaborative pour cette réunion." />
                )}
              </Section>

              {/* Actions assignées */}
              <Section title="Actions assignées" icon="CheckSquare" count={meeting.tasks.length}>
                {meeting.tasks.length === 0 ? (
                  <Empty text="Aucune action n'a été assignée." />
                ) : (
                  <div style={{ overflow: 'hidden', border: '1px solid #e8edf2', borderRadius: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr', gap: 0, padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e8edf2', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <span>Action</span><span>Responsable</span><span>Échéance</span><span>Statut</span>
                    </div>
                    {meeting.tasks.map((t, i) => (
                      <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.3fr 1fr 1fr', gap: 0, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', fontSize: 12.5, color: '#0f172a' }}>
                        <span style={{ paddingRight: 10 }}>{t.description}</span>
                        <span style={{ color: t.assigneeName ? '#0f172a' : '#94a3b8' }}>{t.assigneeName ?? '— non assignée —'}</span>
                        <span style={{ color: t.dueDate ? '#0f172a' : '#94a3b8' }}>{t.dueDate ? fmtDateShort(t.dueDate) : '—'}</span>
                        <span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: `${TASK_COLOR[t.status]}18`, color: TASK_COLOR[t.status], fontSize: 11, fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TASK_COLOR[t.status] }} />
                            {TASK_LABEL[t.status]}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Récapitulatif par responsable */}
              {meeting.tasks.length > 0 && (
                <Section title="Récapitulatif par responsable" icon="UserCheck">
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#0f172a', fontSize: 13, lineHeight: 1.7 }}>
                    {Object.entries(tasksByAssignee).map(([name, tasks]) => {
                      const done = tasks.filter((x) => x.status === 'DONE').length;
                      return (
                        <li key={name} style={{ marginBottom: 6 }}>
                          <strong>{name}</strong> — {tasks.length} action{tasks.length > 1 ? 's' : ''} ({done} faite{done > 1 ? 's' : ''})
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              )}

              {/* Footer */}
              <div style={{ marginTop: 32, paddingTop: 14, borderTop: '1px solid #e8edf2', color: '#94a3b8', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                <span>Rapport généré automatiquement — MeetSync</span>
                <span>{new Date().toLocaleString('fr-FR')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <SIcon name={icon as any} size={13} color="#94a3b8" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function Section({ icon, title, count, children }: { icon: string; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <SIcon name={icon as any} size={14} color="#7c3aed" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{title}</h3>
        {count != null && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>({count})</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ margin: 0, color: '#94a3b8', fontSize: 12.5, fontStyle: 'italic' }}>{text}</p>;
}
