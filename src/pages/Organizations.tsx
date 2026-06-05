import { useEffect, useMemo, useState } from 'react'
import { SIcon } from '../components/icons/SIcon'
import { ProfileMenu } from '../components/layout/ProfileMenu'
import { listCompanies, type CompanyDto } from '../api/companies'
import { createOrganization, deleteOrganization, listOrganizations, updateOrganization } from '../api/organizations'
import { listMemberships } from '../api/memberships'
import { getMeetingStats } from '../api/meetings'
import type { User as SessionUser } from '../types'
import type {
  CreateOrganizationRequest,
  OrganizationMembershipResponse,
  OrganizationSummary,
  UpdateOrganizationRequest,
} from '../types/admin'

interface Props { user: SessionUser; onLogout: () => void; onOpenOrganization: (id: number) => void }

interface DisplayOrg {
  id: number
  apiOrg: OrganizationSummary
  name: string
  initials: string
  color: string
  industry: string
  address: string | null
  members: number
  meetings: number
  contact: string
  contactInitials: string
  contactColor: string
  memberList: OrganizationMembershipResponse[]
}

const ORG_COLORS    = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#f97316','#8b5cf6','#ec4899','#14b8a6']
const AVATAR_COLORS = ['#6366f1','#10b981','#ec4899','#f59e0b','#0ea5e9','#f97316','#8b5cf6','#14b8a6']

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

const colorFromName = (name: string, palette: string[]) =>
  palette[Math.abs(name.charCodeAt(0) || 0) % palette.length]

// ── Create Org Modal ──────────────────────────────────────────────────────────
function CreateOrgModal({ companies, onClose, onCreated }: { companies: CompanyDto[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [companyId, setCompanyId] = useState<number | ''>(companies[0]?.id ?? '')
  const [color, setColor] = useState('#6366f1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const initials = initialsOf(name)

  const submit = async () => {
    if (!name.trim()) { setError("Le nom est obligatoire."); return }
    if (!companyId)   { setError("Sélectionnez une société.");   return }
    try {
      setLoading(true); setError('')
      const payload: CreateOrganizationRequest = {
        name: name.trim(),
        address: address.trim() || undefined,
        companyId: typeof companyId === 'number' ? companyId : undefined,
      }
      await createOrganization(payload)
      onCreated(); onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création organisation')
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
              <SIcon name="Building2" size={16} color="var(--ms-accent)" />
            </div>
            <h2 style={{ color:'#0f172a', fontSize:16, fontWeight:700 }}>Nouvelle organisation</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <SIcon name="X" size={18} color="#94a3b8" />
          </button>
        </div>

        <div style={{ padding:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:24, padding:'16px', background:'#f8fafc', borderRadius:'var(--ms-radius)' }}>
            <div style={{ width:60, height:60, borderRadius:'var(--ms-radius)', background:`${color}18`, border:`2px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ color, fontWeight:900, fontSize:20 }}>{initials}</span>
            </div>
            <div>
              <p style={{ color:'#64748b', fontSize:12, fontWeight:600, marginBottom:8 }}>Couleur de l'organisation</p>
              <div style={{ display:'flex', gap:6 }}>
                {ORG_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline: color === c ? `3px solid ${c}` : '3px solid transparent', outlineOffset:2, transition:'all 0.13s' }} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Nom de l'organisation <span style={{ color:'#ef4444' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Équipe Marketing Paris"
              style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Adresse</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="15 rue de la Paix, 75001 Paris"
              style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Société <span style={{ color:'#ef4444' }}>*</span></label>
            {companies.length === 0 ? (
              <div style={{ padding:'10px 12px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'var(--ms-radius-sm)', fontSize:13, color:'#92400e' }}>Aucune société disponible.</div>
            ) : (
              <select value={companyId} onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : '')}
                style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#334155', background:'#fff', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                <option value="">Sélectionner une société…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.registryNumber ? ` — N° ${c.registryNumber}` : ''}</option>)}
              </select>
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
            <button onClick={submit} disabled={loading || !name.trim() || !companyId} style={{
              flex:2, padding:'11px', borderRadius:'var(--ms-radius-sm)', border:'none',
              background: loading || !name.trim() || !companyId ? '#e2e8f0' : 'var(--ms-accent)',
              color:      loading || !name.trim() || !companyId ? '#94a3b8' : '#fff',
              fontWeight:700, fontSize:14, cursor: loading ? 'default' : 'pointer', fontFamily:'inherit'
            }}>{loading ? 'Création…' : "Créer l'organisation"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit Org Modal ────────────────────────────────────────────────────────────
function EditOrgModal({ target, onClose, onSaved }: { target: OrganizationSummary; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(target.name)
  const [address, setAddress] = useState(target.address ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    try {
      setLoading(true); setError('')
      const payload: UpdateOrganizationRequest = { name: name.trim(), address: address.trim() || undefined }
      await updateOrganization(target.id, payload)
      onSaved(); onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:'var(--ms-radius-lg)', width:500, boxShadow:'0 24px 64px rgba(0,0,0,0.18)', fontFamily:'Inter, sans-serif' }}>
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'var(--ms-radius-sm)', background:'var(--ms-accent-pale)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <SIcon name="Building2" size={16} color="var(--ms-accent)" />
            </div>
            <h2 style={{ color:'#0f172a', fontSize:16, fontWeight:700 }}>Modifier — {target.name}</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <SIcon name="X" size={18} color="#94a3b8" />
          </button>
        </div>
        <div style={{ padding:'24px' }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Nom</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', color:'#374151', fontSize:12, fontWeight:600, marginBottom:6 }}>Adresse</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', fontSize:13, color:'#0f172a', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
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
              fontWeight:700, fontSize:14, cursor: loading ? 'default' : 'pointer', fontFamily:'inherit'
            }}>{loading ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Delete Org Modal ──────────────────────────────────────────────────────────
function DeleteOrgModal({ target, onClose, onDeleted }: { target: OrganizationSummary; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const confirm = async () => {
    try { setLoading(true); setError(''); await deleteOrganization(target.id); onDeleted(); onClose() }
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
          <h2 style={{ color:'#0f172a', fontSize:18, fontWeight:800, marginBottom:8 }}>Supprimer l'organisation ?</h2>
          <p style={{ color:'#64748b', fontSize:14 }}>
            <strong style={{ color:'#0f172a' }}>{target.name}</strong> et toutes ses données seront supprimées.
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

// ── Org Card ──────────────────────────────────────────────────────────────────
function OrgCard({ org, canManage, onOpen, onEdit, onDelete }: {
  org: DisplayOrg
  canManage: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const memberAvatars = org.memberList.slice(0, 4)
  return (
    <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', padding:'20px', boxShadow:'var(--ms-shadow)', transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='#cbd5e1'; e.currentTarget.style.boxShadow='var(--ms-shadow-md)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='#e8edf2'; e.currentTarget.style.boxShadow='var(--ms-shadow)' }}>

      <div onClick={onOpen} style={{ cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <div style={{ width:46, height:46, borderRadius:'var(--ms-radius-sm)', background:`${org.color}18`, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${org.color}30` }}>
            <span style={{ color:org.color, fontWeight:800, fontSize:14 }}>{org.initials}</span>
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <h3 style={{ color:'#0f172a', fontSize:15, fontWeight:700, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{org.name}</h3>
            <p style={{ color:'#64748b', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{org.industry}</p>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
          {([
            { label:'Membres',  value:org.members,  icon:'Users' },
            { label:'Réunions', value:org.meetings, icon:'CalendarDays' },
            { label:'Adresse',  value:org.address ? '✓' : '—', icon:'MapPin' },
          ] as const).map(s => (
            <div key={s.label} style={{ background:'#f8fafc', borderRadius:'var(--ms-radius-sm)', padding:'10px', textAlign:'center' }}>
              <SIcon name={s.icon} size={14} color="#94a3b8" />
              <p style={{ color:'#0f172a', fontSize:15, fontWeight:700, marginTop:4 }}>{s.value}</p>
              <p style={{ color:'#94a3b8', fontSize:10 }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <div style={{ display:'flex' }}>
            {memberAvatars.map((m, i) => {
              const memberName = m.userName ?? `#${m.userId}`
              return (
                <div key={m.id} title={memberName} style={{ width:26, height:26, borderRadius:'50%', background:colorFromName(memberName, AVATAR_COLORS), marginLeft:i > 0 ? -8 : 0, border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:9 }}>{initialsOf(memberName)}</div>
              )
            })}
            {memberAvatars.length === 0 && (
              <div style={{ width:26, height:26, borderRadius:'50%', background:'#f1f5f9', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontWeight:700, fontSize:11 }}>—</div>
            )}
          </div>
          <span style={{ color:'#94a3b8', fontSize:12 }}>{org.members} membre{org.members > 1 ? 's' : ''}</span>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:org.contactColor, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:10, flexShrink:0 }}>{org.contactInitials}</div>
            <div style={{ minWidth:0 }}>
              <p style={{ color:'#64748b', fontSize:10 }}>Contact principal</p>
              <p style={{ color:'#0f172a', fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{org.contact}</p>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onOpen() }} style={{ padding:'7px 12px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:5, color:'#64748b', fontSize:12, fontWeight:500, fontFamily:'inherit', transition:'all 0.13s' }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--ms-accent-pale)'; e.currentTarget.style.borderColor='var(--ms-accent-border)'; e.currentTarget.style.color='var(--ms-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b' }}>
            <SIcon name="ExternalLink" size={13} color="currentColor" /> Voir
          </button>
        </div>
      </div>

      {canManage && (
        <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid #f1f5f9', display:'flex', gap:8 }}>
          <button onClick={onEdit} style={{ flex:1, padding:'7px', borderRadius:'var(--ms-radius-sm)', border:'var(--ms-border-width) solid #e2e8f0', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, color:'#64748b', fontSize:12, fontWeight:500, fontFamily:'inherit', transition:'all 0.13s' }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--ms-accent-pale)'; e.currentTarget.style.borderColor='var(--ms-accent-border)'; e.currentTarget.style.color='var(--ms-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b' }}>
            <SIcon name="Pencil" size={13} color="currentColor" /> Modifier
          </button>
          <button onClick={onDelete} style={{ flex:1, padding:'7px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, color:'#fff', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
            <SIcon name="Trash2" size={13} color="#fff" /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function OrganizationsPage({ user: sessionUser, onLogout, onOpenOrganization }: Props) {
  const canManage = ['OWNER', 'ADMIN'].includes(sessionUser.globalRole ?? '')

  const [apiOrgs, setApiOrgs] = useState<OrganizationSummary[]>([])
  const [companies, setCompanies] = useState<CompanyDto[]>([])
  const [memberships, setMemberships] = useState<Record<number, OrganizationMembershipResponse[]>>({})
  const [meetingCounts, setMeetingCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<OrganizationSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrganizationSummary | null>(null)

  const load = async () => {
    try {
      setLoading(true); setError('')
      const [orgsR, cmpR] = await Promise.all([listOrganizations(), listCompanies().catch(() => [] as CompanyDto[])])
      setApiOrgs(orgsR.organizations)
      setCompanies(cmpR)

      const memMap: Record<number, OrganizationMembershipResponse[]> = {}
      const cnt: Record<number, number> = {}
      await Promise.all(orgsR.organizations.map(async o => {
        const [memR, statsR] = await Promise.allSettled([listMemberships(o.id), getMeetingStats(o.id)])
        memMap[o.id] = memR.status === 'fulfilled' ? memR.value : []
        cnt[o.id]    = statsR.status === 'fulfilled' ? (statsR.value.totalMeetings ?? 0) : 0
      }))
      setMemberships(memMap)
      setMeetingCounts(cnt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const orgs: DisplayOrg[] = useMemo(() => apiOrgs.map(o => {
    const memList = memberships[o.id] ?? []
    const firstMember = memList[0]
    const contactName = firstMember?.userName ?? '—'
    const company = companies.find(c => c.id === o.companyId)
    return {
      id: o.id,
      apiOrg: o,
      name: o.name,
      initials: initialsOf(o.name),
      color: colorFromName(o.name, ORG_COLORS),
      industry: company?.name ?? 'Société non renseignée',
      address: o.address ?? null,
      members: o.memberCount ?? memList.length,
      meetings: meetingCounts[o.id] ?? 0,
      contact: contactName,
      contactInitials: contactName !== '—' ? initialsOf(contactName) : '—',
      contactColor: contactName !== '—' ? colorFromName(contactName, AVATAR_COLORS) : '#94a3b8',
      memberList: memList,
    }
  }), [apiOrgs, memberships, meetingCounts, companies])

  const filtered = orgs.filter(o => !search
    || o.name.toLowerCase().includes(search.toLowerCase())
    || (o.address ?? '').toLowerCase().includes(search.toLowerCase())
    || o.industry.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ flex:1, display:'flex', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f1f5f9', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:'var(--ms-topbar)', background:'#fff', borderBottom:'var(--ms-border-width) solid #e2e8f0', display:'flex', alignItems:'center', padding:'0 var(--ms-pad)', gap:12, flexShrink:0, boxShadow:'var(--ms-shadow-top)' }}>
          <span style={{ color:'#0f172a', fontWeight:700, fontSize:15 }}>Organisations</span>
          {!loading && (
            <span style={{ background:'#f1f5f9', color:'#64748b', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999 }}>{orgs.length}</span>
          )}
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:'var(--ms-radius-sm)', padding:'6px 12px', border:'var(--ms-border-width) solid #e2e8f0' }}>
            <SIcon name="Search" size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:'#0f172a', fontFamily:'inherit', width:160 }} />
          </div>
          {canManage && (
            <button onClick={() => setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'var(--ms-accent)', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 1px 4px var(--ms-accent-glow)' }}>
              <SIcon name="Building2" size={14} color="#fff" sw={2.5} />
              Nouvelle org.
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'var(--ms-gap)' }}>
              {filtered.map(o => (
                <OrgCard key={o.id} org={o} canManage={canManage}
                  onOpen={() => onOpenOrganization(o.id)}
                  onEdit={() => setEditTarget(o.apiOrg)}
                  onDelete={() => setDeleteTarget(o.apiOrg)} />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn:'1 / -1', padding:'48px 20px', textAlign:'center', color:'#94a3b8' }}>Aucune organisation</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateOrgModal companies={companies} onClose={() => setShowCreate(false)} onCreated={() => { void load() }} />
      )}
      {editTarget && (
        <EditOrgModal target={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { void load() }} />
      )}
      {deleteTarget && (
        <DeleteOrgModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { void load() }} />
      )}
    </div>
  )
}
