import { useEffect, useMemo, useState } from 'react'
import { SIcon } from '../components/icons/SIcon'
import { ProfileMenu } from '../components/layout/ProfileMenu'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
import { listOrganizations } from '../api/organizations'
import { assignMembership, listMemberships, removeMembership } from '../api/memberships'
import type { User as SessionUser } from '../types'
import type {
  ApiUser,
  CreateUserRequest,
  GlobalRole,
  OrganizationMembershipResponse,
  OrganizationSummary,
  UpdateUserRequest,
} from '../types/admin'

interface Props { user: SessionUser; onLogout: () => void }

interface DisplayUser {
  id: number
  apiUser: ApiUser
  name: string
  initials: string
  color: string
  role: string
  globalRole?: GlobalRole | null
  org: string
  orgIds: number[]
  email: string
  status: 'online' | 'away' | 'offline'
}

const STATUS_COLORS: Record<string, string> = { online:'#10b981', away:'#f59e0b', offline:'#94a3b8' }
const STATUS_LABELS: Record<string, string> = { online:'En ligne', away:'Absent', offline:'Hors ligne' }

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  SUPERVISOR: 'Superviseur',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employé',
}

const AVATAR_COLORS = ['#6366f1','#10b981','#ec4899','#f59e0b','#0ea5e9','#f97316','#8b5cf6','#14b8a6']

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

const colorFromName = (name: string) =>
  AVATAR_COLORS[Math.abs(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]

function getCreatableRoles(r?: string | null): GlobalRole[] {
  switch (r) {
    case 'ADMIN':      return ['ADMIN', 'SUPERVISOR', 'MANAGER', 'EMPLOYEE']
    case 'OWNER':      return ['SUPERVISOR', 'MANAGER', 'EMPLOYEE']
    case 'SUPERVISOR': return ['MANAGER', 'EMPLOYEE']
    case 'MANAGER':    return ['EMPLOYEE']
    default: return []
  }
}

// ── Create User Modal ─────────────────────────────────────────────────────────
interface CreateUserModalProps {
  orgs: OrganizationSummary[]
  currentUserRole?: string | null
  onClose: () => void
  onCreated: () => void
}

function CreateUserModal({ orgs, currentUserRole, onClose, onCreated }: CreateUserModalProps) {
  const roles = useMemo(() => getCreatableRoles(currentUserRole), [currentUserRole])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [globalRole, setGlobalRole] = useState<GlobalRole>(roles[0] ?? 'EMPLOYEE')
  const [organizationId, setOrganizationId] = useState<number | ''>(orgs[0]?.id ?? '')
  const [supervisorOrgIds, setSupervisorOrgIds] = useState<number[]>([])
  const [color, setColor] = useState('#6366f1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const initials = initialsOf(name)
  const isSupervisor = globalRole === 'SUPERVISOR'
  const requiresSingleOrg = globalRole === 'MANAGER' || globalRole === 'EMPLOYEE'

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Nom, email et mot de passe sont obligatoires.'); return
    }
    if (isSupervisor && supervisorOrgIds.length === 0) {
      setError('Sélectionnez au moins une organisation pour le superviseur.'); return
    }
    if (requiresSingleOrg && !organizationId) {
      setError('Sélectionnez une organisation.'); return
    }
    try {
      setLoading(true); setError('')
      const payload: CreateUserRequest = {
        name: name.trim(),
        email: email.trim(),
        password,
        globalRole,
        organizationId: requiresSingleOrg && typeof organizationId === 'number' ? organizationId : undefined,
      }
      const created = await createUser(payload)
      if (isSupervisor) {
        await Promise.all(supervisorOrgIds.map(id =>
          assignMembership(id, { userId: created.id, role: 'SUPERVISOR' })))
      }
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création utilisateur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:'var(--ms-radius-lg)', width:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', fontFamily:'Inter, sans-serif' }}>
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'var(--ms-radius-sm)', background:'var(--ms-accent-pale)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <SIcon name="UserPlus" size={16} color="var(--ms-accent)" />
            </div>
            <h2 style={{ color:'#0f172a', fontSize:16, fontWeight:700 }}>Nouvel utilisateur</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <SIcon name="X" size={18} color="#94a3b8" />
          </button>
        </div>

        <div style={{ padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:24, padding:'16px', background:'#f8fafc', borderRadius:'var(--ms-radius)' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:22, flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,0.15)' }}>{initials}</div>
            <div>
              <p style={{ color:'#64748b', fontSize:12, fontWeight:600, marginBottom:8 }}>Couleur d'avatar</p>
              <div style={{ display:'flex', gap:6 }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{
                    width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                    outline: color === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset:2, transition:'all 0.13s'
                  }} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Nom complet <span style={{ color:'#ef4444' }}>*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Marie Dupont"
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Email <span style={{ color:'#ef4444' }}>*</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="m.dupont@exemple.fr"
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Mot de passe <span style={{ color:'#ef4444' }}>*</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom: isSupervisor ? 14 : 24 }}>
            <div>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Rôle</label>
              <select value={globalRole} onChange={e => setGlobalRole(e.target.value as GlobalRole)} disabled={roles.length === 0}
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#334155', background:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
              </select>
            </div>
            {requiresSingleOrg && (
              <div>
                <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Organisation</label>
                <select value={organizationId} onChange={e => setOrganizationId(e.target.value ? Number(e.target.value) : '')}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#334155', background:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                  <option value="">Sélectionner…</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {isSupervisor && (
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Organisations supervisées</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                {supervisorOrgIds.map(id => {
                  const o = orgs.find(x => x.id === id)
                  return (
                    <span key={id} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, background:'#f0fdf4', border:'1px solid #bbf7d0', color:'#15803d', fontSize:12, fontWeight:700 }}>
                      {o?.name ?? `#${id}`}
                      <button onClick={() => setSupervisorOrgIds(prev => prev.filter(x => x !== id))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', color:'#15803d' }}>
                        <SIcon name="X" size={11} color="#15803d" />
                      </button>
                    </span>
                  )
                })}
              </div>
              <select value="" onChange={e => { const v = Number(e.target.value); if (v) setSupervisorOrgIds(prev => prev.includes(v) ? prev : [...prev, v]) }}
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#334155', background:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                <option value="">Ajouter une organisation…</option>
                {orgs.filter(o => !supervisorOrgIds.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, marginBottom:14 }}>
              <SIcon name="AlertCircle" size={14} color="#ef4444" />
              <span style={{ color:'#b91c1c', fontSize:13 }}>{error}</span>
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:'11px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', background:'#fff', color:'#64748b', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
            <button onClick={submit} disabled={loading || !name.trim() || !email.trim() || !password.trim()} style={{
              flex:2, padding:'11px', borderRadius:'var(--ms-radius-sm)', border:'none',
              background: loading || !name.trim() || !email.trim() || !password.trim() ? '#e2e8f0' : 'var(--ms-accent)',
              color:      loading || !name.trim() || !email.trim() || !password.trim() ? '#94a3b8' : '#fff',
              fontWeight:700, fontSize:14, cursor: loading ? 'default' : 'pointer',
              fontFamily:'inherit', transition:'all 0.15s'
            }}>{loading ? 'Création…' : "Créer l'utilisateur"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
interface EditUserModalProps {
  target: ApiUser
  orgs: OrganizationSummary[]
  currentUserRole?: string | null
  onClose: () => void
  onSaved: () => void
}

function EditUserModal({ target, orgs, currentUserRole, onClose, onSaved }: EditUserModalProps) {
  const roles = useMemo(() => getCreatableRoles(currentUserRole), [currentUserRole])
  const [name, setName] = useState(target.name)
  const [email, setEmail] = useState(target.email)
  const [password, setPassword] = useState('')
  const [globalRole, setGlobalRole] = useState<GlobalRole>(target.globalRole ?? 'EMPLOYEE')
  const [memberships, setMemberships] = useState<OrganizationMembershipResponse[]>([])
  const [memberLoading, setMemberLoading] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMemberLoading(true)
    Promise.all(orgs.map(o => listMemberships(o.id)))
      .then(results => setMemberships(results.flat().filter(m => m.userId === target.id)))
      .catch(() => setMemberships([]))
      .finally(() => setMemberLoading(false))
  }, [orgs, target.id])

  const addOrg = async (orgId: number) => {
    try {
      const m = await assignMembership(orgId, { userId: target.id, role: globalRole })
      setMemberships(prev => [...prev, m])
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur ajout organisation') }
  }

  const removeOrg = async (m: OrganizationMembershipResponse) => {
    try {
      await removeMembership(m.organizationId, m.id)
      setMemberships(prev => prev.filter(x => x.id !== m.id))
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur suppression organisation') }
  }

  const submit = async () => {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    try {
      setLoading(true); setError('')
      const payload: UpdateUserRequest = {
        name: name.trim(),
        email: email.trim(),
        globalRole,
      }
      if (password) payload.password = password
      await updateUser(target.id, payload)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement')
    } finally {
      setLoading(false)
    }
  }

  const memberOrgIds = memberships.map(m => m.organizationId)
  const availableOrgs = orgs.filter(o => !memberOrgIds.includes(o.id))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:'var(--ms-radius-lg)', width:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', fontFamily:'Inter, sans-serif' }}>
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'var(--ms-radius-sm)', background:'var(--ms-accent-pale)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <SIcon name="UserCog" size={16} color="var(--ms-accent)" />
            </div>
            <h2 style={{ color:'#0f172a', fontSize:16, fontWeight:700 }}>Modifier — {target.name}</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <SIcon name="X" size={18} color="#94a3b8" />
          </button>
        </div>

        <div style={{ padding:'24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Nom complet</label>
              <input value={name} onChange={e => setName(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Nouveau mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Laisser vide…"
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
            </div>
            {roles.length > 0 && (
              <div>
                <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Rôle</label>
                <select value={globalRole} onChange={e => setGlobalRole(e.target.value as GlobalRole)}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#334155', background:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                  {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Organisations</label>
            {memberLoading ? (
              <div style={{ color:'#94a3b8', fontSize:13 }}>Chargement…</div>
            ) : (
              <>
                {memberships.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                    {memberships.map(m => {
                      const o = orgs.find(x => x.id === m.organizationId)
                      return (
                        <span key={m.id} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, background:'#f0fdf4', border:'1px solid #bbf7d0', color:'#15803d', fontSize:12, fontWeight:700 }}>
                          {o?.name ?? `#${m.organizationId}`}
                          <button onClick={() => removeOrg(m)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', color:'#15803d' }}>
                            <SIcon name="X" size={11} color="#15803d" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
                {availableOrgs.length > 0 ? (
                  <select value="" onChange={e => { const v = Number(e.target.value); if (v) void addOrg(v) }}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#334155', background:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                    <option value="">Ajouter une organisation…</option>
                    {availableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                ) : memberships.length === 0 ? (
                  <div style={{ color:'#94a3b8', fontSize:13 }}>Aucune organisation disponible</div>
                ) : null}
              </>
            )}
          </div>

          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, marginBottom:14 }}>
              <SIcon name="AlertCircle" size={14} color="#ef4444" />
              <span style={{ color:'#b91c1c', fontSize:13 }}>{error}</span>
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:'11px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', background:'#fff', color:'#64748b', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
            <button onClick={submit} disabled={loading || !name.trim()} style={{
              flex:2, padding:'11px', borderRadius:'var(--ms-radius-sm)', border:'none',
              background: loading || !name.trim() ? '#e2e8f0' : 'var(--ms-accent)',
              color:      loading || !name.trim() ? '#94a3b8' : '#fff',
              fontWeight:700, fontSize:14, cursor: loading ? 'default' : 'pointer',
              fontFamily:'inherit'
            }}>{loading ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Delete User Modal ─────────────────────────────────────────────────────────
function DeleteUserModal({ target, onClose, onDeleted }: { target: ApiUser; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const confirm = async () => {
    try { setLoading(true); setError(''); await deleteUser(target.id); onDeleted(); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:'var(--ms-radius-lg)', width:420, boxShadow:'0 24px 64px rgba(0,0,0,0.18)', fontFamily:'Inter, sans-serif' }}>
        <div style={{ padding:'28px 28px 20px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <SIcon name="Trash2" size={24} color="#ef4444" />
          </div>
          <h2 style={{ color:'#0f172a', fontSize:18, fontWeight:800, marginBottom:8 }}>Supprimer l'utilisateur ?</h2>
          <p style={{ color:'#64748b', fontSize:14 }}>
            <strong style={{ color:'#0f172a' }}>{target.name}</strong> sera supprimé définitivement.
          </p>
          {error && <div style={{ marginTop:12, padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, color:'#b91c1c', fontSize:13 }}>{error}</div>}
        </div>
        <div style={{ padding:'0 24px 24px', display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
          <button onClick={confirm} disabled={loading} style={{ flex:1, padding:'12px', borderRadius:'var(--ms-radius-sm)', border:'none', background: loading ? '#fca5a5' : '#ef4444', color:'#fff', fontWeight:800, fontSize:14, cursor: loading ? 'default' : 'pointer', fontFamily:'inherit' }}>
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── User Card ─────────────────────────────────────────────────────────────────
function UserCard({ user:u, selected, canEdit, canDelete, onClick, onEdit, onDelete }: {
  user: DisplayUser
  selected: boolean
  canEdit: boolean
  canDelete: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div onClick={onClick} style={{
      background: selected ? 'var(--ms-accent-pale)' : '#fff',
      borderRadius:'var(--ms-radius)',
      border:`var(--ms-border-width) solid ${selected ? 'var(--ms-accent-border)' : '#e8edf2'}`,
      padding:'20px', cursor:'pointer', transition:'all 0.15s',
      boxShadow: selected ? 'var(--ms-shadow-md)' : 'var(--ms-shadow)',
    }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor='#cbd5e1'; e.currentTarget.style.boxShadow='var(--ms-shadow-md)' } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor='#e8edf2'; e.currentTarget.style.boxShadow='var(--ms-shadow)' } }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:u.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:16 }}>{u.initials}</div>
          <div style={{ position:'absolute', bottom:2, right:2, width:10, height:10, borderRadius:'50%', background:STATUS_COLORS[u.status], border:'2px solid #fff' }} />
        </div>
        <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:`${STATUS_COLORS[u.status]}18`, color:STATUS_COLORS[u.status] }}>{STATUS_LABELS[u.status]}</span>
      </div>
      <h3 style={{ color:'#0f172a', fontSize:14, fontWeight:700, marginBottom:2 }}>{u.name}</h3>
      <p style={{ color:'#64748b', fontSize:12, marginBottom:12 }}>{u.role}</p>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <SIcon name="Building2" size={12} color="#94a3b8" />
        <span style={{ color:'#94a3b8', fontSize:12 }}>{u.org}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
        <SIcon name="Mail" size={12} color="#94a3b8" />
        <span style={{ color:'#94a3b8', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</span>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={e => { e.stopPropagation(); if (canEdit) onEdit() }} disabled={!canEdit} style={{
          flex:1, padding:'7px', borderRadius:'var(--ms-radius-sm)',
          border:'var(--ms-border-width) solid #e2e8f0', background:'#fff',
          cursor: canEdit ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
          color: canEdit ? '#64748b' : '#cbd5e1', fontSize:12, fontWeight:500, fontFamily:'inherit', transition:'all 0.13s',
          opacity: canEdit ? 1 : 0.6
        }}
          onMouseEnter={e => { if (canEdit) { e.currentTarget.style.background='var(--ms-accent-pale)'; e.currentTarget.style.borderColor='var(--ms-accent-border)'; e.currentTarget.style.color='var(--ms-accent)' } }}
          onMouseLeave={e => { if (canEdit) { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b' } }}>
          <SIcon name="Pencil" size={13} color="currentColor" /> Modifier
        </button>
        <button onClick={e => { e.stopPropagation(); if (canDelete) onDelete() }} disabled={!canDelete} style={{
          flex:1, padding:'7px', borderRadius:'var(--ms-radius-sm)',
          border:'none', background: canDelete ? '#ef4444' : '#e2e8f0',
          cursor: canDelete ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
          color: canDelete ? '#fff' : '#94a3b8', fontSize:12, fontWeight:600, fontFamily:'inherit',
          opacity: canDelete ? 1 : 0.6
        }}>
          <SIcon name="Trash2" size={13} color={canDelete ? '#fff' : '#94a3b8'} /> Supprimer
        </button>
      </div>
    </div>
  )
}

// ── User Detail Panel ─────────────────────────────────────────────────────────
function UserDetail({ user:u, canEdit, canDelete, onClose, onEdit, onDelete }: {
  user: DisplayUser
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div style={{ width:320, background:'#fff', borderLeft:'1px solid #e2e8f0', display:'flex', flexDirection:'column', height:'100%', flexShrink:0, overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h3 style={{ color:'#0f172a', fontSize:14, fontWeight:700 }}>Profil</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
          <SIcon name="X" size={16} color="#94a3b8" />
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ position:'relative', display:'inline-block', marginBottom:12 }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:u.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:24, margin:'0 auto' }}>{u.initials}</div>
            <div style={{ position:'absolute', bottom:4, right:4, width:14, height:14, borderRadius:'50%', background:STATUS_COLORS[u.status], border:'2.5px solid #fff' }} />
          </div>
          <h2 style={{ color:'#0f172a', fontSize:16, fontWeight:700, marginBottom:4 }}>{u.name}</h2>
          <p style={{ color:'#64748b', fontSize:13, marginBottom:4 }}>{u.role}</p>
          <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:`${STATUS_COLORS[u.status]}18`, color:STATUS_COLORS[u.status] }}>{STATUS_LABELS[u.status]}</span>
        </div>

        {([
          { icon:'Building2',    label:'Organisation', value:u.org },
          { icon:'Mail',         label:'Email',        value:u.email },
          { icon:'Shield',       label:'Rôle global',  value:u.role },
          { icon:'UserCheck',    label:'ID',           value:`#${u.id}` },
        ] as const).map(row => (
          <div key={row.label} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #f8fafc' }}>
            <SIcon name={row.icon} size={15} color="#94a3b8" />
            <span style={{ color:'#94a3b8', fontSize:13, width:110, flexShrink:0 }}>{row.label}</span>
            <span style={{ color:'#0f172a', fontSize:13, fontWeight:500, wordBreak:'break-all' }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ padding:'14px 20px', borderTop:'1px solid #f1f5f9', display:'flex', flexDirection:'column', gap:8 }}>
        <button onClick={onEdit} disabled={!canEdit} style={{ width:'100%', padding:'9px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', background:'#fff', cursor: canEdit ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:7, color:'#334155', fontSize:13, fontWeight:600, fontFamily:'inherit', opacity: canEdit ? 1 : 0.5 }}>
          <SIcon name="Pencil" size={15} color="currentColor" /> Modifier
        </button>
        <button onClick={onDelete} disabled={!canDelete} style={{ width:'100%', padding:'9px', borderRadius:'var(--ms-radius-sm)', border:'none', background: canDelete ? '#ef4444' : '#e2e8f0', cursor: canDelete ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:7, color: canDelete ? '#fff' : '#94a3b8', fontSize:13, fontWeight:600, fontFamily:'inherit', opacity: canDelete ? 1 : 0.5 }}>
          <SIcon name="Trash2" size={15} color={canDelete ? '#fff' : '#94a3b8'} /> Supprimer
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function UsersPage({ user: sessionUser, onLogout }: Props) {
  const canManage = ['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER'].includes(sessionUser.globalRole ?? '')

  const [apiUsers, setApiUsers] = useState<ApiUser[]>([])
  const [apiOrgs,  setApiOrgs]  = useState<OrganizationSummary[]>([])
  const [memberships, setMemberships] = useState<Record<number, OrganizationMembershipResponse[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch]       = useState('')
  const [filterOrg, setFilterOrg] = useState('all')
  const [selected, setSelected]   = useState<DisplayUser | null>(null)
  const [view, setView]           = useState<'grid' | 'list'>('grid')
  const [showCreate, setShowCreate]   = useState(false)
  const [editTarget, setEditTarget]   = useState<ApiUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null)

  const load = async () => {
    try {
      setLoading(true); setError('')
      const [usersR, orgsR] = await Promise.all([listUsers(), listOrganizations()])
      setApiUsers(usersR.users)
      setApiOrgs(orgsR.organizations)
      const memMap: Record<number, OrganizationMembershipResponse[]> = {}
      await Promise.all(orgsR.organizations.map(async o => {
        try { memMap[o.id] = await listMemberships(o.id) }
        catch { memMap[o.id] = [] }
      }))
      setMemberships(memMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const userOrgMap = useMemo(() => {
    const m: Record<number, number[]> = {}
    for (const [orgIdStr, list] of Object.entries(memberships)) {
      const orgId = Number(orgIdStr)
      for (const mem of list) {
        if (!m[mem.userId]) m[mem.userId] = []
        m[mem.userId].push(orgId)
      }
    }
    return m
  }, [memberships])

  const users: DisplayUser[] = useMemo(() => apiUsers.map(u => {
    const orgIds = userOrgMap[u.id] ?? []
    const firstOrg = apiOrgs.find(o => orgIds.includes(o.id))
    return {
      id: u.id,
      apiUser: u,
      name: u.name,
      initials: initialsOf(u.name),
      color: colorFromName(u.name),
      role: ROLE_LABELS[u.globalRole ?? 'EMPLOYEE'] ?? 'Employé',
      globalRole: u.globalRole,
      org: firstOrg?.name ?? '—',
      orgIds,
      email: u.email,
      status: 'online',
    }
  }), [apiUsers, apiOrgs, userOrgMap])

  const canEditOrDelete = (target: ApiUser) => {
    if (!canManage) return false
    if (target.id === sessionUser.id) return false
    if (sessionUser.globalRole === 'OWNER' && (target.globalRole === 'ADMIN' || target.globalRole === 'OWNER')) return false
    return true
  }

  const orgNames = ['all', ...apiOrgs.map(o => o.name)]

  const filtered = users.filter(u => {
    if (filterOrg !== 'all') {
      const o = apiOrgs.find(x => x.name === filterOrg)
      if (!o || !u.orgIds.includes(o.id)) return false
    }
    if (search) {
      const s = search.toLowerCase()
      if (!u.name.toLowerCase().includes(s) && !u.role.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false
    }
    return true
  })

  return (
    <div style={{ flex:1, display:'flex', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f1f5f9', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:'var(--ms-topbar)', background:'#fff', borderBottom:'var(--ms-border-width) solid #e2e8f0', display:'flex', alignItems:'center', padding:'0 var(--ms-pad)', gap:12, flexShrink:0, boxShadow:'var(--ms-shadow-top)' }}>
          <span style={{ color:'#0f172a', fontWeight:700, fontSize:15 }}>Utilisateurs</span>
          {!loading && (
            <span style={{ background:'#f1f5f9', color:'#64748b', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999 }}>{users.length}</span>
          )}
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:'var(--ms-radius-sm)', padding:'6px 12px', border:'var(--ms-border-width) solid #e2e8f0' }}>
            <SIcon name="Search" size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:'#0f172a', fontFamily:'inherit', width:160 }} />
          </div>
          <div style={{ display:'flex', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', overflow:'hidden' }}>
            {([['grid', 'LayoutGrid'], ['list', 'List']] as const).map(([v, icon]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 10px', border:'none', cursor:'pointer', background: view === v ? 'var(--ms-accent-pale)' : '#fff', display:'flex', alignItems:'center', transition:'all 0.13s' }}>
                <SIcon name={icon} size={15} color={view === v ? 'var(--ms-accent)' : '#94a3b8'} />
              </button>
            ))}
          </div>
          {canManage && (
            <button onClick={() => setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'var(--ms-accent)', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 1px 4px var(--ms-accent-glow)' }}>
              <SIcon name="UserPlus" size={14} color="#fff" sw={2.5} />
              Ajouter
            </button>
          )}
          <ProfileMenu user={sessionUser} onLogout={onLogout} />
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'var(--ms-pad) var(--ms-pad) 40px' }}>
          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, marginBottom:12 }}>
              <SIcon name="AlertCircle" size={15} color="#ef4444" />
              <span style={{ color:'#b91c1c', fontSize:13 }}>{error}</span>
            </div>
          )}

          {loading && (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Chargement…</div>
          )}

          {!loading && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:'var(--ms-gap)', flexWrap:'wrap' }}>
                {orgNames.map(o => (
                  <button key={o} onClick={() => setFilterOrg(o)} style={{
                    padding:'5px 12px', borderRadius:20, border:'var(--ms-border-width) solid',
                    borderColor: filterOrg === o ? 'var(--ms-accent)' : '#e2e8f0',
                    background:  filterOrg === o ? 'var(--ms-accent-pale)' : '#fff',
                    color:       filterOrg === o ? 'var(--ms-accent)' : '#64748b',
                    fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.13s'
                  }}>
                    {o === 'all' ? `Tous (${users.length})` : o}
                  </button>
                ))}
              </div>

              {view === 'grid' ? (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'var(--ms-gap)' }}>
                  {filtered.map(u => (
                    <UserCard key={u.id} user={u} selected={selected?.id === u.id}
                      canEdit={canEditOrDelete(u.apiUser)} canDelete={canEditOrDelete(u.apiUser)}
                      onClick={() => setSelected(s => s?.id === u.id ? null : u)}
                      onEdit={() => setEditTarget(u.apiUser)}
                      onDelete={() => setDeleteTarget(u.apiUser)} />
                  ))}
                  {filtered.length === 0 && (
                    <div style={{ gridColumn:'1 / -1', padding:'48px 20px', textAlign:'center', color:'#94a3b8' }}>Aucun utilisateur</div>
                  )}
                </div>
              ) : (
                <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', overflow:'hidden', boxShadow:'var(--ms-shadow)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1.5fr 1fr 80px', gap:0, padding:'10px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
                    {['Nom','Rôle','Organisation','Statut','Actions'].map(h => (
                      <span key={h} style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{h}</span>
                    ))}
                  </div>
                  {filtered.map((u, i) => {
                    const editable = canEditOrDelete(u.apiUser)
                    return (
                      <div key={u.id} onClick={() => setSelected(s => s?.id === u.id ? null : u)} style={{
                        display:'grid', gridTemplateColumns:'2fr 1.5fr 1.5fr 1fr 80px',
                        gap:0, padding:'12px 20px', cursor:'pointer', transition:'background 0.13s',
                        background: selected?.id === u.id ? 'var(--ms-accent-pale)' : 'transparent',
                        borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none'
                      }}
                        onMouseEnter={e => { if (selected?.id !== u.id) e.currentTarget.style.background='#f8fafc' }}
                        onMouseLeave={e => { if (selected?.id !== u.id) e.currentTarget.style.background='transparent' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:u.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:11, flexShrink:0 }}>{u.initials}</div>
                          <span style={{ color:'#0f172a', fontSize:13, fontWeight:600 }}>{u.name}</span>
                        </div>
                        <span style={{ color:'#64748b', fontSize:13, display:'flex', alignItems:'center' }}>{u.role}</span>
                        <span style={{ color:'#64748b', fontSize:13, display:'flex', alignItems:'center' }}>{u.org}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', background:STATUS_COLORS[u.status] }} />
                          <span style={{ color:'#64748b', fontSize:12 }}>{STATUS_LABELS[u.status]}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <button onClick={e => { e.stopPropagation(); if (editable) setEditTarget(u.apiUser) }} title="Modifier"
                            disabled={!editable}
                            style={{ background:'none', border:'none', cursor: editable ? 'pointer' : 'not-allowed', padding:4, borderRadius:6, color: editable ? '#94a3b8' : '#cbd5e1', opacity: editable ? 1 : 0.5 }}
                            onMouseEnter={e => { if (editable) e.currentTarget.style.color='var(--ms-accent)' }}
                            onMouseLeave={e => { if (editable) e.currentTarget.style.color='#94a3b8' }}>
                            <SIcon name="Pencil" size={15} color="currentColor" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); if (editable) setDeleteTarget(u.apiUser) }} title="Supprimer"
                            disabled={!editable}
                            style={{ background:'none', border:'none', cursor: editable ? 'pointer' : 'not-allowed', padding:4, borderRadius:6, color: editable ? '#94a3b8' : '#cbd5e1', opacity: editable ? 1 : 0.5 }}
                            onMouseEnter={e => { if (editable) e.currentTarget.style.color='#ef4444' }}
                            onMouseLeave={e => { if (editable) e.currentTarget.style.color='#94a3b8' }}>
                            <SIcon name="Trash2" size={15} color="currentColor" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div style={{ padding:'48px 20px', textAlign:'center', color:'#94a3b8' }}>Aucun utilisateur</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <UserDetail user={selected}
          canEdit={canEditOrDelete(selected.apiUser)} canDelete={canEditOrDelete(selected.apiUser)}
          onClose={() => setSelected(null)}
          onEdit={() => setEditTarget(selected.apiUser)}
          onDelete={() => setDeleteTarget(selected.apiUser)} />
      )}

      {showCreate && (
        <CreateUserModal
          orgs={apiOrgs}
          currentUserRole={sessionUser.globalRole}
          onClose={() => setShowCreate(false)}
          onCreated={() => { void load() }}
        />
      )}
      {editTarget && (
        <EditUserModal
          target={editTarget}
          orgs={apiOrgs}
          currentUserRole={sessionUser.globalRole}
          onClose={() => setEditTarget(null)}
          onSaved={() => { void load() }}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setSelected(null); void load() }}
        />
      )}
    </div>
  )
}
