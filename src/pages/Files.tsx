import { useState, useEffect } from 'react'
import { SIcon } from '../components/icons/SIcon'
import type { User } from '../types'
import { getMyRecordings, deleteRecording, getDownloadUrl, type RecordingDto } from '../api/recordings'

// ── Static mock folders & files (unchanged) ───────────────────────────────────

interface FolderItem {
  id: string
  name: string
  color: string
  icon: string
  virtual?: boolean   // true = loaded from API, not mock
  files: number
  updated: string
}

interface FileItem {
  id: number
  name: string
  type: string
  size: string
  updated: string
  author: string
  authorInitials: string
  authorColor: string
  shared: boolean
}

interface TypeMeta { color: string; bg: string; label: string }

const MOCK_FILES: FileItem[] = [
  { id:1, name:'Compte-rendu Sprint #24.docx',     type:'docx', size:'128 Ko',  updated:'Aujourd\'hui · 15:30', author:'Marie Dupont',     authorInitials:'MD', authorColor:'#6366f1', shared:true  },
  { id:2, name:'Roadmap Q2 2026.pptx',             type:'pptx', size:'4.2 Mo',  updated:'Aujourd\'hui · 11:00', author:'Lucas Bernard',    authorInitials:'LB', authorColor:'#14b8a6', shared:true  },
  { id:3, name:'Budget Comité Direction.xlsx',      type:'xlsx', size:'256 Ko',  updated:'Hier · 17:00',         author:'Thomas Girard',    authorInitials:'TG', authorColor:'#f97316', shared:false },
  { id:4, name:'Maquettes Interface v3.fig',        type:'fig',  size:'18.7 Mo', updated:'Lundi · 09:45',        author:'Sophie Martin',    authorInitials:'SM', authorColor:'#ec4899', shared:true  },
  { id:5, name:'Rapport Q1 2026.pdf',              type:'pdf',  size:'2.1 Mo',  updated:'18 avr. · 10:00',      author:'Lucas Bernard',    authorInitials:'LB', authorColor:'#14b8a6', shared:true  },
]

const TYPE_META: Record<string, TypeMeta> = {
  pdf:  { color:'#ef4444', bg:'#fef2f2', label:'PDF'  },
  docx: { color:'#2563eb', bg:'#eff6ff', label:'Word' },
  pptx: { color:'#f97316', bg:'#fff7ed', label:'PPT'  },
  xlsx: { color:'#10b981', bg:'#f0fdf4', label:'Excel'},
  fig:  { color:'#8b5cf6', bg:'#f5f3ff', label:'Figma'},
  webm: { color:'#ef4444', bg:'#fef2f2', label:'REC'  },
}

function FileIcon({ type, size = 32 }: { type: string; size?: number }) {
  const meta: TypeMeta = TYPE_META[type] ?? { color:'#94a3b8', bg:'#f8fafc', label:'?' }
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.2, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ color:meta.color, fontSize:size*0.28, fontWeight:800, letterSpacing:-0.5 }}>{meta.label}</span>
    </div>
  )
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} Mo`
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} Go`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  } catch { return iso }
}

// ─────────────────────────────────────────────────────────────────────────────

interface FilesPageProps { user: User }

export function FilesPage({ user: _user }: FilesPageProps) {
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [openFolder, setOpenFolder] = useState<FolderItem | null>(null)
  const [selected, setSelected]     = useState<FileItem | RecordingDto | null>(null)

  // Recordings state
  const [recordings, setRecordings] = useState<RecordingDto[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [deleting, setDeleting]     = useState<number | null>(null)

  useEffect(() => {
    setRecLoading(true)
    getMyRecordings()
      .then(setRecordings)
      .catch(() => {})
      .finally(() => setRecLoading(false))
  }, [])

  const uniqueMeetings = Array.from(new Map(recordings.map(r => [r.meetingId, r])).values())

  const FOLDERS: FolderItem[] = [
    { id:'réunions', name:'Réunions', color:'#ef4444', icon:'Video', virtual:true, files: recordings.length, updated: recordings.length > 0 ? fmtDate(recordings[0].recordedAt) : '—' },
    { id:'f2', name:'Comptes-rendus', color:'#6366f1', icon:'FileText', files:18, updated:'Hier' },
    { id:'f3', name:'Présentations',  color:'#0ea5e9', icon:'Presentation', files:11, updated:'Lundi' },
    { id:'f4', name:'Projet Nexus',   color:'#f97316', icon:'FolderOpen', files:34, updated:'Mar.' },
    { id:'f5', name:'Design System',  color:'#ec4899', icon:'FolderOpen', files:7,  updated:'15 avr.' },
    { id:'f6', name:'Ressources RH',  color:'#10b981', icon:'FolderOpen', files:9,  updated:'10 avr.' },
  ]

  // Files to show in non-recordings folder
  const filteredFiles = MOCK_FILES.filter(f => {
    if (filter !== 'all' && f.type !== filter) return false
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Recordings to show inside the Réunions folder (optionally filtered by meeting)
  const [openMeetingId, setOpenMeetingId] = useState<number | null>(null)
  const visibleRecs = recordings.filter(r => {
    if (openMeetingId != null && r.meetingId !== openMeetingId) return false
    if (search && !r.meetingSubject.toLowerCase().includes(search.toLowerCase()) &&
        !r.organizationName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const typeFilters = ['all', 'pdf', 'docx', 'pptx', 'xlsx', 'fig']
  const storageUsed = 68
  const storageBreakdown = [
    { label:'Documents',      pct:42, color:'#2563eb' },
    { label:'Présentations',  pct:28, color:'#f97316' },
    { label:'Enregistrements',pct:15, color:'#ef4444' },
    { label:'Autres',         pct:15, color:'#94a3b8' },
  ]

  const isRec = (x: FileItem | RecordingDto | null): x is RecordingDto =>
    x != null && 'meetingSubject' in x

  const handleDeleteRec = async (id: number) => {
    setDeleting(id)
    try {
      await deleteRecording(id)
      setRecordings(rs => rs.filter(r => r.id !== id))
      if (isRec(selected) && (selected as RecordingDto).id === id) setSelected(null)
    } catch { /* silent */ } finally { setDeleting(null) }
  }

  return (
    <div style={{ flex:1, display:'flex', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif' }}>

      {/* ── Left: file browser ───────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f1f5f9', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:'var(--ms-topbar)', background:'#fff', borderBottom:'var(--ms-border-width) solid #e2e8f0', display:'flex', alignItems:'center', padding:'0 var(--ms-pad)', gap:12, flexShrink:0, boxShadow:'var(--ms-shadow-top)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={() => { setOpenFolder(null); setOpenMeetingId(null) }} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', color: openFolder ? '#64748b' : '#0f172a', fontWeight: openFolder ? 400 : 700, fontSize:15 }}>Fichiers</button>
            {openFolder && (
              <>
                <SIcon name="ChevronRight" size={14} color="#94a3b8" />
                <button onClick={() => setOpenMeetingId(null)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', color: openMeetingId != null ? '#64748b' : '#0f172a', fontWeight: openMeetingId != null ? 400 : 700, fontSize:15 }}>{openFolder.name}</button>
              </>
            )}
            {openMeetingId != null && (() => {
              const rec = recordings.find(r => r.meetingId === openMeetingId)
              return rec ? (
                <>
                  <SIcon name="ChevronRight" size={14} color="#94a3b8" />
                  <span style={{ color:'#0f172a', fontWeight:700, fontSize:15 }}>{rec.meetingSubject}</span>
                </>
              ) : null
            })()}
          </div>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:'var(--ms-radius-sm)', padding:'6px 12px', border:'var(--ms-border-width) solid #e2e8f0' }}>
            <SIcon name="Search" size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:'#0f172a', fontFamily:'inherit', width:180 }} />
          </div>
          {!openFolder?.virtual && (
            <button style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'var(--ms-accent)', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
              <SIcon name="Upload" size={14} color="#fff" sw={2.5} /> Importer
            </button>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'var(--ms-pad) var(--ms-pad) 40px' }}>

          {/* ── Folders grid (root view) ─────────────────────────────────────── */}
          {!openFolder && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <h3 style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Dossiers</h3>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12, marginBottom:'var(--ms-gap)' }}>
                {FOLDERS.map(folder => (
                  <div key={folder.id} onClick={() => { setOpenFolder(folder); setOpenMeetingId(null) }}
                    style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', padding:'16px 14px', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--ms-shadow)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#cbd5e1'; e.currentTarget.style.boxShadow='var(--ms-shadow-md)'; e.currentTarget.style.transform='translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#e8edf2'; e.currentTarget.style.boxShadow='var(--ms-shadow)'; e.currentTarget.style.transform='none' }}>
                    <div style={{ width:40, height:40, borderRadius:'var(--ms-radius-sm)', background:`${folder.color}18`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                      <SIcon name={folder.icon} size={20} color={folder.color} />
                    </div>
                    <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, marginBottom:4 }}>{folder.name}</p>
                    <p style={{ color:'#94a3b8', fontSize:11 }}>{folder.files} fichier{folder.files !== 1 ? 's' : ''}</p>
                    <p style={{ color:'#94a3b8', fontSize:10, marginTop:2 }}>{folder.updated}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Réunions folder ──────────────────────────────────────────────── */}
          {openFolder?.virtual && openMeetingId == null && (
            <>
              <p style={{ color:'#64748b', fontSize:12, marginBottom:16 }}>
                Enregistrements des réunions auxquelles vous avez participé.
              </p>

              {recLoading ? (
                <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Chargement…</div>
              ) : uniqueMeetings.length === 0 ? (
                <div style={{ padding:48, textAlign:'center' }}>
                  <SIcon name="Video" size={36} color="#e2e8f0" />
                  <p style={{ color:'#94a3b8', fontSize:14, marginTop:12 }}>Aucun enregistrement disponible</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
                  {uniqueMeetings.map(r => {
                    const count = recordings.filter(x => x.meetingId === r.meetingId).length
                    return (
                      <div key={r.meetingId} onClick={() => setOpenMeetingId(r.meetingId)}
                        style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', padding:'16px 14px', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--ms-shadow)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='#cbd5e1'; e.currentTarget.style.transform='translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='#e8edf2'; e.currentTarget.style.transform='none' }}>
                        <div style={{ width:40, height:40, borderRadius:'var(--ms-radius-sm)', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                          <SIcon name="Video" size={20} color="#ef4444" />
                        </div>
                        <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.meetingSubject}</p>
                        <p style={{ color:'#64748b', fontSize:11, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.organizationName}</p>
                        <p style={{ color:'#94a3b8', fontSize:10 }}>{r.meetingDate} · {count} enreg.</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Individual meeting recordings ────────────────────────────────── */}
          {openFolder?.virtual && openMeetingId != null && (
            <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', overflow:'hidden', boxShadow:'var(--ms-shadow)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 90px', padding:'10px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
                {['Fichier','Enregistré par','Taille','Date','Actions'].map(h => (
                  <span key={h} style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{h}</span>
                ))}
              </div>
              {visibleRecs.length === 0 ? (
                <div style={{ padding:48, textAlign:'center' }}>
                  <p style={{ color:'#94a3b8', fontSize:14 }}>Aucun enregistrement</p>
                </div>
              ) : visibleRecs.map((r, i) => {
                const isSel = isRec(selected) && (selected as RecordingDto).id === r.id
                return (
                  <div key={r.id} onClick={() => setSelected(s => isRec(s) && (s as RecordingDto).id === r.id ? null : r)}
                    style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 90px', padding:'12px 20px', cursor:'pointer', background: isSel ? '#fef2f2' : 'transparent', borderBottom: i < visibleRecs.length - 1 ? '1px solid #f8fafc' : 'none', transition:'background 0.13s' }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='#f8fafc' }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <FileIcon type="webm" size={32} />
                      <div style={{ minWidth:0 }}>
                        <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.fileName}</p>
                        <span style={{ color:'#94a3b8', fontSize:10, display:'flex', alignItems:'center', gap:3 }}>
                          <SIcon name="Lock" size={9} color="#94a3b8" /> Participants uniquement
                        </span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <span style={{ color:'#64748b', fontSize:12 }}>{r.recordedByName}</span>
                    </div>
                    <span style={{ color:'#64748b', fontSize:13, display:'flex', alignItems:'center' }}>{fmtBytes(r.fileSizeBytes)}</span>
                    <span style={{ color:'#94a3b8', fontSize:12, display:'flex', alignItems:'center' }}>{fmtDate(r.recordedAt)}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <a href={getDownloadUrl(r.id)} download onClick={e => e.stopPropagation()}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:5, borderRadius:6, color:'#94a3b8', display:'flex', alignItems:'center', textDecoration:'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='var(--ms-accent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#94a3b8' }}>
                        <SIcon name="Download" size={14} color="currentColor" />
                      </a>
                      <button onClick={e => { e.stopPropagation(); handleDeleteRec(r.id) }} disabled={deleting === r.id}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:5, borderRadius:6, color:'#94a3b8', display:'flex', alignItems:'center' }}
                        onMouseEnter={e => { e.currentTarget.style.color='#ef4444' }}
                        onMouseLeave={e => { e.currentTarget.style.color='#94a3b8' }}>
                        <SIcon name="Trash2" size={14} color="currentColor" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Regular folder content ───────────────────────────────────────── */}
          {openFolder && !openFolder.virtual && (
            <>
              <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
                {typeFilters.map(t => {
                  const meta = TYPE_META[t]
                  return (
                    <button key={t} onClick={() => setFilter(t)} style={{
                      padding:'4px 11px', borderRadius:20, border:'var(--ms-border-width) solid',
                      borderColor: filter === t ? (meta?.color ?? 'var(--ms-accent)') : '#e2e8f0',
                      background:  filter === t ? (meta?.bg    ?? 'var(--ms-accent-pale)') : '#fff',
                      color:       filter === t ? (meta?.color ?? 'var(--ms-accent)') : '#64748b',
                      fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                    }}>
                      {t === 'all' ? `Tous (${MOCK_FILES.length})` : (meta?.label ?? t.toUpperCase())}
                    </button>
                  )
                })}
              </div>
              <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', overflow:'hidden', boxShadow:'var(--ms-shadow)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 80px', padding:'10px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
                  {['Nom','Modifié par','Taille','Date','Actions'].map(h => (
                    <span key={h} style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{h}</span>
                  ))}
                </div>
                {filteredFiles.map((f, i) => {
                  const isSel = !isRec(selected) && (selected as FileItem | null)?.id === f.id
                  return (
                    <div key={f.id} onClick={() => setSelected(s => !isRec(s) && (s as FileItem | null)?.id === f.id ? null : f)}
                      style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 80px', padding:'12px 20px', cursor:'pointer', background: isSel ? 'var(--ms-accent-pale)' : 'transparent', borderBottom: i < filteredFiles.length - 1 ? '1px solid #f8fafc' : 'none', transition:'background 0.13s' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='#f8fafc' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <FileIcon type={f.type} size={32} />
                        <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background:f.authorColor, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:8 }}>{f.authorInitials}</div>
                        <span style={{ color:'#64748b', fontSize:12 }}>{f.author.split(' ')[0]}</span>
                      </div>
                      <span style={{ color:'#64748b', fontSize:13, display:'flex', alignItems:'center' }}>{f.size}</span>
                      <span style={{ color:'#94a3b8', fontSize:12, display:'flex', alignItems:'center' }}>{f.updated}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        {(['Download','Share2','MoreHorizontal'] as const).map(icon => (
                          <button key={icon} onClick={e => e.stopPropagation()} style={{ background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, color:'#94a3b8', display:'flex' }}
                            onMouseEnter={e => { e.currentTarget.style.color='var(--ms-accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.color='#94a3b8' }}>
                            <SIcon name={icon} size={14} color="currentColor" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Root view: recent files ──────────────────────────────────────── */}
          {!openFolder && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, marginTop:8 }}>
                <h3 style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Fichiers récents</h3>
              </div>
              <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', overflow:'hidden', boxShadow:'var(--ms-shadow)' }}>
                {MOCK_FILES.slice(0,4).map((f, i) => (
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom: i < 3 ? '1px solid #f8fafc' : 'none', cursor:'pointer', transition:'background 0.13s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='#f8fafc' }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent' }}>
                    <FileIcon type={f.type} size={32} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</p>
                      <p style={{ color:'#94a3b8', fontSize:11 }}>{f.size} · {f.updated}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right: detail / storage panel ───────────────────────────────────── */}
      <div style={{ width:260, background:'#fff', borderLeft:'1px solid #e2e8f0', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        {isRec(selected) ? (
          // Recording detail
          <>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <h3 style={{ color:'#0f172a', fontSize:13, fontWeight:700 }}>Détails</h3>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
                <SIcon name="X" size={15} color="#94a3b8" />
              </button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:20 }}>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:12, background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                  <SIcon name="Video" size={28} color="#ef4444" />
                </div>
                <p style={{ color:'#0f172a', fontSize:13, fontWeight:700, lineHeight:1.4 }}>{(selected as RecordingDto).fileName}</p>
              </div>
              {[
                { label:'Réunion',       value: (selected as RecordingDto).meetingSubject },
                { label:'Organisation',  value: (selected as RecordingDto).organizationName },
                { label:'Date réunion',  value: (selected as RecordingDto).meetingDate ?? '—' },
                { label:'Taille',        value: fmtBytes((selected as RecordingDto).fileSizeBytes) },
                { label:'Enregistré',    value: fmtDate((selected as RecordingDto).recordedAt) },
                { label:'Par',           value: (selected as RecordingDto).recordedByName },
                { label:'Accès',         value: 'Participants uniquement' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f8fafc' }}>
                  <span style={{ color:'#94a3b8', fontSize:12 }}>{row.label}</span>
                  <span style={{ color:'#334155', fontSize:12, fontWeight:500, textAlign:'right', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.value}</span>
                </div>
              ))}
              <a href={getDownloadUrl((selected as RecordingDto).id)} download
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, width:'100%', marginTop:20, padding:'9px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'var(--ms-accent)', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', textDecoration:'none', fontFamily:'inherit' }}>
                <SIcon name="Download" size={14} color="#fff" /> Télécharger
              </a>
            </div>
          </>
        ) : selected && !isRec(selected) ? (
          // Regular file detail
          <>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <h3 style={{ color:'#0f172a', fontSize:13, fontWeight:700 }}>Détails</h3>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
                <SIcon name="X" size={15} color="#94a3b8" />
              </button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:20 }}>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <FileIcon type={(selected as FileItem).type} size={56} />
                <p style={{ color:'#0f172a', fontSize:13, fontWeight:700, marginTop:12, lineHeight:1.4 }}>{(selected as FileItem).name}</p>
              </div>
              {[
                { label:'Type',    value: TYPE_META[(selected as FileItem).type]?.label ?? (selected as FileItem).type.toUpperCase() },
                { label:'Taille',  value: (selected as FileItem).size },
                { label:'Modifié', value: (selected as FileItem).updated },
                { label:'Par',     value: (selected as FileItem).author },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f8fafc' }}>
                  <span style={{ color:'#94a3b8', fontSize:12 }}>{row.label}</span>
                  <span style={{ color:'#334155', fontSize:12, fontWeight:500 }}>{row.value}</span>
                </div>
              ))}
              <button style={{ width:'100%', marginTop:20, padding:'9px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'var(--ms-accent)', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <SIcon name="Download" size={14} color="#fff" /> Télécharger
              </button>
            </div>
          </>
        ) : (
          // Storage panel
          <>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <h3 style={{ color:'#0f172a', fontSize:13, fontWeight:700 }}>Stockage</h3>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ color:'#64748b', fontSize:12 }}>Utilisé</span>
                  <span style={{ color:'#0f172a', fontSize:12, fontWeight:700 }}>{storageUsed}%</span>
                </div>
                <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${storageUsed}%`, background:'linear-gradient(90deg, var(--ms-accent), var(--ms-accent-light))', borderRadius:4 }} />
                </div>
              </div>
              {storageBreakdown.map(t => (
                <div key={t.label} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ color:'#64748b', fontSize:12 }}>{t.label}</span>
                    <span style={{ color:'#334155', fontSize:12, fontWeight:600 }}>{t.pct}%</span>
                  </div>
                  <div style={{ height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${t.pct}%`, background:t.color, borderRadius:2 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
