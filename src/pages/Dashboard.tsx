import { useState, useEffect } from 'react';
import { SIcon } from '../components/icons/SIcon';
import type { User, PageId, Task, Kpi } from '../types';

const MEETINGS_UPCOMING = [
  { id: 1, title: 'Stand-up Produit',       time: '10:00', duration: '15 min', participants: 4,  date: "Aujourd'hui", color: '#3b82f6' },
  { id: 2, title: 'Revue Sprint #24',        time: '14:30', duration: '60 min', participants: 8,  date: "Aujourd'hui", color: '#6366f1' },
  { id: 3, title: 'Point Client - Horizon',  time: '09:00', duration: '45 min', participants: 3,  date: 'Demain',      color: '#0ea5e9' },
  { id: 4, title: 'Comité de Direction',     time: '11:00', duration: '90 min', participants: 12, date: 'Jeudi',       color: '#ec4899' },
];
const RECENT_MEETINGS = [
  { id: 1, title: 'Point de Sync Hebdo', duration: '52 min', participants: 5,  date: 'Hier', tasks: 3, notes: true  },
  { id: 2, title: 'Retro Sprint #23',    duration: '48 min', participants: 7,  date: 'Lun.', tasks: 7, notes: true  },
  { id: 3, title: 'Présentation Q1',     duration: '35 min', participants: 11, date: 'Ven.', tasks: 2, notes: false },
];
const INITIAL_TASKS: Task[] = [
  { id: 1, text: 'Finaliser la roadmap Q2',     due: 'Demain', done: false, priority: 'high'   },
  { id: 2, text: 'Mettre à jour les KPIs',      due: 'Auj.',   done: false, priority: 'medium' },
  { id: 3, text: 'Rédiger le compte-rendu S17', due: 'Hier',   done: true,  priority: 'low'    },
  { id: 4, text: 'Préparer slides comité dir.', due: 'Jeudi',  done: false, priority: 'high'   },
];
const KPIS: Kpi[] = [
  { label: 'Réunions ce mois',    value: 24,    delta: '+3',  positive: true,  icon: 'CalendarDays', color: '#3b82f6' },
  { label: 'Durée moyenne',       value: '38m', delta: '-6m', positive: true,  icon: 'Clock',        color: '#10b981' },
  { label: 'Tâches assignées',    value: 17,    delta: '+5',  positive: false, icon: 'CheckSquare',  color: '#f59e0b' },
  { label: 'Participants actifs', value: 12,    delta: '+2',  positive: true,  icon: 'Users',        color: '#6366f1' },
];
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981'];
const AVATAR_LETTERS = ['M', 'P', 'S'];
const CHART_BARS = [65, 80, 45, 90, 60, 75, 55];
const CHART_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface DashboardProps { user: User; setPage: (p: PageId) => void; }

export function Dashboard({ user, setPage }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir');
  }, []);

  const firstName = user.name.split(' ')[0];
  const pending = tasks.filter((t) => !t.done).length;

  const toggleTask = (id: number) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      {/* Topbar */}
      <div style={{
        height: 'var(--ms-topbar)', background: '#fff',
        borderBottom: 'var(--ms-border-width) solid #e2e8f0',
        display: 'flex', alignItems: 'center', padding: '0 var(--ms-pad)',
        position: 'sticky', top: 0, zIndex: 5, gap: 12, flexShrink: 0,
        boxShadow: 'var(--ms-shadow-top)',
      }}>
        <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 15 }}>Tableau de bord</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 'var(--ms-radius-sm)', padding: '6px 12px', border: 'var(--ms-border-width) solid #e2e8f0', cursor: 'text' }}>
          <SIcon name="Search" size={14} color="#94a3b8" />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Rechercher…</span>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 'var(--ms-radius-sm)', border: 'var(--ms-border-width) solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <SIcon name="Bell" size={16} color="#64748b" />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff' }} />
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          {user.initials}
        </div>
      </div>

      <div style={{ padding: 'var(--ms-pad) var(--ms-pad) 48px', maxWidth: 1400 }}>
        {/* Salutation */}
        <div style={{ marginBottom: 'var(--ms-gap)' }}>
          <h1 style={{ color: '#0f172a', fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginBottom: 4 }}>
            {greeting}, {firstName} 👋
          </h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Vous avez <strong style={{ color: 'var(--ms-accent)' }}>2 réunions</strong> aujourd'hui et{' '}
            <strong style={{ color: '#f59e0b' }}>{pending} tâches</strong> en attente.
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--ms-gap)', marginBottom: 'var(--ms-gap)' }}>
          {KPIS.map((k) => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 'var(--ms-radius)', padding: '18px 20px', border: 'var(--ms-border-width) solid #e8edf2', boxShadow: 'var(--ms-shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--ms-radius-sm)', background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SIcon name={k.icon} size={18} color={k.color} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: k.positive ? '#f0fdf4' : '#fff7ed', color: k.positive ? '#16a34a' : '#c2410c' }}>{k.delta}</span>
              </div>
              <div style={{ color: '#0f172a', fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{k.value}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Grille principale */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 'var(--ms-gap)' }}>
          {/* Prochaines réunions */}
          <div style={{ background: '#fff', borderRadius: 'var(--ms-radius)', border: 'var(--ms-border-width) solid #e8edf2', overflow: 'hidden', boxShadow: 'var(--ms-shadow)' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>Prochaines réunions</h3>
                <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>4 planifiées cette semaine</p>
              </div>
              <button onClick={() => setPage('meetings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>Voir tout →</button>
            </div>
            <div style={{ padding: '8px 0' }}>
              {MEETINGS_UPCOMING.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', cursor: 'pointer', transition: 'background 0.13s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 4, height: 38, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2, display: 'flex', gap: 10 }}>
                      <span>{m.date} · {m.time}</span><span>·</span><span>{m.duration}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {Array.from({ length: Math.min(m.participants, 3) }).map((_, i) => (
                      <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', marginLeft: i > 0 ? -6 : 0, background: AVATAR_COLORS[i], border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                        {AVATAR_LETTERS[i]}
                      </div>
                    ))}
                    {m.participants > 3 && <span style={{ color: '#94a3b8', fontSize: 11 }}>+{m.participants - 3}</span>}
                  </div>
                  <button onClick={() => setPage('active')} style={{ padding: '5px 10px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: `${m.color}18`, color: m.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>Rejoindre</button>
                </div>
              ))}
            </div>
          </div>

          {/* Réunions récentes */}
          <div style={{ background: '#fff', borderRadius: 'var(--ms-radius)', border: 'var(--ms-border-width) solid #e8edf2', overflow: 'hidden', boxShadow: 'var(--ms-shadow)' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>Réunions récentes</h3>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>Dernières 7 jours</p>
            </div>
            <div style={{ padding: '8px 0' }}>
              {RECENT_MEETINGS.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer', transition: 'background 0.13s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--ms-radius-sm)', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <SIcon name="Video" size={16} color="#64748b" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>{m.date}</span><span>·</span><span>{m.duration}</span><span>·</span><span>{m.participants} participants</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {m.notes && <span style={{ background: 'var(--ms-accent-pale)', color: 'var(--ms-accent)', fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 6 }}>Notes</span>}
                    {m.tasks > 0 && <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 6 }}>{m.tasks} tâches</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* Mini graphe */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
                {CHART_BARS.map((h, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 5 ? 'var(--ms-accent)' : '#e2e8f0', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ms-accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i === 5 ? 'var(--ms-accent)' : '#e2e8f0')} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {CHART_DAYS.map((d, i) => <span key={i} style={{ color: '#cbd5e1', fontSize: 10, flex: 1, textAlign: 'center' }}>{d}</span>)}
              </div>
            </div>
          </div>

          {/* Tâches */}
          <div style={{ background: '#fff', borderRadius: 'var(--ms-radius)', border: 'var(--ms-border-width) solid #e8edf2', overflow: 'hidden', boxShadow: 'var(--ms-shadow)' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>Mes tâches</h3>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>{pending} en attente</p>
            </div>
            <div style={{ padding: '8px 0' }}>
              {tasks.map((t) => {
                const priColor = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[t.priority];
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 18px', cursor: 'pointer', transition: 'background 0.13s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <button onClick={() => toggleTask(t.id)} style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${t.done ? '#10b981' : '#cbd5e1'}`,
                      background: t.done ? '#10b981' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, marginTop: 1,
                    }}>
                      {t.done && <SIcon name="Check" size={10} color="#fff" sw={3} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: t.done ? '#94a3b8' : '#0f172a', fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{t.text}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: priColor, flexShrink: 0 }} />
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>Échéance : {t.due}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button style={{
                width: '100%', padding: '8px', borderRadius: 'var(--ms-radius-sm)',
                border: '1.5px dashed #e2e8f0', background: 'transparent',
                color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ms-accent)'; e.currentTarget.style.color = 'var(--ms-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <SIcon name="Plus" size={14} color="currentColor" /> Ajouter une tâche
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
