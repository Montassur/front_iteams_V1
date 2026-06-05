import { SIcon } from '../components/icons/SIcon';
import type { User, PageId } from '../types';
import type { OrganizationSummary } from '../types/admin';

interface Props {
  organization: OrganizationSummary;
  user: User;
  setPage: (p: PageId) => void;
}

const FEATURE_CARDS = [
  { id: 'meetings' as PageId,  label: 'Réunions',        icon: 'CalendarDays',   color: '#0ea5e9', bg: '#e0f2fe', desc: 'Planifier et rejoindre des réunions' },
  { id: 'tasks'    as PageId,  label: 'Mes tâches',       icon: 'CheckSquare',    color: '#10b981', bg: '#d1fae5', desc: 'Gérer vos tâches et priorités' },
  { id: 'chat'     as PageId,  label: 'Messages',         icon: 'MessageSquare',  color: '#f59e0b', bg: '#fef3c7', desc: 'Communiquer avec votre équipe' },
  { id: 'files'    as PageId,  label: 'Fichiers',          icon: 'FolderOpen',     color: '#8b5cf6', bg: '#ede9fe', desc: 'Partager et gérer les documents' },
];

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#3b82f6'], ['#10b981', '#06b6d4'],
  ['#f59e0b', '#f97316'], ['#ec4899', '#a855f7'], ['#14b8a6', '#22d3ee'],
];
const orgGradient = (name: string) => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

export function OrgHomePage({ organization, user, setPage }: Props) {
  const canManage = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.globalRole ?? '');
  const [c1, c2] = orgGradient(organization.name);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
          {organization.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{organization.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Espace de travail</div>
        </div>
        <div style={{ flex: 1 }} />
        {canManage && (
          <button
            onClick={() => setPage('organization-detail')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
            <SIcon name="Settings2" size={14} color="currentColor" />
            Gérer
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 22px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Bienvenue dans {organization.name}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Choisissez une section pour commencer</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {FEATURE_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => setPage(card.id)}
              style={{ background: '#fff', border: '1px solid #e8edf2', borderRadius: 16, padding: '22px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, transition: 'all 0.18s', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px rgba(15,23,42,0.10)`; e.currentTarget.style.borderColor = card.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.05)'; e.currentTarget.style.borderColor = '#e8edf2'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 13, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name={card.icon as any} size={22} color={card.color} sw={2} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{card.label}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{card.desc}</div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: card.color, fontSize: 12, fontWeight: 600 }}>
                Ouvrir <SIcon name="ArrowRight" size={13} color={card.color} sw={2.2} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
