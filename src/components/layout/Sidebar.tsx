import { useEffect, useRef, useState } from 'react';
import { listOrganizations } from '../../api/organizations';
import { SIcon } from '../icons/SIcon';
import type { User, PageId } from '../../types';
import type { OrganizationSummary } from '../../types/admin';

const ADMIN_ITEMS = [
  { id: 'users' as PageId, label: 'Utilisateurs', icon: 'Users' },
];

const ADMIN_BILLING_ITEM = { id: 'admin-billing' as PageId, label: 'Facturation', icon: 'Receipt' };
const OWNER_BILLING_ITEM = { id: 'invoices'      as PageId, label: 'Factures',    icon: 'Receipt' };


const BOTTOM_ITEMS = [
  { id: 'settings' as PageId, label: 'Paramètres', icon: 'Settings' },
  { id: 'help'     as PageId, label: 'Aide',        icon: 'HelpCircle' },
];

// Direct nav items shown for EMPLOYEE and MANAGER (chat handled separately)
const ORG_FEATURE_ITEMS = [
  { id: 'meetings' as PageId, label: 'Réunions',   icon: 'CalendarDays' },
  { id: 'tasks'    as PageId, label: 'Mes tâches',  icon: 'CheckSquare' },
  { id: 'files'    as PageId, label: 'Fichiers',     icon: 'FolderOpen' },
];

const CHAT_ITEM = { id: 'chat' as PageId, label: 'Messages', icon: 'MessageSquare' };

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#3b82f6'], ['#10b981', '#06b6d4'],
  ['#f59e0b', '#f97316'], ['#ec4899', '#a855f7'], ['#14b8a6', '#22d3ee'],
];
const orgGradient = (name: string) => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

interface SidebarProps {
  page: PageId;
  setPage: (p: PageId) => void;
  user: User;
  canAccessAdmin: boolean;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (fn: (c: boolean) => boolean) => void;
  onSelectOrg: (org: OrganizationSummary) => void;
  chatUnreadCount?: number;
  onChatRead?: () => void;
}

export function Sidebar({ page, setPage, user, canAccessAdmin, onLogout, collapsed, setCollapsed, onSelectOrg, chatUnreadCount = 0, onChatRead }: SidebarProps) {
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [orgOpen, setOrgOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const isSimpleRole = ['EMPLOYEE', 'MANAGER'].includes(user.globalRole ?? '');

  useEffect(() => {
    const load = async () => {
      try {
        const { organizations } = await listOrganizations();
        setOrgs(organizations);
      } catch { /* ignore */ }
    };
    void load();
  }, [user.id, user.globalRole]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOrgOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navBtn = (item: { id: PageId; label: string; icon: string }, active: boolean, onClick: () => void, badge?: number) => (
    <button
      key={item.id}
      onClick={onClick}
      title={collapsed ? item.label : ''}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 10, padding: collapsed ? 'var(--ms-nav-pad) 10px' : 'var(--ms-nav-pad) 12px',
        borderRadius: 'var(--ms-radius-sm)', border: 'none', cursor: 'pointer',
        background: active ? 'var(--ms-accent-dim)' : 'transparent',
        color: active ? 'var(--ms-accent-light)' : '#94a3b8',
        fontWeight: active ? 600 : 400, fontSize: 13, marginBottom: 2,
        transition: 'all 0.13s',
        justifyContent: collapsed ? 'center' : 'flex-start',
        whiteSpace: 'nowrap', overflow: 'hidden', fontFamily: 'inherit',
        borderLeft: active ? '2px solid var(--ms-accent)' : '2px solid transparent',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
    >
      <SIcon name={item.icon} size={17} color="currentColor" sw={active ? 2.1 : 1.7} />
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
      {!collapsed && badge && badge > 0 ? (
        <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      {collapsed && badge && badge > 0 ? (
        <span style={{ position: 'absolute', top: 6, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid var(--ms-sidebar)' }} />
      ) : null}
    </button>
  );

  const orgActive = page === 'org-home' || page === 'organizations' || page === 'organization-detail';

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      background: 'var(--ms-sidebar)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0, position: 'relative', zIndex: 10,
    }}>

      {/* Logo */}
      <div style={{ height: 'var(--ms-topbar)', display: 'flex', alignItems: 'center', padding: collapsed ? '0 18px' : '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, gap: 10, overflow: 'hidden' }}>
        <div style={{ width: 28, height: 28, borderRadius: 'var(--ms-radius-sm)', background: 'linear-gradient(135deg, var(--ms-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px var(--ms-accent-glow)' }}>
          <SIcon name="Video" size={15} color="#fff" sw={2.2} />
        </div>
        {!collapsed && <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>MeetSync</span>}
        <button onClick={() => setCollapsed((c) => !c)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}>
          <SIcon name={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={16} color="currentColor" />
        </button>
      </div>

      {/* Nouvelle réunion */}
      <div style={{ padding: collapsed ? '12px 10px' : '12px 12px', flexShrink: 0 }}>
        <button onClick={() => setPage('active')} style={{ width: '100%', background: 'var(--ms-accent)', border: 'none', borderRadius: 'var(--ms-radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8, padding: collapsed ? '8px' : '8px 12px', color: '#fff', fontWeight: 600, fontSize: 13, transition: 'all 0.15s', boxShadow: '0 1px 4px var(--ms-accent-glow)', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ms-accent-dark)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ms-accent)')}>
          <SIcon name="Plus" size={16} color="#fff" sw={2.5} />
          {!collapsed && 'Nouvelle réunion'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto', overflowX: 'hidden' }}>

        {isSimpleRole ? (
          /* ── EMPLOYEE / MANAGER: direct org feature links ── */
          <>
            {/* Org name header */}
            {orgs[0] && !collapsed && (() => {
              const [c1, c2] = orgGradient(orgs[0].name);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 10px', marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 10, flexShrink: 0 }}>
                    {orgs[0].name.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgs[0].name}</span>
                </div>
              );
            })()}
            {orgs[0] && collapsed && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {(() => {
                  const [c1, c2] = orgGradient(orgs[0].name);
                  return (
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 10 }}>
                      {orgs[0].name.slice(0, 2).toUpperCase()}
                    </div>
                  );
                })()}
              </div>
            )}
            {ORG_FEATURE_ITEMS.map((item) => navBtn(item, page === item.id, () => setPage(item.id)))}
            {navBtn(CHAT_ITEM, page === 'chat', () => { setPage('chat'); onChatRead?.(); }, chatUnreadCount)}
          </>
        ) : (
          /* ── OWNER / ADMIN / SUPERVISOR: org dropdown ── */
          <div ref={dropRef} style={{ position: 'relative', marginBottom: 2 }}>
            <button
              onClick={() => { if (collapsed) setCollapsed(() => false); setOrgOpen((o) => !o); }}
              title={collapsed ? 'Organisations' : ''}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? 'var(--ms-nav-pad) 10px' : 'var(--ms-nav-pad) 12px', borderRadius: 'var(--ms-radius-sm)', border: 'none', cursor: 'pointer', background: orgActive ? 'var(--ms-accent-dim)' : 'transparent', color: orgActive ? 'var(--ms-accent-light)' : '#94a3b8', fontWeight: orgActive ? 600 : 400, fontSize: 13, transition: 'all 0.13s', justifyContent: collapsed ? 'center' : 'flex-start', whiteSpace: 'nowrap', overflow: 'hidden', fontFamily: 'inherit', borderLeft: orgActive ? '2px solid var(--ms-accent)' : '2px solid transparent' }}
              onMouseEnter={(e) => { if (!orgActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; } }}
              onMouseLeave={(e) => { if (!orgActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}>
              <SIcon name="Building2" size={17} color="currentColor" sw={orgActive ? 2.1 : 1.7} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1, textAlign: 'left' }}>Organisations</span>
                  <SIcon name={orgOpen ? 'ChevronUp' : 'ChevronDown'} size={13} color="currentColor" sw={2} />
                </>
              )}
            </button>

            {orgOpen && !collapsed && (
              <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, marginTop: 2, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                {orgs.length === 0 && <div style={{ padding: '10px 14px', color: '#475569', fontSize: 12 }}>Aucune organisation</div>}
                {orgs.map((org) => (
                  <button key={org.id} onClick={() => { onSelectOrg(org); setOrgOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: 'transparent', color: '#cbd5e1', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: 'linear-gradient(135deg, var(--ms-accent), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SIcon name="Building2" size={11} color="#fff" />
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</span>
                  </button>
                ))}
                {['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.globalRole ?? '') && (
                  <button onClick={() => { setPage('organizations'); setOrgOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderTop: orgs.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', transition: 'background 0.12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <SIcon name="Settings2" size={13} color="currentColor" />
                    Gérer les organisations
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Administration section */}
        {canAccessAdmin && (
          <>
            <div style={{ marginTop: 10, marginBottom: 8, padding: '0 8px', color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {!collapsed && 'Administration'}
            </div>
            {ADMIN_ITEMS.map((item) => navBtn(item, page === item.id, () => setPage(item.id)))}
            {user.globalRole === 'ADMIN' && navBtn(ADMIN_BILLING_ITEM, page === 'admin-billing', () => setPage('admin-billing'))}
          </>
        )}

        {/* Facturation – OWNER seulement */}
        {user.globalRole === 'OWNER' && (
          <>
            <div style={{ marginTop: 10, marginBottom: 8, padding: '0 8px', color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {!collapsed && 'Facturation'}
            </div>
            {navBtn(OWNER_BILLING_ITEM, page === 'invoices', () => setPage('invoices'))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {BOTTOM_ITEMS.map((item) => (
          <button key={item.id} title={collapsed ? item.label : ''}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '8px 10px' : '8px 12px', borderRadius: 'var(--ms-radius-sm)', border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 13, marginBottom: 2, transition: 'all 0.13s', justifyContent: collapsed ? 'center' : 'flex-start', whiteSpace: 'nowrap', overflow: 'hidden', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}>
            <SIcon name={item.icon} size={16} color="currentColor" sw={1.7} />
            {!collapsed && item.label}
          </button>
        ))}

        {/* User card */}
        <div
          onClick={() => setPage('profile')}
          title={collapsed ? user.name : ''}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setPage('profile'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '8px 6px' : '8px 10px', borderRadius: 'var(--ms-radius-sm)', marginTop: 4, background: page === 'profile' ? 'var(--ms-accent-dim)' : 'rgba(255,255,255,0.04)', overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { if (page !== 'profile') e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { if (page !== 'profile') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        >
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.color || 'var(--ms-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
            {user.initials}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ color: '#475569', fontSize: 10 }}>{user.email}</div>
              {user.globalRole && <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>{user.globalRole}</div>}
            </div>
          )}
          {!collapsed && (
            <button onClick={(e) => { e.stopPropagation(); onLogout(); }} title="Déconnexion" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}>
              <SIcon name="LogOut" size={14} color="currentColor" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
