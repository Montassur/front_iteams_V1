import { useEffect, useRef, useState } from 'react';
import { updateUser } from '../../api/users';
import { SIcon } from '../icons/SIcon';
import type { User as SessionUser } from '../../types';
import type { UpdateUserRequest } from '../../types/admin';

const ROLE_META: Record<string, { bg: string; fg: string; dot: string }> = {
  OWNER:      { bg: '#f5f3ff', fg: '#6d28d9', dot: '#7c3aed' },
  ADMIN:      { bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6' },
  SUPERVISOR: { bg: '#f0fdf4', fg: '#15803d', dot: '#22c55e' },
  MANAGER:    { bg: '#fff7ed', fg: '#c2410c', dot: '#f97316' },
  EMPLOYEE:   { bg: '#f8fafc', fg: '#475569', dot: '#94a3b8' },
};

const avatarGradients = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#6366f1'], ['#10b981', '#0ea5e9'],
  ['#f59e0b', '#ef4444'], ['#ec4899', '#8b5cf6'], ['#14b8a6', '#06b6d4'],
];
function avatarColors(name: string) {
  return avatarGradients[name.charCodeAt(0) % avatarGradients.length];
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: '1.5px solid #e2e8f0', background: '#f8fafc',
  color: '#0f172a', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function EditProfileModal({ open, user, onClose, onSaved }: {
  open: boolean; user: SessionUser;
  onClose: () => void; onSaved: (updated: Partial<SessionUser>) => void;
}) {
  const [form, setForm] = useState<UpdateUserRequest>({ name: user.name, email: user.email });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!form.name?.trim()) return setError('Le nom est obligatoire.');
    try {
      setLoading(true); setError('');
      const updated = await updateUser(user.id!, form);
      onSaved({ name: updated.name, email: updated.email });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(15,23,42,0.52)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(15,23,42,0.24)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${avatarColors(user.name)[0]}, ${avatarColors(user.name)[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>
            {user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Modifier le profil</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Mettez à jour vos informations</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="X" size={14} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: '20px 26px', display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              <SIcon name="User" size={12} color="#64748b" /> Nom complet
            </label>
            <input style={inp} value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              <SIcon name="Mail" size={12} color="#64748b" /> Email
            </label>
            <input style={inp} type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              <SIcon name="Lock" size={12} color="#64748b" /> Nouveau mot de passe <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optionnel)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 40 }} type={showPass ? 'text' : 'password'}
                placeholder="Laisser vide pour ne pas changer" value={form.password ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              <button type="button" onClick={() => setShowPass((v) => !v)} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <SIcon name={showPass ? 'EyeOff' : 'Eye'} size={14} color="#94a3b8" />
              </button>
            </div>
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
              <SIcon name="AlertCircle" size={13} color="#ef4444" />
              <span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '0 26px 22px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 11, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '11px', borderRadius: 11, border: 'none', background: loading ? '#c7d2fe' : 'linear-gradient(135deg, var(--ms-accent), #6366f1)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.3)' }}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props { user: SessionUser; onLogout: () => void; onProfileUpdate?: (u: Partial<SessionUser>) => void; }

export function ProfileMenu({ user, onLogout, onProfileUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rm = ROLE_META[user.globalRole ?? 'EMPLOYEE'] ?? ROLE_META.EMPLOYEE;
  const [c1, c2] = avatarColors(user.name);
  const initials = user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button onClick={() => setOpen((v) => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '5px 10px 5px 5px',
        background: open ? '#f1f5f9' : 'transparent', border: '1.5px solid', borderColor: open ? '#e2e8f0' : 'transparent',
        borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
      }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
      >
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, boxShadow: `0 2px 6px ${c1}50`, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{user.globalRole ?? 'EMPLOYEE'}</div>
        </div>
        <SIcon name={open ? 'ChevronUp' : 'ChevronDown'} size={13} color="#94a3b8" />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
          width: 240, background: '#fff', borderRadius: 16,
          boxShadow: '0 16px 48px rgba(15,23,42,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {/* User header */}
          <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #fafbff, #f1f5f9)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${c1}, ${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, boxShadow: `0 3px 10px ${c1}50`, flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: rm.bg, color: rm.fg, fontSize: 11, fontWeight: 800 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: rm.dot }} />
                {user.globalRole ?? 'EMPLOYEE'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '6px' }}>
            <button onClick={() => { setOpen(false); setEditOpen(true); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, border: 'none', background: 'transparent', color: '#334155',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              transition: 'background 0.12s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name="UserCog" size={14} color="#6366f1" />
              </div>
              Modifier le profil
            </button>

            <div style={{ height: 1, background: '#f1f5f9', margin: '4px 8px' }} />

            <button onClick={() => { setOpen(false); onLogout(); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, border: 'none', background: 'transparent', color: '#ef4444',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              transition: 'background 0.12s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name="LogOut" size={14} color="#ef4444" />
              </div>
              Se déconnecter
            </button>
          </div>
        </div>
      )}

      <EditProfileModal
        open={editOpen} user={user}
        onClose={() => setEditOpen(false)}
        onSaved={(u) => { onProfileUpdate?.(u); setEditOpen(false); }}
      />
    </div>
  );
}
