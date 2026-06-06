import { useState, useEffect } from 'react'
import { SIcon } from '../components/icons/SIcon'
import type { User } from '../types'
import { getMyRecordings, deleteRecording, getDownloadUrl, getPlayUrl, type RecordingDto } from '../api/recordings'
import {
  deleteMeetingFile,
  getMyMeetingFiles,
  getMeetingFileDownloadUrl,
  getMeetingFileViewUrl,
  type MeetingFileDto,
} from '../api/meetingFiles'

// ─────────────────────────────────────────────────────────────────────────────

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

interface FilesPageProps { user: User }

export function FilesPage({ user: _user }: FilesPageProps) {
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<RecordingDto | null>(null)

  const [recordings, setRecordings] = useState<RecordingDto[]>([])
  const [meetingFiles, setMeetingFiles] = useState<MeetingFileDto[]>([])
  const [loading, setLoading]       = useState(false)
  const [deleting, setDeleting]     = useState<number | null>(null)
  const [openMeetingId, setOpenMeetingId] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getMyRecordings().catch(() => [] as RecordingDto[]),
      getMyMeetingFiles().catch(() => [] as MeetingFileDto[]),
    ]).then(([recs, files]) => {
      setRecordings(recs)
      setMeetingFiles(files)
    }).finally(() => setLoading(false))
  }, [])

  // Group recordings + shared files by meeting
  const meetingMap = new Map<number, { meetingId: number; meetingSubject: string; meetingDate: string; organizationName: string; recCount: number; fileCount: number; latest: string }>()
  recordings.forEach(r => {
    const cur = meetingMap.get(r.meetingId)
    meetingMap.set(r.meetingId, {
      meetingId: r.meetingId, meetingSubject: r.meetingSubject, meetingDate: r.meetingDate, organizationName: r.organizationName,
      recCount: (cur?.recCount ?? 0) + 1,
      fileCount: cur?.fileCount ?? 0,
      latest: cur && cur.latest > r.recordedAt ? cur.latest : r.recordedAt,
    })
  })
  meetingFiles.forEach(f => {
    const cur = meetingMap.get(f.meetingId)
    meetingMap.set(f.meetingId, {
      meetingId: f.meetingId, meetingSubject: f.meetingSubject, meetingDate: f.meetingDate, organizationName: f.organizationName,
      recCount: cur?.recCount ?? 0,
      fileCount: (cur?.fileCount ?? 0) + 1,
      latest: cur && cur.latest > f.uploadedAt ? cur.latest : f.uploadedAt,
    })
  })
  const uniqueMeetings = Array.from(meetingMap.values())
    .filter(m => !search
      || m.meetingSubject.toLowerCase().includes(search.toLowerCase())
      || m.organizationName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.latest.localeCompare(a.latest))

  const visibleRecs = recordings.filter(r => openMeetingId != null && r.meetingId === openMeetingId)
  const visibleFiles = meetingFiles.filter(f => openMeetingId != null && f.meetingId === openMeetingId
    && (!search || f.fileName.toLowerCase().includes(search.toLowerCase())))

  const openMeetingMeta = openMeetingId != null ? meetingMap.get(openMeetingId) : null

  const handleDeleteRec = async (id: number) => {
    setDeleting(id)
    try {
      await deleteRecording(id)
      setRecordings(rs => rs.filter(r => r.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch { /* silent */ } finally { setDeleting(null) }
  }

  return (
    <div style={{ flex:1, display:'flex', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif' }}>

      {/* ── Left: meeting browser ────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f1f5f9', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:'var(--ms-topbar)', background:'#fff', borderBottom:'var(--ms-border-width) solid #e2e8f0', display:'flex', alignItems:'center', padding:'0 var(--ms-pad)', gap:12, flexShrink:0, boxShadow:'var(--ms-shadow-top)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={() => setOpenMeetingId(null)} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', color: openMeetingId != null ? '#64748b' : '#0f172a', fontWeight: openMeetingId != null ? 400 : 700, fontSize:15 }}>Fichiers de réunions</button>
            {openMeetingMeta && (
              <>
                <SIcon name="ChevronRight" size={14} color="#94a3b8" />
                <span style={{ color:'#0f172a', fontWeight:700, fontSize:15 }}>{openMeetingMeta.meetingSubject}</span>
              </>
            )}
          </div>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:'var(--ms-radius-sm)', padding:'6px 12px', border:'var(--ms-border-width) solid #e2e8f0' }}>
            <SIcon name="Search" size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:'#0f172a', fontFamily:'inherit', width:180 }} />
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'var(--ms-pad) var(--ms-pad) 40px' }}>

          {/* ── Root: list of meetings with files/recordings ─────────────────── */}
          {openMeetingId == null && (
            <>
              <p style={{ color:'#64748b', fontSize:12, marginBottom:16 }}>
                Enregistrements et fichiers partagés des réunions auxquelles vous avez participé.
              </p>

              {loading ? (
                <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Chargement…</div>
              ) : uniqueMeetings.length === 0 ? (
                <div style={{ padding:48, textAlign:'center' }}>
                  <SIcon name="Video" size={36} color="#e2e8f0" />
                  <p style={{ color:'#94a3b8', fontSize:14, marginTop:12 }}>Aucun fichier disponible</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
                  {uniqueMeetings.map(r => {
                    const folderDate = r.meetingDate ? (() => {
                      try { return new Date(r.meetingDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }
                      catch { return r.meetingDate }
                    })() : '—'
                    return (
                      <div key={r.meetingId} onClick={() => setOpenMeetingId(r.meetingId)}
                        style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', padding:'16px 14px', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--ms-shadow)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='#cbd5e1'; e.currentTarget.style.transform='translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='#e8edf2'; e.currentTarget.style.transform='none' }}>
                        <div style={{ width:40, height:40, borderRadius:'var(--ms-radius-sm)', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                          <SIcon name="FolderOpen" size={20} color="#ef4444" />
                        </div>
                        <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.meetingSubject}</p>
                        <p style={{ color:'#64748b', fontSize:11, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.organizationName}</p>
                        <p style={{ color:'#94a3b8', fontSize:10 }}>
                          {folderDate}
                          {(r.recCount > 0 || r.fileCount > 0) && ' · '}
                          {r.recCount > 0 && `${r.recCount} enreg.`}
                          {r.recCount > 0 && r.fileCount > 0 && ' · '}
                          {r.fileCount > 0 && `${r.fileCount} fichier${r.fileCount > 1 ? 's' : ''}`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Per-meeting view: recordings + shared files ─────────────────── */}
          {openMeetingId != null && (
            <>
              <h3 style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Enregistrements</h3>
              <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', overflow:'hidden', boxShadow:'var(--ms-shadow)', marginBottom:24 }}>
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
                  const isSel = selected?.id === r.id
                  return (
                    <div key={r.id} onClick={() => setSelected(s => s?.id === r.id ? null : r)}
                      style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 90px', padding:'12px 20px', cursor:'pointer', background: isSel ? '#fef2f2' : 'transparent', borderBottom: i < visibleRecs.length - 1 ? '1px solid #f8fafc' : 'none', transition:'background 0.13s' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='#f8fafc' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:32, height:32, borderRadius:6, background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ color:'#ef4444', fontSize:9, fontWeight:800 }}>REC</span>
                        </div>
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

              {/* Shared files for the meeting */}
              <h3 style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Fichiers partagés</h3>
              <div style={{ background:'#fff', borderRadius:'var(--ms-radius)', border:'var(--ms-border-width) solid #e8edf2', overflow:'hidden', boxShadow:'var(--ms-shadow)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 110px', padding:'10px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
                  {['Fichier','Partagé par','Taille','Date','Actions'].map(h => (
                    <span key={h} style={{ color:'#64748b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{h}</span>
                  ))}
                </div>
                {visibleFiles.length === 0 ? (
                  <div style={{ padding:48, textAlign:'center' }}>
                    <p style={{ color:'#94a3b8', fontSize:14 }}>Aucun fichier partagé</p>
                  </div>
                ) : visibleFiles.map((f, i) => (
                  <div key={f.id}
                    style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 110px', padding:'12px 20px', borderBottom: i < visibleFiles.length - 1 ? '1px solid #f8fafc' : 'none', transition:'background 0.13s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='#f8fafc' }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <SIcon name="FileText" size={16} color="#2563eb" />
                      </div>
                      <p style={{ color:'#0f172a', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.fileName}</p>
                    </div>
                    <span style={{ color:'#64748b', fontSize:12, display:'flex', alignItems:'center' }}>{f.uploadedByName}</span>
                    <span style={{ color:'#64748b', fontSize:13, display:'flex', alignItems:'center' }}>{fmtBytes(f.fileSizeBytes)}</span>
                    <span style={{ color:'#94a3b8', fontSize:12, display:'flex', alignItems:'center' }}>{fmtDate(f.uploadedAt)}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <a href={getMeetingFileViewUrl(f.id)} target="_blank" rel="noopener noreferrer" title="Ouvrir dans un nouvel onglet"
                        style={{ background:'none', border:'none', cursor:'pointer', padding:5, borderRadius:6, color:'var(--ms-accent)', display:'flex', textDecoration:'none' }}>
                        <SIcon name="ExternalLink" size={14} color="currentColor" />
                      </a>
                      <a href={getMeetingFileDownloadUrl(f.id)} download title="Télécharger"
                        style={{ background:'none', border:'none', cursor:'pointer', padding:5, borderRadius:6, color:'#94a3b8', display:'flex', textDecoration:'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='var(--ms-accent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#94a3b8' }}>
                        <SIcon name="Download" size={14} color="currentColor" />
                      </a>
                      <button onClick={async () => {
                        try {
                          setDeleting(f.id)
                          await deleteMeetingFile(f.id)
                          setMeetingFiles(prev => prev.filter(x => x.id !== f.id))
                        } catch { /* silent */ } finally { setDeleting(null) }
                      }} disabled={deleting === f.id}
                        title="Supprimer"
                        style={{ background:'none', border:'none', cursor:'pointer', padding:5, borderRadius:6, color:'#94a3b8', display:'flex' }}
                        onMouseEnter={e => { e.currentTarget.style.color='#ef4444' }}
                        onMouseLeave={e => { e.currentTarget.style.color='#94a3b8' }}>
                        <SIcon name="Trash2" size={14} color="currentColor" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right: recording detail panel ───────────────────────────────────── */}
      {selected && (
        <div style={{ width:260, background:'#fff', borderLeft:'1px solid #e2e8f0', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <h3 style={{ color:'#0f172a', fontSize:13, fontWeight:700 }}>Détails</h3>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
              <SIcon name="X" size={15} color="#94a3b8" />
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:20 }}>
            <video
              key={selected.id}
              src={getPlayUrl(selected.id)}
              controls
              playsInline
              style={{ width:'100%', borderRadius:'var(--ms-radius-sm)', background:'#000', marginBottom:14 }}
            />
            <p style={{ color:'#0f172a', fontSize:13, fontWeight:700, lineHeight:1.4, marginBottom:14, wordBreak:'break-all' }}>{selected.fileName}</p>
            {[
              { label:'Réunion',       value: selected.meetingSubject },
              { label:'Organisation',  value: selected.organizationName },
              { label:'Date réunion',  value: selected.meetingDate ?? '—' },
              { label:'Taille',        value: fmtBytes(selected.fileSizeBytes) },
              { label:'Enregistré',    value: fmtDate(selected.recordedAt) },
              { label:'Par',           value: selected.recordedByName },
              { label:'Accès',         value: 'Participants uniquement' },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f8fafc' }}>
                <span style={{ color:'#94a3b8', fontSize:12 }}>{row.label}</span>
                <span style={{ color:'#334155', fontSize:12, fontWeight:500, textAlign:'right', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.value}</span>
              </div>
            ))}
            <a href={getDownloadUrl(selected.id)} download
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, width:'100%', marginTop:20, padding:'9px', borderRadius:'var(--ms-radius-sm)', border:'none', background:'var(--ms-accent)', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer', textDecoration:'none', fontFamily:'inherit' }}>
              <SIcon name="Download" size={14} color="#fff" /> Télécharger
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
