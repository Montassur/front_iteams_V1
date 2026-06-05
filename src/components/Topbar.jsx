// Topbar.jsx — Shared topbar with notification dropdown

const NOTIFICATIONS = [
  { id:1, type:'meeting', icon:'Video',       color:'#6366f1', title:'Revue Sprint #24 dans 30 min',          sub:'Aujourd\'hui · 14:30',  read:false },
  { id:2, type:'task',    icon:'CheckSquare', color:'#f59e0b', title:'Tâche assignée : Préparer slides comité', sub:'Il y a 1 heure',         read:false },
  { id:3, type:'chat',    icon:'MessageCircle',color:'#10b981',title:'Marie Dupont vous a écrit',               sub:'Il y a 2 heures',        read:false },
  { id:4, type:'meeting', icon:'Video',       color:'#0ea5e9', title:'Compte-rendu Sprint #23 disponible',     sub:'Hier · 16:00',           read:true  },
  { id:5, type:'task',    icon:'CheckSquare', color:'#f59e0b', title:'Rappel : KPIs à mettre à jour',          sub:'Hier · 09:00',           read:true  },
  { id:6, type:'chat',    icon:'MessageCircle',color:'#10b981','title':'Pierre Lefebvre a mentionné @vous',    sub:'Lundi · 11:30',          read:true  },
];

function Topbar({ title, user, onSearch, searchValue, children, setPage }) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState(NOTIFICATIONS);
  const unread = notifs.filter(n => !n.read).length;
  const bellRef = React.useRef(null);
  const dropRef = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          bellRef.current && !bellRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const markRead = (id) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <div style={{
      height: 'var(--ms-topbar)', background: '#fff',
      borderBottom: 'var(--ms-border-width) solid #e2e8f0',
      display: 'flex', alignItems: 'center', padding: '0 var(--ms-pad)',
      gap: 12, flexShrink: 0, position: 'sticky', top: 0, zIndex: 20,
      boxShadow: 'var(--ms-shadow-top)'
    }}>
      <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{title}</span>

      {children}

      <div style={{ flex: 1 }} />

      {/* Search */}
      {onSearch !== false && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc',
          borderRadius: 'var(--ms-radius-sm)', padding: '6px 12px',
          border: 'var(--ms-border-width) solid #e2e8f0', cursor: 'text'
        }}>
          <SIcon name="Search" size={14} color="#94a3b8" />
          {onSearch ? (
            <input value={searchValue || ''} onChange={e => onSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:'#0f172a', fontFamily:'inherit', width:160 }} />
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Rechercher…</span>
          )}
        </div>
      )}

      {/* Bell */}
      <div style={{ position: 'relative' }}>
        <button ref={bellRef} onClick={() => setNotifOpen(o => !o)} style={{
          width: 36, height: 36, borderRadius: 'var(--ms-radius-sm)',
          border: 'var(--ms-border-width) solid #e2e8f0', background: notifOpen ? 'var(--ms-accent-pale)' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transition: 'all 0.15s'
        }}>
          <SIcon name="Bell" size={16} color={notifOpen ? 'var(--ms-accent)' : '#64748b'} />
          {unread > 0 && (
            <div style={{
              position: 'absolute', top: 7, right: 7, width: 8, height: 8,
              borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff'
            }} />
          )}
        </button>

        {/* Dropdown */}
        {notifOpen && (
          <div ref={dropRef} style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 360, background: '#fff', borderRadius: 'var(--ms-radius)',
            border: 'var(--ms-border-width) solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 100, overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            {/* Header */}
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 14 }}>Notifications</span>
                {unread > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{unread}</span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  Tout marquer lu
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {notifs.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 18px', cursor: 'pointer', transition: 'background 0.13s',
                  background: n.read ? '#fff' : 'var(--ms-accent-pale)',
                  borderBottom: '1px solid #f8fafc'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = n.read ? '#f8fafc' : '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : 'var(--ms-accent-pale)'}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 'var(--ms-radius-sm)',
                    background: `${n.color}18`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, marginTop: 1
                  }}>
                    <SIcon name={n.icon} size={15} color={n.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#0f172a', fontSize: 13, fontWeight: n.read ? 400 : 600, lineHeight: 1.4, marginBottom: 2 }}>{n.title}</p>
                    <p style={{ color: '#94a3b8', fontSize: 11 }}>{n.sub}</p>
                  </div>
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ms-accent)', flexShrink: 0, marginTop: 6 }} />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <button onClick={() => { setNotifOpen(false); }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ms-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit'
              }}>Voir toutes les notifications</button>
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: user?.color || 'var(--ms-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0
      }}>
        {user?.initials || 'U'}
      </div>
    </div>
  );
}

Object.assign(window, { Topbar });
