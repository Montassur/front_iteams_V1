import { useState, useEffect } from 'react'
import { SIcon } from '../components/icons/SIcon'
import { getMyTasks, getOrgTasks, createTask, updateTask, deleteTask } from '../api/tasks'
import { createMeeting } from '../api/meetings'
import { todayInputValue, tomorrowInputValue, nextQuarterHourValue, localTimeInputValue } from '../utils/dateInput'
import type { MeetingTaskDto, TaskStatus } from '../types/meeting'
import type { User } from '../types'
import * as chatApi from '../api/chat'
import type { UserSummaryDto } from '../types/chat'

// ── constants ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
const avatarColor = (s: string) => AVATAR_COLORS[(s?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
const initials = (n: string) => (n ?? '?').split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)

const CAN_SEE_ALL = ['ADMIN', 'OWNER', 'SUPERVISOR', 'MANAGER']

const STATUS_COLS: { key: TaskStatus; label: string; color: string; bg: string; icon: string }[] = [
  { key: 'TO_DO',       label: 'À faire',  color: '#64748b', bg: '#f1f5f9', icon: 'Circle' },
  { key: 'IN_PROGRESS', label: 'En cours', color: '#2563eb', bg: '#eff6ff', icon: 'Clock' },
  { key: 'DONE',        label: 'Terminée', color: '#10b981', bg: '#f0fdf4', icon: 'CheckCircle' },
]

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface TaskModalProps {
  orgId: number
  initialStatus: TaskStatus
  members: UserSummaryDto[]
  editing?: MeetingTaskDto
  onClose: () => void
  onSave: (task: MeetingTaskDto) => void
}

function TaskModal({ orgId, initialStatus, members, editing, onClose, onSave }: TaskModalProps) {
  const [desc, setDesc] = useState(editing?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? initialStatus)
  const [assigneeId, setAssigneeId] = useState<number | ''>(editing?.assigneeId ?? '')
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!desc.trim()) return
    setSaving(true)
    try {
      const payload = {
        description: desc.trim(),
        status,
        assigneeId: assigneeId !== '' ? Number(assigneeId) : undefined,
        dueDate: dueDate || undefined,
      }
      const result = editing
        ? await updateTask(editing.id, payload)
        : await createTask(orgId, payload)
      onSave({ ...result, organizationId: orgId })
      onClose()
    } catch { /* silent */ } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 'var(--ms-radius-lg)', width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--ms-radius-sm)', background: 'var(--ms-accent-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SIcon name={editing ? 'Edit2' : 'Plus'} size={15} color="var(--ms-accent)" sw={2.5} />
            </div>
            <h2 style={{ color: '#0f172a', fontSize: 15, fontWeight: 700 }}>{editing ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <SIcon name="X" size={17} color="#94a3b8" />
          </button>
        </div>
        <div style={{ padding: '18px 22px 22px' }}>
          <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Description <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Décrivez la tâche…" rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 14 }}
            onFocus={e => { e.target.style.borderColor = 'var(--ms-accent)' }}
            onBlur={e =>  { e.target.style.borderColor = '#e2e8f0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', fontFamily: 'inherit', outline: 'none' }}>
                {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Date d'échéance</label>
              <input type="date" value={dueDate} min={todayInputValue()} onChange={e => setDueDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {members.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Assigner à</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', fontFamily: 'inherit', outline: 'none' }}>
                <option value="">Moi-même</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
            <button onClick={submit} disabled={saving || !desc.trim()} style={{ flex: 2, padding: '10px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: desc.trim() ? 'var(--ms-accent)' : '#e2e8f0', color: desc.trim() ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 13, cursor: desc.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {saving ? 'Sauvegarde…' : editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Kanban card ───────────────────────────────────────────────────────────────

function KanbanCard({ task: t, onStatusChange, onSelect, onDelete }: {
  task: MeetingTaskDto
  onStatusChange: (t: MeetingTaskDto, s: TaskStatus) => void
  onSelect: (t: MeetingTaskDto) => void
  onDelete: (t: MeetingTaskDto) => void
}) {
  const overdue = t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date()
  const NEXT: Record<TaskStatus, TaskStatus> = { TO_DO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'TO_DO' }
  const next = NEXT[t.status]
  const nextMeta = STATUS_COLS.find(s => s.key === next)!

  return (
    <div onClick={() => onSelect(t)} style={{ background: '#fff', borderRadius: 'var(--ms-radius)', padding: '12px 14px', border: '1px solid #e8edf2', boxShadow: 'var(--ms-shadow)', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--ms-shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--ms-shadow)'; e.currentTarget.style.transform = 'none' }}>
      <p style={{ color: t.status === 'DONE' ? '#94a3b8' : '#0f172a', fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 8, textDecoration: t.status === 'DONE' ? 'line-through' : 'none' }}>
        {t.description}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t.assigneeName && (
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(t.assigneeName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 8 }} title={t.assigneeName}>
              {initials(t.assigneeName)}
            </div>
          )}
          {t.dueDate && (
            <span style={{ color: overdue ? '#ef4444' : '#94a3b8', fontSize: 11, fontWeight: overdue ? 600 : 400, display: 'flex', alignItems: 'center', gap: 3 }}>
              <SIcon name="Calendar" size={10} color={overdue ? '#ef4444' : '#cbd5e1'} />
              {new Date(t.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onStatusChange(t, next) }}
            title={`→ ${nextMeta.label}`}
            style={{ background: nextMeta.bg, border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', color: nextMeta.color, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
            <SIcon name="ArrowRight" size={9} color={nextMeta.color} />
            {nextMeta.label}
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(t) }}
            style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <SIcon name="Trash2" size={11} color="#ef4444" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task detail ───────────────────────────────────────────────────────────────

function TaskDetail({ task: t, onClose, onEdit, onStatusChange, onScheduleMeeting }: {
  task: MeetingTaskDto; onClose: () => void
  onEdit: () => void
  onStatusChange: (t: MeetingTaskDto, s: TaskStatus) => void
  onScheduleMeeting: () => void
}) {
  const overdue = t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date()
  const col = STATUS_COLS.find(s => s.key === t.status)!
  return (
    <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 700, flex: 1 }}>Détails</h3>
        <button onClick={onEdit} style={{ background: 'var(--ms-accent-pale)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'var(--ms-accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <SIcon name="Edit2" size={12} color="var(--ms-accent)" /> Modifier
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <SIcon name="X" size={15} color="#94a3b8" />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <h2 style={{ color: t.status === 'DONE' ? '#94a3b8' : '#0f172a', fontSize: 14, fontWeight: 700, lineHeight: 1.5, marginBottom: 16, textDecoration: t.status === 'DONE' ? 'line-through' : 'none' }}>
          {t.description}
        </h2>
        {[
          { icon: 'Activity', label: 'Statut',  value: <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: col.bg, color: col.color }}>{col.label}</span> },
          { icon: 'Calendar', label: 'Échéance', value: t.dueDate ? <span style={{ color: overdue ? '#ef4444' : '#0f172a', fontSize: 13, fontWeight: 500 }}>{new Date(t.dueDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}</span> : <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span> },
          { icon: 'User',     label: 'Assigné',  value: t.assigneeName ? <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 20, height: 20, borderRadius: '50%', background: avatarColor(t.assigneeName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 8 }}>{initials(t.assigneeName)}</div><span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{t.assigneeName}</span></div> : <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span> },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
            <SIcon name={row.icon} size={13} color="#94a3b8" />
            <span style={{ color: '#94a3b8', fontSize: 12, width: 64, flexShrink: 0 }}>{row.label}</span>
            {row.value}
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {t.organizationId && t.status !== 'DONE' && (
          <button onClick={onScheduleMeeting}
            style={{ padding: '9px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: 'var(--ms-accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 6px var(--ms-accent-glow)' }}>
            <SIcon name="CalendarPlus" size={13} color="#fff" /> Planifier une réunion
          </button>
        )}
        {STATUS_COLS.filter(s => s.key !== t.status).map(s => (
          <button key={s.key} onClick={() => onStatusChange(t, s.key)}
            style={{ padding: '8px', borderRadius: 'var(--ms-radius-sm)', border: `1px solid ${s.bg}`, background: s.bg, color: s.color, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            → {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Meeting-from-task modal ───────────────────────────────────────────────────

function MeetingFromTaskModal({ task, onClose, onCreated }: {
  task: MeetingTaskDto
  onClose: () => void
  onCreated: (meetingId: number) => void
}) {
  const today = todayInputValue()
  // Use the task's due date if it's still in the future, otherwise pick tomorrow.
  const defaultDate = task.dueDate && task.dueDate >= today
    ? task.dueDate
    : tomorrowInputValue()

  const [subject, setSubject] = useState(`Réunion : ${task.description}`)
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultDate === today ? nextQuarterHourValue() : '09:00')
  const [duration, setDuration] = useState(30)

  const isTodaySelected = date === today
  const minTime = isTodaySelected ? localTimeInputValue() : undefined

  useEffect(() => {
    if (!isTodaySelected) return
    const nowHM = localTimeInputValue()
    if (time < nowHM) setTime(nextQuarterHourValue())
  }, [isTodaySelected, date, time])
  const [includeAssignee, setIncludeAssignee] = useState(Boolean(task.assigneeId))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const orgId = task.organizationId

  const submit = async () => {
    if (!orgId) { setError('Aucune organisation associée à cette tâche.'); return }
    if (!subject.trim()) { setError('Sujet requis.'); return }
    if (!date || !time) { setError('Date et heure requises.'); return }

    // Build a local ISO without timezone shift — backend treats it as LocalDateTime
    const scheduled = `${date}T${time}:00`
    const scheduledMs = new Date(scheduled).getTime()
    if (!Number.isFinite(scheduledMs) || scheduledMs <= Date.now()) {
      setError('La date/heure doit être dans le futur.')
      return
    }

    setSaving(true); setError('')
    try {
      const created = await createMeeting(orgId, {
        subject: subject.trim(),
        description: `Créée depuis la tâche : ${task.description}`,
        scheduledDateTime: scheduled,
        plannedDurationMinutes: duration,
        participants: includeAssignee && task.assigneeId
          ? [{ userId: task.assigneeId, role: 'PARTICIPANT' }]
          : undefined,
      })
      onCreated(created.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', fontFamily: 'Inter, sans-serif' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 'var(--ms-radius-lg)', width: 460, boxShadow: '0 32px 80px rgba(15,23,42,0.22)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--ms-accent-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="CalendarPlus" size={15} color="var(--ms-accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Planifier une réunion</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>À partir de la tâche sélectionnée</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <SIcon name="X" size={17} color="#94a3b8" />
          </button>
        </div>

        <div style={{ padding: '18px 22px 22px', display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Sujet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Date</label>
              <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Heure</label>
              <input type="time" value={time} min={minTime} onChange={e => setTime(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Durée (min)</label>
              <input type="number" min={5} step={5} value={duration} onChange={e => setDuration(Math.max(5, Number(e.target.value) || 30))}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {task.assigneeId && task.assigneeName && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e8edf2', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeAssignee} onChange={e => setIncludeAssignee(e.target.checked)} />
              <span style={{ fontSize: 13, color: '#334155' }}>Inviter <strong style={{ color: '#0f172a' }}>{task.assigneeName}</strong> (responsable de la tâche)</span>
            </label>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
              <SIcon name="AlertCircle" size={14} color="#ef4444" />
              <span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
            <button onClick={submit} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: 'var(--ms-radius-sm)', border: 'none',
              background: saving ? '#c7d2fe' : 'var(--ms-accent)', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {saving ? 'Création…' : (<><SIcon name="CalendarPlus" size={14} color="#fff" /> Créer la réunion</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Tasks Page ───────────────────────────────────────────────────────────

interface TasksPageProps {
  user: User
  selectedOrgId?: number | null
}

export function TasksPage({ user, selectedOrgId }: TasksPageProps) {
  const [tasks, setTasks] = useState<MeetingTaskDto[]>([])
  const [members, setMembers] = useState<UserSummaryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MeetingTaskDto | null>(null)
  const [editing, setEditing] = useState<MeetingTaskDto | undefined>()
  const [showModal, setShowModal] = useState(false)
  const [addInitialStatus, setAddInitialStatus] = useState<TaskStatus>('TO_DO')
  const [meetingFromTask, setMeetingFromTask] = useState<MeetingTaskDto | null>(null)
  const [meetingCreatedToast, setMeetingCreatedToast] = useState('')

  const canSeeAll = CAN_SEE_ALL.includes(user.globalRole ?? '')
  const effectiveOrgId = selectedOrgId ?? null

  const load = () => {
    setLoading(true)
    const taskP = canSeeAll && effectiveOrgId
      ? getOrgTasks(effectiveOrgId)
      : getMyTasks()
    const memberP = effectiveOrgId
      ? chatApi.getOrgMembers(effectiveOrgId).catch(() => [] as UserSummaryDto[])
      : Promise.resolve([] as UserSummaryDto[])
    Promise.all([taskP, memberP])
      .then(([t, m]) => { setTasks(t); setMembers(m.filter(m => m.id !== user.id)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [effectiveOrgId, canSeeAll])

  const changeStatus = async (task: MeetingTaskDto, next: TaskStatus) => {
    try {
      const updated = await updateTask(task.id, { status: next })
      const merged = { ...updated, organizationId: task.organizationId }
      setTasks(ts => ts.map(t => t.id === task.id ? merged : t))
      setSelected(s => s?.id === task.id ? merged : s)
    } catch { /* silent */ }
  }

  const handleDelete = async (task: MeetingTaskDto) => {
    try {
      await deleteTask(task.id)
      setTasks(ts => ts.filter(t => t.id !== task.id))
      if (selected?.id === task.id) setSelected(null)
    } catch { /* silent */ }
  }

  const handleSave = (task: MeetingTaskDto) => {
    setTasks(ts => {
      const idx = ts.findIndex(t => t.id === task.id)
      if (idx >= 0) { const next = [...ts]; next[idx] = task; return next }
      return [task, ...ts]
    })
    if (selected?.id === task.id) setSelected(task)
  }

  const openAdd = (status: TaskStatus) => {
    setEditing(undefined)
    setAddInitialStatus(status)
    setShowModal(true)
  }

  const openEdit = (task: MeetingTaskDto) => {
    setEditing(task)
    setShowModal(true)
  }

  const filtered = tasks.filter(t =>
    !search || t.description.toLowerCase().includes(search.toLowerCase()) ||
    (t.assigneeName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const counts = STATUS_COLS.reduce((acc, s) => {
    acc[s.key] = tasks.filter(t => t.status === s.key).length
    return acc
  }, {} as Record<TaskStatus, number>)

  const overdueCt = tasks.filter(t => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate) < new Date()).length

  return (
    <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f1f5f9', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 var(--ms-pad)', gap: 10, flexShrink: 0, boxShadow: 'var(--ms-shadow-top)' }}>
          <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 15 }}>
            {canSeeAll && effectiveOrgId ? 'Tâches · organisation' : 'Mes tâches'}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUS_COLS.map(s => (
              <span key={s.key} style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{counts[s.key]} {s.label.toLowerCase()}</span>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 'var(--ms-radius-sm)', padding: '6px 12px', border: '1px solid #e2e8f0' }}>
            <SIcon name="Search" size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', width: 120 }} />
          </div>
          <button onClick={load} style={{ width: 34, height: 34, borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="RefreshCw" size={14} color="#64748b" />
          </button>
          {effectiveOrgId && (
            <button onClick={() => openAdd('TO_DO')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--ms-radius-sm)', border: 'none', background: 'var(--ms-accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px var(--ms-accent-glow)' }}>
              <SIcon name="Plus" size={14} color="#fff" sw={2.5} /> Nouvelle tâche
            </button>
          )}
        </div>

        {overdueCt > 0 && (
          <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px var(--ms-pad)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <SIcon name="AlertCircle" size={15} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{overdueCt} tâche{overdueCt > 1 ? 's' : ''} en retard</span>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: 'var(--ms-pad)' }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ms-gap)' }}>
                {[1, 2, 3].map(c => (
                  <div key={c} style={{ background: '#e8edf5', borderRadius: 'var(--ms-radius)', padding: 12 }}>
                    {[1, 2].map(r => <div key={r} style={{ background: '#fff', borderRadius: 'var(--ms-radius)', padding: 14, marginBottom: 8, opacity: 0.6 }}><div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, width: '70%' }} /></div>)}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ms-gap)', height: '100%', minWidth: 580 }}>
                {STATUS_COLS.map(col => {
                  const colTasks = filtered.filter(t => t.status === col.key)
                  return (
                    <div key={col.key} style={{ background: '#e8edf5', borderRadius: 'var(--ms-radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px 10px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <SIcon name={col.icon} size={14} color={col.color} />
                          <span style={{ color: '#334155', fontSize: 13, fontWeight: 700 }}>{col.label}</span>
                          <span style={{ marginLeft: 'auto', background: col.bg, color: col.color, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '1px 8px' }}>{colTasks.length}</span>
                        </div>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
                        {colTasks.length === 0 && (
                          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: '16px 0', opacity: 0.7 }}>Aucune tâche</p>
                        )}
                        {colTasks.map(t => (
                          <KanbanCard key={t.id} task={t}
                            onStatusChange={changeStatus}
                            onSelect={tt => setSelected(s => s?.id === tt.id ? null : tt)}
                            onDelete={handleDelete}
                          />
                        ))}
                        {effectiveOrgId && (
                          <button onClick={() => openAdd(col.key)}
                            style={{ width: '100%', padding: '7px', borderRadius: 'var(--ms-radius-sm)', border: '1.5px dashed #cbd5e1', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s', marginTop: 4 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ms-accent)'; e.currentTarget.style.color = 'var(--ms-accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#94a3b8' }}>
                            <SIcon name="Plus" size={12} color="currentColor" /> Ajouter
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selected && (
            <TaskDetail
              task={selected}
              onClose={() => setSelected(null)}
              onEdit={() => openEdit(selected)}
              onStatusChange={changeStatus}
              onScheduleMeeting={() => setMeetingFromTask(selected)}
            />
          )}
        </div>
      </div>

      {showModal && effectiveOrgId && (
        <TaskModal
          orgId={effectiveOrgId}
          initialStatus={addInitialStatus}
          members={members}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
          onSave={handleSave}
        />
      )}

      {meetingFromTask && (
        <MeetingFromTaskModal
          task={meetingFromTask}
          onClose={() => setMeetingFromTask(null)}
          onCreated={() => setMeetingCreatedToast('Réunion créée ✓')}
        />
      )}

      {meetingCreatedToast && (
        <div onAnimationEnd={() => setMeetingCreatedToast('')}
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 12px 28px rgba(15,23,42,0.3)', zIndex: 400, animation: 'fadeToast 2.4s forwards' }}>
          <style>{`@keyframes fadeToast { 0% { opacity: 0; transform: translate(-50%, 10px) } 12% { opacity: 1; transform: translate(-50%, 0) } 88% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -10px) } }`}</style>
          {meetingCreatedToast}
        </div>
      )}
    </div>
  )
}
