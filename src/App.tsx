import { useState, useEffect, useRef } from 'react';
import { useChatUnread } from './hooks/useChatUnread';
import { Sidebar } from './components/layout/Sidebar';
import { AppTweaks } from './components/tweaks/AppTweaks';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Meetings } from './pages/Meetings';
import { ActiveMeeting } from './pages/ActiveMeeting';
import { TasksPage } from './pages/Tasks';
import { UsersPage } from './pages/Users';
import { OrganizationsPage } from './pages/Organizations';
import { OrganizationDetailPage } from './pages/OrganizationDetail';
import { OrgHomePage } from './pages/OrgHome';
import { FilesPage } from './pages/Files';
import { ChatPage } from './pages/Chat';
import { InvoicesPage } from './pages/Invoices';
import { ProfilePage } from './pages/Profile';
import { AdminBillingPage } from './pages/AdminBilling';
import { SIcon } from './components/icons/SIcon';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { applyTheme } from './theme/applyTheme';
import type { PageId } from './types';
import type { AuthSession } from './types/auth';
import type { OrganizationSummary } from './types/admin';
import { clearSession, loadSession, saveSession } from './utils/session';
import { setUnauthorizedHandler } from './services/api';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function loadValidSession(): AuthSession | null {
  const s = loadSession();
  if (!s) return null;
  if (isTokenExpired(s.token)) {
    clearSession();
    return null;
  }
  return s;
}

const THEME_DEFAULTS = { palette: 'crepuscule', style: 'moderne', densite: 'standard' } as const;

const SESSION_KEY = 'iteams_nav';

function loadNav() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      page: PageId;
      selectedOrganizationId: number | null;
      selectedOrg: OrganizationSummary | null;
      activeMeetingId: number | null;
      activeMeetingOrgId: number | null;
    };
  } catch { return null; }
}

function saveNav(data: object) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadValidSession());
  const { unreadCount: chatUnread, refresh: refreshChatUnread } = useChatUnread();

  const _nav = loadNav();
  const [page, setPageRaw] = useState<PageId>(_nav?.page ?? 'dashboard');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(_nav?.selectedOrganizationId ?? null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationSummary | null>(_nav?.selectedOrg ?? null);
  const [activeMeetingId, setActiveMeetingId] = useState<number | null>(_nav?.activeMeetingId ?? null);
  const [activeMeetingOrgId, setActiveMeetingOrgId] = useState<number | null>(_nav?.activeMeetingOrgId ?? null);
  // Default the sidebar to *collapsed* on tablet-range viewports (768–899)
  // where there's not enough room for the 240px sidebar but it's still inline.
  // Below 768 the sidebar is a slide-out drawer (rendered full-width when open),
  // so we leave it un-collapsed there.
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 768 && w < 900) setCollapsed(true);
      if (w >= 900) setCollapsed(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Mobile drawer state — slides Sidebar in from the left on <768px screens.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const setPage = (p: PageId) => { setPageRaw(p); };

  // Persist nav state whenever any piece of it changes
  useEffect(() => {
    saveNav({ page, selectedOrganizationId, selectedOrg, activeMeetingId, activeMeetingOrgId });
  }, [page, selectedOrganizationId, selectedOrg, activeMeetingId, activeMeetingOrgId]);
  const user = session?.user ?? null;
  const canAccessAdmin = ['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER'].includes(user?.globalRole ?? '');

  useEffect(() => { applyTheme(THEME_DEFAULTS); }, []);

  const handleLogin = (nextSession: AuthSession) => {
    saveSession(nextSession);
    setSession(nextSession);
    setPage('dashboard');
    setSelectedOrganizationId(null);
    setSelectedOrg(null);
  };
  const handleLogout = () => {
    clearSession();
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setSession(null);
    setPageRaw('dashboard');
    setSelectedOrganizationId(null);
    setSelectedOrg(null);
    setActiveMeetingId(null);
    setActiveMeetingOrgId(null);
  };
  const handleProfileUpdated = (name: string, email: string) => {
    if (session) {
      const updated = { ...session, user: { ...session.user, name, email } };
      saveSession(updated);
      setSession(updated);
    }
  };

  const handleSelectOrg = (org: OrganizationSummary) => {
    setSelectedOrg(org);
    setSelectedOrganizationId(org.id);
    setPage('org-home');
  };

  // Keep a ref so the handler always calls the latest handleLogout without re-registering
  const handleLogoutRef = useRef(handleLogout);
  handleLogoutRef.current = handleLogout;
  useEffect(() => {
    setUnauthorizedHandler(() => handleLogoutRef.current());
  }, []);

  if (!user) {
    return (
      <div className="page-enter h-full">
        <Auth onLogin={handleLogin} />
        <AppTweaks />
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard     key="dashboard" user={user} setPage={setPage} />;
      case 'meetings':  return <Meetings key="meetings" user={user} selectedOrgId={selectedOrganizationId} setPage={setPage} onJoinMeeting={(mId, oId) => { setActiveMeetingId(mId); setActiveMeetingOrgId(oId); setPageRaw('active'); }} />;
      case 'active':    return activeMeetingId && activeMeetingOrgId
        ? <ActiveMeeting key="active" user={user} meetingId={activeMeetingId} orgId={activeMeetingOrgId} setPage={setPage} />
        : <PlaceholderPage onBack={() => setPage('meetings')} />;
      case 'tasks':     return <TasksPage     key="tasks"     user={user} selectedOrgId={selectedOrganizationId} />;
      case 'users':     return <UsersPage     key="users"     user={user} onLogout={handleLogout} />;
      case 'organizations':
        return <OrganizationsPage key="organizations" user={user} onLogout={handleLogout} onOpenOrganization={(organizationId) => { setSelectedOrg(null); setSelectedOrganizationId(organizationId); setPage('organization-detail'); }} />;
      case 'organization-detail':
        return selectedOrganizationId
          ? <OrganizationDetailPage key={`organization-${selectedOrganizationId}`} organizationId={selectedOrganizationId} user={user} onBack={() => setPage(selectedOrg ? 'org-home' : 'organizations')} />
          : <PlaceholderPage onBack={() => setPage('organizations')} />;
      case 'org-home':
        return selectedOrg
          ? <OrgHomePage key={`org-home-${selectedOrg.id}`} organization={selectedOrg} user={user} setPage={setPage} />
          : <PlaceholderPage onBack={() => setPage('dashboard')} />;
      case 'files':     return <FilesPage     key="files"     user={user} />;
      case 'chat':      return <ChatPage      key="chat"      user={user} selectedOrgId={selectedOrganizationId} onRead={refreshChatUnread} />;
      case 'invoices':  return <InvoicesPage     key="invoices"      user={user} onGoToProfile={() => setPage('profile')} />;
      case 'profile':   return <ProfilePage     key="profile"       user={user} onProfileUpdated={handleProfileUpdated} />;
      case 'admin-billing': return <AdminBillingPage key="admin-billing" user={user} />;
      default:          return <PlaceholderPage onBack={() => setPage('dashboard')} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden ms-app-shell">
      <div className={`ms-sidebar-wrap${mobileNavOpen ? ' ms-sidebar-open' : ''}`}>
        <Sidebar
          page={page} setPage={(p) => { setPage(p); setMobileNavOpen(false); }}
          user={user} canAccessAdmin={canAccessAdmin} onLogout={handleLogout}
          collapsed={collapsed} setCollapsed={setCollapsed}
          onSelectOrg={(o) => { handleSelectOrg(o); setMobileNavOpen(false); }}
          chatUnreadCount={chatUnread}
          onChatRead={refreshChatUnread}
        />
      </div>
      {mobileNavOpen && (
        <div className="ms-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}
      <button className="ms-mobile-nav-btn" onClick={() => setMobileNavOpen((v) => !v)} aria-label="Menu">
        <SIcon name={mobileNavOpen ? 'X' : 'Menu'} size={20} color="#0f172a" />
      </button>
      <div key={page} className="page-enter flex flex-1 overflow-hidden min-w-0">
        {renderPage()}
      </div>
      <AppTweaks />
      <PwaInstallPrompt />
    </div>
  );
}

function PlaceholderPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ background: '#f1f5f9' }}>
      <SIcon name="Construction" size={40} color="#cbd5e1" />
      <p style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Page en construction</p>
      <button onClick={onBack} style={{
        marginTop: 8, padding: '8px 18px', borderRadius: 'var(--ms-radius-sm)', border: 'none',
        background: 'var(--ms-accent)', color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      }}>
        Retour au tableau de bord
      </button>
    </div>
  );
}
