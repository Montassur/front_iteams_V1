import { useState, useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { SIcon } from '../components/icons/SIcon';
import type { User, PageId } from '../types';
import type { MeetingDto, MeetingTaskDto, TaskStatus, MeetingRole } from '../types/meeting';
import {
  getMeeting, updateNote, updateMeetingTask, addMeetingTask, createMeeting,
  updateParticipantRole, endMeetingForAll,
} from '../api/meetings';
import { uploadRecording } from '../api/recordings';
import { MeetingReportModal } from '../components/MeetingReportModal';
import { todayInputValue, localTimeInputValue, nextQuarterHourValue } from '../utils/dateInput';
import {
  deleteMeetingFile,
  getMeetingFiles,
  getMeetingFileDownloadUrl,
  getMeetingFileViewUrl,
  uploadMeetingFile,
  type MeetingFileDto,
} from '../api/meetingFiles';
import { loadSession } from '../utils/session';
import { useMeetingRoom } from '../hooks/useMeetingRoom';
import { useRecording } from '../hooks/useRecording';

interface Props {
  user: User;
  meetingId: number;
  orgId: number;
  setPage: (p: PageId) => void;
}

type SideTab = 'participants' | 'agenda' | 'notes' | 'tasks' | 'chat' | 'files';

interface ChatMsg {
  senderEmail: string;
  senderName: string;
  content: string;
  sentAt: string;
}

// ── Avatar color palette ──────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
const avatarColor = (str: string) => AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length];
const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

export function ActiveMeeting({ user, meetingId, orgId, setPage }: Props) {
  // ── Meeting data ─────────────────────────────────────────────────────────────
  const [meeting, setMeeting] = useState<MeetingDto | null>(null);
  const [_loadingData, setLoadingData] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteStomp = useRef<Client | null>(null);
  const pendingTaskIds = useRef<Set<number>>(new Set());

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [sideOpen, setSideOpen] = useState(true);
  const [sideTab, setSideTab] = useState<SideTab>('participants');
  const [newTask, setNewTask] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<number | null>(null);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskScheduleMeeting, setNewTaskScheduleMeeting] = useState(false);
  const [newTaskMtgTime, setNewTaskMtgTime] = useState('09:00');
  const [newTaskMtgDuration, setNewTaskMtgDuration] = useState(30);
  const [newTaskError, setNewTaskError] = useState('');

  // When user enables the schedule-meeting toggle on today's date, snap the time
  // to the next quarter-hour so it can't auto-submit a past timestamp.
  useEffect(() => {
    if (!newTaskScheduleMeeting) return;
    if (newTaskDueDate !== todayInputValue()) return;
    if (newTaskMtgTime < localTimeInputValue()) {
      setNewTaskMtgTime(nextQuarterHourValue());
    }
  }, [newTaskScheduleMeeting, newTaskDueDate, newTaskMtgTime]);
  const [addingTask, setAddingTask] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeAgendaIdx, setActiveAgendaIdx] = useState(0);
  const [agendaElapsed, setAgendaElapsed] = useState<number[]>([]);
  const [runningAgenda, setRunningAgenda] = useState<number | null>(null);
  const agendaTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Meeting timer (since join) ───────────────────────────────────────────────
  const [meetingElapsed, setMeetingElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMeetingElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Report modal trigger (used on completed-meeting screen) ──────────────────
  const [showReport, setShowReport] = useState(false);

  // ── Shared files (broadcast across participants) ────────────────────────────
  const [files, setFiles] = useState<MeetingFileDto[]>([]);
  const [fileUploadPct, setFileUploadPct] = useState<number | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMeetingFiles(orgId, meetingId).then(setFiles).catch(() => {});
  }, [orgId, meetingId]);

  const handlePickFile = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileUploadPct(0); setFileError('');
    try {
      await uploadMeetingFile(orgId, meetingId, f, setFileUploadPct);
      // Optimistic refresh — broadcast will also re-add but de-duped below
      const list = await getMeetingFiles(orgId, meetingId);
      setFiles(list);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Upload échoué');
    } finally {
      setFileUploadPct(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const handleDeleteFile = async (id: number) => {
    try {
      await deleteMeetingFile(id);
      setFiles((fs) => fs.filter((x) => x.id !== id));
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Suppression échouée');
    }
  };

  // ── Recording status (broadcast across participants) ─────────────────────────
  const [recordingStarter, setRecordingStarter] = useState<{ name: string; email: string } | null>(null);
  const [recElapsed, setRecElapsed] = useState(0);
  useEffect(() => {
    if (!recordingStarter) { setRecElapsed(0); return; }
    const t = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recordingStarter]);

  const canManage = ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(user.globalRole ?? '');

  // ── Meeting-scoped role (from the participation record) ─────────────────────
  // Distinct from globalRole. Drives screen-share + end-for-all permissions.
  const myMeetingRole: MeetingRole = (meeting?.participants.find((p) => p.userEmail === user.email)?.role) ?? 'PARTICIPANT';
  const isModerator = myMeetingRole === 'MODERATOR';
  const canShareScreen = isModerator || myMeetingRole === 'PRESENTER';

  // ── WebRTC room ──────────────────────────────────────────────────────────────
  const {
    localStream, remoteParticipants, isAudioOn, isVideoOn, isScreenSharing,
    isConnected, mediaError, toggleAudio, toggleVideo, startScreenShare, stopScreenShare,
  } = useMeetingRoom({ meetingId, userEmail: user.email, userName: user.name, canShareScreen });

  // ── Recording ────────────────────────────────────────────────────────────────
  const { state: recState, uploadProgress, setUploadProgress, errorMsg: recError, start: startRecRaw, stop: stopRecRaw } = useRecording({
    localStream,
    remoteParticipants,
    onStop: async (blob) => {
      noteStomp.current?.publish({
        destination: '/app/meeting.recording.update',
        body: JSON.stringify({ meetingId, status: 'STOPPED' }),
      });
      await uploadRecording(orgId, meetingId, blob, setUploadProgress);
    },
  });

  const startRec = () => {
    startRecRaw();
    noteStomp.current?.publish({
      destination: '/app/meeting.recording.update',
      body: JSON.stringify({ meetingId, status: 'STARTED' }),
    });
    // Optimistic local indicator (in case our own subscription delivery is delayed)
    setRecordingStarter({ name: user.name, email: user.email });
  };
  const stopRec = () => { stopRecRaw(); };

  // ── Load meeting data ────────────────────────────────────────────────────────
  useEffect(() => {
    getMeeting(orgId, meetingId).then((m) => {
      setMeeting(m);
      setNoteContent(m.collaborativeNote ?? '');
      setAgendaElapsed(m.agendaItems.map(() => 0));
      setLoadingData(false);
      // Note: status transition SCHEDULED → IN_PROGRESS now happens server-side
      // inside MeetingRoomWebSocketController.join when the first participant arrives.
    }).catch(() => setLoadingData(false));
  }, [orgId, meetingId]);

  // ── Real-time notes via WebSocket ────────────────────────────────────────────
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL as string),
      connectHeaders: { Authorization: `Bearer ${loadSession()?.token ?? ''}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/meeting/${meetingId}/note`, (frame) => {
          const data = JSON.parse(frame.body) as { textContent: string; updatedBy: string };
          if (data.updatedBy !== user.email) setNoteContent(data.textContent);
        });
        client.subscribe(`/topic/meeting/${meetingId}/chat`, (frame) => {
          const msg = JSON.parse(frame.body) as ChatMsg;
          setChatMessages((prev) => [...prev, msg]);
        });
        client.subscribe(`/topic/meeting/${meetingId}/recording`, (frame) => {
          const evt = JSON.parse(frame.body) as { status: string; starterName: string; starterEmail: string };
          if (evt.status === 'STARTED') setRecordingStarter({ name: evt.starterName, email: evt.starterEmail });
          else setRecordingStarter(null);
        });
        client.subscribe(`/topic/meeting/${meetingId}/file`, (frame) => {
          const evt = JSON.parse(frame.body) as { action: string; file?: MeetingFileDto; fileId?: number };
          if (evt.action === 'ADDED' && evt.file) {
            setFiles((prev) => prev.some((f) => f.id === evt.file!.id) ? prev : [evt.file!, ...prev]);
          } else if (evt.action === 'DELETED' && evt.fileId) {
            setFiles((prev) => prev.filter((f) => f.id !== evt.fileId));
          }
        });
        // Moderator updated a participant's role — sync local state.
        // Also handles ADDED events when a user joins without prior invitation
        // (backend auto-creates a PARTICIPANT row in that case).
        client.subscribe(`/topic/meeting/${meetingId}/participant-role`, (frame) => {
          const evt = JSON.parse(frame.body) as {
            userId: number; role: MeetingRole;
            action?: 'ADDED'; userEmail?: string; userName?: string; participationId?: number;
          };
          setMeeting((m) => {
            if (!m) return m;
            const exists = m.participants.some((p) => p.userId === evt.userId);
            if (!exists && evt.action === 'ADDED' && evt.userEmail && evt.userName && evt.participationId != null) {
              return {
                ...m,
                participants: [
                  ...m.participants,
                  { id: evt.participationId, userId: evt.userId, userEmail: evt.userEmail, userName: evt.userName, role: evt.role },
                ],
              };
            }
            return {
              ...m,
              participants: m.participants.map((p) => p.userId === evt.userId ? { ...p, role: evt.role } : p),
            };
          });
        });
        // Moderator closed the meeting — kick everyone to the meetings list
        client.subscribe(`/topic/meeting/${meetingId}/closed`, () => {
          setPage('meetings');
        });
        client.subscribe(`/topic/meeting/${meetingId}/task`, (frame) => {
          const event = JSON.parse(frame.body) as { action: string; task?: MeetingTaskDto; taskId?: number };
          setMeeting((m) => {
            if (!m) return m;
            if (event.action === 'CREATED' && event.task) {
              // skip if we already added this optimistically (our own create)
              if (pendingTaskIds.current.has(event.task.id)) {
                pendingTaskIds.current.delete(event.task.id);
                return m;
              }
              const exists = m.tasks.some((t) => t.id === event.task!.id);
              return exists ? m : { ...m, tasks: [...m.tasks, event.task!] };
            }
            if (event.action === 'UPDATED' && event.task) {
              return { ...m, tasks: m.tasks.map((t) => t.id === event.task!.id ? event.task! : t) };
            }
            if (event.action === 'DELETED' && event.taskId) {
              return { ...m, tasks: m.tasks.filter((t) => t.id !== event.taskId) };
            }
            return m;
          });
        });
      },
    });
    client.activate();
    noteStomp.current = client;
    return () => { client.deactivate(); };
  }, [meetingId, orgId, user.email]);

  const handleNoteChange = (val: string) => {
    setNoteContent(val);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(async () => {
      setNoteSaving(true);
      try {
        if (noteStomp.current?.connected) {
          noteStomp.current.publish({
            destination: '/app/meeting.note.update',
            body: JSON.stringify({ orgId, meetingId, textContent: val }),
          });
        } else {
          await updateNote(orgId, meetingId, val);
        }
      } catch { /* silent */ } finally { setNoteSaving(false); }
    }, 700);
  };

  // ── Agenda timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (runningAgenda === null) { clearInterval(agendaTickRef.current!); return; }
    agendaTickRef.current = setInterval(() => {
      setAgendaElapsed((prev) => {
        const next = [...prev];
        next[runningAgenda] = (next[runningAgenda] ?? 0) + 1;
        return next;
      });
    }, 1000);
    return () => clearInterval(agendaTickRef.current!);
  }, [runningAgenda]);

  // ── Tasks ────────────────────────────────────────────────────────────────────
  const toggleTask = useCallback(async (task: MeetingTaskDto) => {
    const next: TaskStatus = task.status === 'DONE' ? 'TO_DO' : 'DONE';
    try {
      const updated = await updateMeetingTask(orgId, meetingId, task.id, { status: next });
      setMeeting((m) => m ? { ...m, tasks: m.tasks.map((t) => t.id === task.id ? updated : t) } : m);
    } catch { /* silent */ }
  }, [orgId, meetingId]);

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    setNewTaskError('');

    // Schedule-a-meeting validation (only when toggle is on)
    if (newTaskScheduleMeeting) {
      if (!newTaskDueDate || !newTaskMtgTime) {
        setNewTaskError('Date et heure requises pour planifier la réunion.');
        return;
      }
      const scheduledMs = new Date(`${newTaskDueDate}T${newTaskMtgTime}:00`).getTime();
      if (!Number.isFinite(scheduledMs) || scheduledMs <= Date.now()) {
        setNewTaskError('La date/heure de la réunion doit être dans le futur.');
        return;
      }
    }

    setAddingTask(true);
    try {
      const task = await addMeetingTask(orgId, meetingId, {
        description: newTask.trim(),
        assigneeId: newTaskAssigneeId ?? undefined,
        dueDate: newTaskDueDate || undefined,
      });
      pendingTaskIds.current.add(task.id);
      setMeeting((m) => {
        if (!m) return m;
        if (m.tasks.some((t) => t.id === task.id)) return m;
        return { ...m, tasks: [...m.tasks, task] };
      });

      // If the user asked to schedule a follow-up meeting, fire-and-handle errors clearly.
      if (newTaskScheduleMeeting) {
        try {
          await createMeeting(orgId, {
            subject: `Réunion : ${newTask.trim()}`,
            description: `Créée depuis la tâche : ${newTask.trim()}`,
            scheduledDateTime: `${newTaskDueDate}T${newTaskMtgTime}:00`,
            plannedDurationMinutes: newTaskMtgDuration,
            participants: newTaskAssigneeId
              ? [{ userId: newTaskAssigneeId, role: 'PARTICIPANT' }]
              : undefined,
          });
        } catch (e) {
          // Task was created; only the follow-up meeting failed — keep the task, surface the error
          setNewTaskError(`Tâche créée, réunion non créée : ${e instanceof Error ? e.message : 'erreur'}`);
          setAddingTask(false);
          return;
        }
      }

      setNewTask('');
      setNewTaskAssigneeId(null);
      setNewTaskDueDate('');
      setNewTaskScheduleMeeting(false);
      setNewTaskMtgTime('09:00');
      setNewTaskMtgDuration(30);
    } catch (e) {
      setNewTaskError(e instanceof Error ? e.message : 'Échec de la création');
    } finally {
      setAddingTask(false);
    }
  };

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text || !noteStomp.current?.connected) return;
    noteStomp.current.publish({
      destination: '/app/meeting.chat.send',
      body: JSON.stringify({ meetingId, content: text }),
    });
    setChatInput('');
  };

  // ── Leave ────────────────────────────────────────────────────────────────────
  const handleLeave = () => setPage('meetings');

  const handleEndMeeting = async () => {
    if (!isModerator) return;
    if (!window.confirm('Terminer la réunion pour tous les participants ?')) return;
    try { await endMeetingForAll(orgId, meetingId); } catch { /* silent — backend WS broadcast will still kick others */ }
    setPage('meetings');
  };

  // ── Video grid layout ────────────────────────────────────────────────────────
  const allTiles = [
    { email: user.email, name: user.name, stream: localStream, isSelf: true, audioOn: isAudioOn, videoOn: isVideoOn },
    ...remoteParticipants.map((p) => ({
      email: p.email, name: p.name, stream: p.stream, isSelf: false, audioOn: p.audioEnabled, videoOn: true,
    })),
  ];
  const total = allTiles.length;
  const gridCols = total <= 1 ? 1 : total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : 4;

  const doneTasks = meeting?.tasks.filter((t) => t.status === 'DONE').length ?? 0;
  const totalTasks = meeting?.tasks.length ?? 0;

  // Gate: meeting hasn't reached its scheduled time yet
  if (meeting && meeting.scheduledDateTime && new Date(meeting.scheduledDateTime).getTime() > Date.now()) {
    const startsAt = new Date(meeting.scheduledDateTime);
    const minsLeft = Math.ceil((startsAt.getTime() - Date.now()) / 60000);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#e6edf3', fontFamily: 'Inter, sans-serif', gap: 16, padding: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SIcon name="Clock" size={28} color="#58a6ff" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{meeting.subject}</h2>
        <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>
          Cette réunion n'a pas encore commencé.
        </p>
        <p style={{ color: '#e6edf3', fontSize: 15, fontWeight: 600, margin: 0 }}>
          Démarre {startsAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
          {minsLeft > 0 ? ` (dans ${minsLeft} min)` : ''}
        </p>
        <button onClick={() => setPage('meetings')} style={{
          marginTop: 8, padding: '9px 18px', borderRadius: 10, border: '1px solid #30363d',
          background: '#21262d', color: '#e6edf3', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Retour aux réunions
        </button>
      </div>
    );
  }

  // Gate: meeting already closed
  if (meeting && (meeting.status === 'COMPLETED' || meeting.status === 'CANCELLED')) {
    return (
      <>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#e6edf3', fontFamily: 'Inter, sans-serif', gap: 16, padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SIcon name="CheckCircle" size={28} color="#3fb950" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{meeting.subject}</h2>
          <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>
            Cette réunion est {meeting.status === 'CANCELLED' ? 'annulée' : 'terminée'}.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {meeting.status === 'COMPLETED' && (
              <button onClick={() => setShowReport(true)} style={{
                padding: '9px 18px', borderRadius: 10, border: 'none',
                background: 'var(--ms-accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px var(--ms-accent-glow)',
              }}>
                <SIcon name="FileText" size={14} color="#fff" /> Voir le rapport
              </button>
            )}
            <button onClick={() => setPage('meetings')} style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid #30363d',
              background: '#21262d', color: '#e6edf3', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Retour aux réunions
            </button>
          </div>
        </div>
        {showReport && (
          <MeetingReportModal orgId={orgId} meetingId={meetingId} onClose={() => setShowReport(false)} />
        )}
      </>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0d1117', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 56, background: '#161b22', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0 }}>
        <button onClick={handleLeave} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontFamily: 'inherit' }}>
          <SIcon name="ChevronLeft" size={15} color="#8b949e" /> Retour
        </button>
        <div style={{ width: 1, height: 18, background: '#21262d' }} />

        {/* Status dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#10b981' : '#f59e0b', flexShrink: 0 }} />

        <span style={{ color: '#e6edf3', fontWeight: 700, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meeting?.subject ?? 'Réunion…'}
        </span>

        {/* Meeting timer (time since you joined — NOT recording) */}
        <div title="Durée de la réunion" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#21262d', padding: '5px 12px', borderRadius: 20 }}>
          <SIcon name="Clock" size={12} color="#8b949e" />
          <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(meetingElapsed)}</span>
        </div>

        {/* REC pill — visible to everyone in the meeting when a recording is in progress */}
        {recordingStarter && (
          <div title={`Enregistré par ${recordingStarter.name}`} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#3d1a1a', border: '1px solid #6e1a1a',
            padding: '4px 10px', borderRadius: 20,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.2s infinite' }} />
            <span style={{ color: '#f85149', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>REC</span>
            <span style={{ color: '#fca5a5', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmt(recElapsed)}</span>
            <span style={{ color: '#fca5a5', fontSize: 11, opacity: 0.85, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · par {recordingStarter.name}
            </span>
          </div>
        )}

        {/* Participant count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e', fontSize: 13 }}>
          <SIcon name="Users" size={14} color="#8b949e" />
          <span>{total}</span>
        </div>

        {totalTasks > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: doneTasks === totalTasks ? '#0d3a26' : '#2d1f09', padding: '4px 10px', borderRadius: 12 }}>
            <span style={{ color: doneTasks === totalTasks ? '#3fb950' : '#d29922', fontSize: 12, fontWeight: 600 }}>{doneTasks}/{totalTasks} tâches</span>
          </div>
        )}

        {/* Sidebar toggle */}
        <button onClick={() => setSideOpen((s) => !s)} title="Panneau" style={{ background: sideOpen ? '#21262d' : 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, color: '#8b949e' }}>
          <SIcon name="PanelRight" size={18} color={sideOpen ? '#e6edf3' : '#8b949e'} />
        </button>

        {mediaError && (
          <span style={{ fontSize: 11, color: '#f85149', background: '#2d1215', padding: '3px 8px', borderRadius: 8 }}>{mediaError}</span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Video Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 10, overflow: 'hidden', minWidth: 0 }}>
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: 8,
            overflow: 'hidden',
          }}>
            {allTiles.map((tile) => (
              <VideoTile
                key={tile.email}
                stream={tile.stream}
                name={tile.name}
                isSelf={tile.isSelf}
                audioOn={tile.audioOn}
                videoOn={tile.videoOn}
                isScreenSharing={tile.isSelf && isScreenSharing}
              />
            ))}
          </div>

          {/* ── Controls bar ─────────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 0' }}>
            {/* Mic */}
            <ControlBtn
              icon={isAudioOn ? 'Mic' : 'MicOff'}
              label={isAudioOn ? 'Muet' : 'Activer micro'}
              active={isAudioOn}
              danger={!isAudioOn}
              onClick={toggleAudio}
            />
            {/* Camera */}
            <ControlBtn
              icon={isVideoOn ? 'Video' : 'VideoOff'}
              label={isVideoOn ? 'Arrêt caméra' : 'Activer caméra'}
              active={isVideoOn}
              danger={!isVideoOn}
              onClick={toggleVideo}
            />
            {/* Screen share — visible to everyone, but disabled for plain participants
                so they can see the capability exists and who's allowed to use it. */}
            <ControlBtn
              icon={isScreenSharing ? 'MonitorOff' : 'Monitor'}
              label={
                canShareScreen
                  ? (isScreenSharing ? 'Arrêter partage' : 'Partager écran')
                  : 'Partager (réservé)'
              }
              active={canShareScreen && !isScreenSharing}
              highlight={isScreenSharing}
              disabled={!canShareScreen}
              title={canShareScreen ? undefined : 'Seul le modérateur ou un présentateur peut partager l\'écran. Demandez au modérateur de vous promouvoir.'}
              onClick={canShareScreen
                ? (isScreenSharing ? stopScreenShare : startScreenShare)
                : () => {}}
            />
            {/* Agenda quick toggle */}
            <ControlBtn
              icon="List"
              label="Agenda"
              active={sideTab !== 'agenda' || !sideOpen}
              onClick={() => { setSideTab('agenda'); setSideOpen(true); }}
            />
            {/* Notes quick toggle */}
            <ControlBtn
              icon="FileText"
              label="Notes"
              active={sideTab !== 'notes' || !sideOpen}
              onClick={() => { setSideTab('notes'); setSideOpen(true); }}
            />
            {/* Tasks quick toggle */}
            <ControlBtn
              icon="CheckSquare"
              label="Tâches"
              active={sideTab !== 'tasks' || !sideOpen}
              onClick={() => { setSideTab('tasks'); setSideOpen(true); }}
            />
            {/* Chat quick toggle */}
            <ControlBtn
              icon="MessageSquare"
              label={`Chat${chatMessages.length > 0 && (sideTab !== 'chat' || !sideOpen) ? ` (${chatMessages.length})` : ''}`}
              active={sideTab !== 'chat' || !sideOpen}
              onClick={() => { setSideTab('chat'); setSideOpen(true); }}
            />
            <ControlBtn
              icon="Paperclip"
              label={`Fichiers${files.length > 0 ? ` (${files.length})` : ''}`}
              active={sideTab !== 'files' || !sideOpen}
              onClick={() => { setSideTab('files'); setSideOpen(true); }}
            />

            <div style={{ width: 1, height: 32, background: '#21262d', margin: '0 4px' }} />

            {/* Record */}
            {recState === 'idle' && (
              <button onClick={startRec} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: '#21262d', border: '1px solid #30363d', borderRadius: 10,
                padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', minWidth: 56,
              }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                <span style={{ color: '#8b949e' }}>Enreg.</span>
              </button>
            )}
            {recState === 'recording' && (
              <button onClick={stopRec} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: '#3d1a1a', border: '1px solid #6e1a1a', borderRadius: 10,
                padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', minWidth: 56,
              }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: '#ef4444', flexShrink: 0 }} />
                <span style={{ color: '#f85149' }}>Stop</span>
              </button>
            )}
            {(recState === 'uploading') && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: '#0d2d45', border: '1px solid #1a4a6e', borderRadius: 10,
                padding: '8px 12px', fontSize: 11, fontFamily: 'inherit', minWidth: 56,
              }}>
                <SIcon name="Upload" size={16} color="#58a6ff" />
                <span style={{ color: '#58a6ff' }}>{uploadProgress}%</span>
              </div>
            )}
            {recState === 'done' && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: '#0d3a26', border: '1px solid #1a5c38', borderRadius: 10,
                padding: '8px 12px', fontSize: 11, fontFamily: 'inherit', minWidth: 56,
              }}>
                <SIcon name="Check" size={16} color="#3fb950" />
                <span style={{ color: '#3fb950' }}>Sauvé</span>
              </div>
            )}
            {recState === 'error' && (
              <button onClick={startRec} title={recError} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: '#3d1a1a', border: '1px solid #6e1a1a', borderRadius: 10,
                padding: '8px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', minWidth: 56,
              }}>
                <SIcon name="AlertCircle" size={16} color="#f85149" />
                <span style={{ color: '#f85149' }}>Erreur</span>
              </button>
            )}

            <div style={{ width: 1, height: 32, background: '#21262d', margin: '0 4px' }} />

            {/* Leave */}
            <button onClick={handleLeave} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: '#21262d', border: '1px solid #30363d', borderRadius: 10,
              padding: '8px 16px', cursor: 'pointer', color: '#e6edf3', fontSize: 11, fontFamily: 'inherit',
            }}>
              <SIcon name="LogOut" size={18} color="#e6edf3" />
              <span>Quitter</span>
            </button>

            {isModerator && (
              <button onClick={handleEndMeeting} title="Terminer la réunion pour tous les participants" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: '#da3633', border: 'none', borderRadius: 10,
                padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 11, fontFamily: 'inherit',
              }}>
                <SIcon name="PhoneOff" size={18} color="#fff" />
                <span>Terminer pour tous</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Side Panel ───────────────────────────────────────────────────── */}
        {sideOpen && (
          <div style={{ width: 300, background: '#161b22', borderLeft: '1px solid #21262d', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
              {(['participants', 'agenda', 'notes', 'tasks', 'chat', 'files'] as SideTab[]).map((t) => (
                <button key={t} onClick={() => setSideTab(t)} style={{
                  flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  color: sideTab === t ? '#58a6ff' : '#8b949e',
                  borderBottom: `2px solid ${sideTab === t ? '#58a6ff' : 'transparent'}`,
                  position: 'relative',
                }}>
                  {t === 'participants' ? '👥' : t === 'agenda' ? '📋' : t === 'notes' ? '📝' : t === 'tasks' ? '✅' : t === 'chat' ? '💬' : '📎'}
                  {t === 'chat' && chatMessages.length > 0 && sideTab !== 'chat' && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#f85149' }} />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sideTab === 'participants' && (
                <ParticipantsPanel
                  meeting={meeting}
                  currentUser={user}
                  remoteParticipants={remoteParticipants}
                  canChangeRoles={isModerator}
                  onRoleChange={async (userId, role) => {
                    try {
                      const updated = await updateParticipantRole(orgId, meetingId, userId, role);
                      setMeeting((m) => m ? {
                        ...m,
                        participants: m.participants.map((p) => p.userId === userId ? { ...p, role: updated.role } : p),
                      } : m);
                    } catch { /* WS broadcast may still arrive and sync */ }
                  }}
                />
              )}
              {sideTab === 'agenda' && (
                <AgendaPanel
                  items={meeting?.agendaItems ?? []}
                  elapsed={agendaElapsed}
                  running={runningAgenda}
                  active={activeAgendaIdx}
                  onSelect={setActiveAgendaIdx}
                  onToggle={(i) => setRunningAgenda((r) => r === i ? null : i)}
                />
              )}
              {sideTab === 'notes' && (
                <NotesPanel
                  content={noteContent}
                  saving={noteSaving}
                  onChange={handleNoteChange}
                  currentPoint={meeting?.agendaItems[activeAgendaIdx]?.title}
                />
              )}
              {sideTab === 'tasks' && (() => {
                // Merged assignee list: DB participants + any WebRTC-connected user not already there
                const assignableUsers: { userId: number; userName: string }[] = [];
                const seen = new Set<string>();

                // Always include self
                if (user.id != null && !seen.has(user.email)) {
                  seen.add(user.email);
                  assignableUsers.push({ userId: user.id, userName: user.name });
                }
                // DB participants
                for (const p of (meeting?.participants ?? [])) {
                  if (!seen.has(p.userEmail)) {
                    seen.add(p.userEmail);
                    assignableUsers.push({ userId: p.userId, userName: p.userName });
                  }
                }
                // WebRTC-connected users not in DB list
                for (const r of remoteParticipants) {
                  if (!seen.has(r.email) && r.userId != null) {
                    seen.add(r.email);
                    assignableUsers.push({ userId: r.userId, userName: r.name });
                  }
                }

                return (
                  <TasksPanel
                    tasks={meeting?.tasks ?? []}
                    assignableUsers={assignableUsers}
                    canManage={canManage}
                    newTask={newTask}
                    newTaskAssigneeId={newTaskAssigneeId}
                    newTaskDueDate={newTaskDueDate}
                    newTaskScheduleMeeting={newTaskScheduleMeeting}
                    newTaskMtgTime={newTaskMtgTime}
                    newTaskMtgDuration={newTaskMtgDuration}
                    newTaskError={newTaskError}
                    adding={addingTask}
                    onNewTaskChange={setNewTask}
                    onAssigneeChange={setNewTaskAssigneeId}
                    onDueDateChange={setNewTaskDueDate}
                    onScheduleMeetingChange={setNewTaskScheduleMeeting}
                    onMtgTimeChange={setNewTaskMtgTime}
                    onMtgDurationChange={setNewTaskMtgDuration}
                    onAddTask={handleAddTask}
                    onToggle={toggleTask}
                  />
                );
              })()}
              {sideTab === 'chat' && (
                <ChatPanel
                  messages={chatMessages}
                  input={chatInput}
                  currentUserEmail={user.email}
                  onInputChange={setChatInput}
                  onSend={handleSendChat}
                />
              )}
              {sideTab === 'files' && (
                <FilesPanel
                  files={files}
                  currentUserId={user.id}
                  uploadPct={fileUploadPct}
                  errorMsg={fileError}
                  onPick={handlePickFile}
                  onDelete={handleDeleteFile}
                />
              )}
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
    </div>
  );
}

// ── VideoTile ─────────────────────────────────────────────────────────────────

interface TileProps {
  stream: MediaStream | null;
  name: string;
  isSelf: boolean;
  audioOn: boolean;
  videoOn: boolean;
  isScreenSharing: boolean;
}

function VideoTile({ stream, name, isSelf, audioOn, videoOn, isScreenSharing }: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && videoOn;

  return (
    <div style={{
      position: 'relative', background: '#161b22', borderRadius: 12, overflow: 'hidden',
      border: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 120,
    }}>
      {hasVideo ? (
        <video
          ref={videoRef} autoPlay playsInline muted={isSelf}
          style={{ width: '100%', height: '100%', objectFit: isScreenSharing ? 'contain' : 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: avatarColor(name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff',
          }}>
            {initials(name)}
          </div>
          <span style={{ color: '#8b949e', fontSize: 12 }}>{isSelf ? 'Vous (caméra off)' : name}</span>
        </div>
      )}

      {/* Overlay badges */}
      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {!audioOn && (
          <div style={{ background: '#ef4444', borderRadius: 6, padding: '3px 5px', display: 'flex' }}>
            <SIcon name="MicOff" size={12} color="#fff" />
          </div>
        )}
        {isScreenSharing && (
          <div style={{ background: '#1d883a', borderRadius: 6, padding: '3px 7px' }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>Partage d'écran</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', background: '#0008', borderRadius: 6, padding: '3px 8px' }}>
          <span style={{ color: '#e6edf3', fontSize: 11, fontWeight: 600 }}>{isSelf ? `${name} (vous)` : name}</span>
        </div>
      </div>

      {/* Self tag */}
      {isSelf && (
        <div style={{ position: 'absolute', top: 8, left: 8, background: '#0008', borderRadius: 6, padding: '2px 8px' }}>
          <span style={{ color: '#e6edf3', fontSize: 10 }}>Vous</span>
        </div>
      )}
    </div>
  );
}

// ── Control Button ────────────────────────────────────────────────────────────

function ControlBtn({ icon, label, active: _active, danger, highlight, disabled, title, onClick }: {
  icon: string; label: string; active: boolean;
  danger?: boolean; highlight?: boolean;
  disabled?: boolean; title?: string;
  onClick: () => void;
}) {
  const bg = disabled ? '#161b22' : danger ? '#3d1a1a' : highlight ? '#0d3a26' : '#21262d';
  const border = disabled ? '#21262d' : danger ? '#6e1a1a' : highlight ? '#1a5c38' : '#30363d';
  const iconColor = disabled ? '#484f58' : danger ? '#f85149' : highlight ? '#3fb950' : '#e6edf3';

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        background: bg, border: `1px solid ${border}`, borderRadius: 10,
        padding: '8px 12px', cursor: disabled ? 'not-allowed' : 'pointer', color: iconColor,
        fontSize: 11, fontFamily: 'inherit', transition: 'all 0.12s', minWidth: 56,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <SIcon name={icon} size={18} color={iconColor} />
      <span style={{ color: disabled ? '#484f58' : '#8b949e', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

// ── Side Panels ───────────────────────────────────────────────────────────────

function ParticipantsPanel({ meeting, currentUser, remoteParticipants, canChangeRoles, onRoleChange }: {
  meeting: MeetingDto | null;
  currentUser: User;
  remoteParticipants: import('../hooks/useMeetingRoom').RemoteParticipant[];
  canChangeRoles: boolean;
  onRoleChange: (userId: number, role: MeetingRole) => void;
}) {
  if (!meeting) return <PanelLoading />;

  // Build a unified list: start with everyone currently connected via WebRTC
  // (self + remote), then fill in role/label from DB where available.
  const dbByEmail = new Map(meeting.participants.map((p) => [p.userEmail, p]));
  const connectedEmails = new Set([currentUser.email, ...remoteParticipants.map((r) => r.email)]);

  // Merged rows: connected users first, then DB-only (offline) participants
  type Row = { key: string; name: string; email: string; role: string | null; userId: number | null; online: boolean };

  const rows: Row[] = [];
  const seen = new Set<string>();

  // 1. All currently connected (self + WebRTC remote)
  for (const email of connectedEmails) {
    seen.add(email);
    const db = dbByEmail.get(email);
    const name = email === currentUser.email
      ? currentUser.name
      : (remoteParticipants.find((r) => r.email === email)?.name ?? db?.userName ?? email);
    rows.push({ key: email, name, email, role: db?.role ?? null, userId: db?.userId ?? null, online: true });
  }

  // 2. DB participants who are not connected
  for (const p of meeting.participants) {
    if (!seen.has(p.userEmail)) {
      rows.push({ key: String(p.id), name: p.userName, email: p.userEmail, role: p.role, userId: p.userId, online: false });
    }
  }

  const onlineCount = rows.filter((r) => r.online).length;

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {rows.length} participant{rows.length > 1 ? 's' : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: '#0d3a26', borderRadius: 20, padding: '2px 8px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950' }} />
          <span style={{ fontSize: 11, color: '#3fb950', fontWeight: 700 }}>{onlineCount} en ligne</span>
        </div>
      </div>
      {rows.map((r) => {
        const color = avatarColor(r.name);
        const ini = initials(r.name);
        const isSelf = r.email === currentUser.email;
        const roleLabel = r.role === 'MODERATOR' ? 'Modérateur' : r.role === 'PRESENTER' ? 'Présentateur' : 'Participant';
        return (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #21262d' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', opacity: r.online ? 1 : 0.4 }}>{ini}</div>
              {r.online && (
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#3fb950', border: '1.5px solid #161b22' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: r.online ? '#e6edf3' : '#484f58', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}{isSelf ? <span style={{ color: '#8b949e', fontWeight: 400 }}> (vous)</span> : ''}
              </p>
              <p style={{ color: '#8b949e', fontSize: 10 }}>
                {roleLabel}
                {r.online
                  ? <span style={{ color: '#3fb950', marginLeft: 5 }}>· connecté</span>
                  : <span style={{ color: '#484f58', marginLeft: 5 }}>· absent</span>}
              </p>
            </div>
            {canChangeRoles && !isSelf && r.userId != null && r.role && (
              <select
                value={r.role}
                onChange={(e) => onRoleChange(r.userId!, e.target.value as MeetingRole)}
                title="Changer le rôle"
                style={{
                  background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                  padding: '3px 6px', color: '#e6edf3', fontSize: 11, fontFamily: 'inherit',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="MODERATOR">Modérateur</option>
                <option value="PRESENTER">Présentateur</option>
                <option value="PARTICIPANT">Participant</option>
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgendaPanel({ items, elapsed, running, active, onSelect, onToggle }: {
  items: MeetingDto['agendaItems']; elapsed: number[]; running: number | null; active: number;
  onSelect: (i: number) => void; onToggle: (i: number) => void;
}) {
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (!items.length) return <EmptyPanel icon="📋" text="Aucun point d'agenda" />;
  return (
    <div>
      {items.map((item, i) => {
        const isRunning = running === i;
        const isActive = active === i;
        const total = elapsed[i] ?? 0;
        const budget = item.allocatedDurationMinutes * 60;
        const over = total > budget;
        return (
          <div key={item.id} onClick={() => onSelect(i)} style={{
            padding: '12px 14px', cursor: 'pointer',
            background: isActive ? '#1c2128' : 'transparent',
            borderLeft: `3px solid ${isRunning ? '#f59e0b' : isActive ? '#58a6ff' : 'transparent'}`,
            borderBottom: '1px solid #21262d',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, color: '#e6edf3', fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{item.title}</span>
              <button onClick={(e) => { e.stopPropagation(); onToggle(i); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isRunning ? '#f59e0b' : '#8b949e', flexShrink: 0 }}>
                <SIcon name={isRunning ? 'Pause' : 'Play'} size={14} color={isRunning ? '#f59e0b' : '#8b949e'} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 3, background: '#21262d', borderRadius: 2 }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (total / budget) * 100)}%`, background: over ? '#f85149' : isRunning ? '#f59e0b' : '#58a6ff', transition: 'width 1s linear' }} />
              </div>
              <span style={{ fontSize: 10, color: over ? '#f85149' : '#8b949e', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {fmt(total)}/{item.allocatedDurationMinutes}m
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotesPanel({ content, saving, onChange, currentPoint }: {
  content: string; saving: boolean; onChange: (v: string) => void; currentPoint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 10 }}>
      {currentPoint && (
        <div style={{ padding: '6px 10px', background: '#1c2128', borderRadius: 8, border: '1px solid #30363d' }}>
          <span style={{ color: '#8b949e', fontSize: 11 }}>Point actif : </span>
          <span style={{ color: '#58a6ff', fontSize: 11, fontWeight: 600 }}>{currentPoint}</span>
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notes collaboratives… (synchronisées en temps réel)"
        style={{
          flex: 1, resize: 'none', background: '#0d1117', border: '1px solid #30363d',
          borderRadius: 8, padding: 12, color: '#e6edf3', fontSize: 13,
          lineHeight: 1.7, fontFamily: 'inherit', outline: 'none', minHeight: 200,
        }}
      />
      <p style={{ fontSize: 10, color: saving ? '#f59e0b' : '#8b949e', textAlign: 'right' }}>
        {saving ? 'Sauvegarde…' : '● Auto-sauvegarde'}
      </p>
    </div>
  );
}

function TasksPanel({ tasks, assignableUsers, canManage, newTask, newTaskAssigneeId, newTaskDueDate, newTaskScheduleMeeting, newTaskMtgTime, newTaskMtgDuration, newTaskError, adding, onNewTaskChange, onAssigneeChange, onDueDateChange, onScheduleMeetingChange, onMtgTimeChange, onMtgDurationChange, onAddTask, onToggle }: {
  tasks: MeetingTaskDto[];
  assignableUsers: { userId: number; userName: string }[];
  canManage: boolean;
  newTask: string;
  newTaskAssigneeId: number | null;
  newTaskDueDate: string;
  newTaskScheduleMeeting: boolean;
  newTaskMtgTime: string;
  newTaskMtgDuration: number;
  newTaskError: string;
  adding: boolean;
  onNewTaskChange: (v: string) => void;
  onAssigneeChange: (id: number | null) => void;
  onDueDateChange: (v: string) => void;
  onScheduleMeetingChange: (b: boolean) => void;
  onMtgTimeChange: (v: string) => void;
  onMtgDurationChange: (n: number) => void;
  onAddTask: () => void;
  onToggle: (t: MeetingTaskDto) => void;
}) {
  const today = todayInputValue();
  const isTodaySelected = newTaskDueDate === today;
  const mtgMinTime = isTodaySelected ? localTimeInputValue() : undefined;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    DONE:        { bg: '#0d3a26', color: '#3fb950', label: 'Terminée' },
    IN_PROGRESS: { bg: '#0d2d45', color: '#58a6ff', label: 'En cours' },
    TO_DO:       { bg: '#21262d', color: '#8b949e', label: 'À faire' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Progress header */}
      {total > 0 && (
        <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#8b949e', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Progression
            </span>
            <span style={{ color: pct === 100 ? '#3fb950' : '#e6edf3', fontSize: 12, fontWeight: 700 }}>
              {done}/{total} · {pct}%
            </span>
          </div>
          <div style={{ height: 4, background: '#21262d', borderRadius: 4 }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: pct === 100 ? '#3fb950' : '#1f6feb', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {!total && !canManage && <EmptyPanel icon="✅" text="Aucune tâche" />}
        {tasks.map((task) => {
          const isDone = task.status === 'DONE';
          const meta = STATUS_COLORS[task.status] ?? STATUS_COLORS.TO_DO;
          return (
            <div key={task.id} style={{
              display: 'flex', gap: 10, padding: '10px 12px', marginBottom: 6,
              background: '#1c2128', borderRadius: 10,
              border: `1px solid ${isDone ? '#1a3a26' : '#21262d'}`,
              transition: 'border-color 0.15s',
            }}>
              <button onClick={() => onToggle(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 1 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${isDone ? '#3fb950' : '#484f58'}`,
                  background: isDone ? '#3fb950' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isDone && <SIcon name="Check" size={10} color="#fff" sw={3} />}
                </div>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: isDone ? '#484f58' : '#e6edf3', fontSize: 13, lineHeight: 1.4,
                  textDecoration: isDone ? 'line-through' : 'none', marginBottom: 5,
                }}>
                  {task.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                  {task.assigneeName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8b949e', fontSize: 11 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: avatarColor(task.assigneeName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                        {initials(task.assigneeName).slice(0, 1)}
                      </div>
                      {task.assigneeName}
                    </span>
                  )}
                  {task.dueDate && (() => {
                    const overdue = !isDone && new Date(task.dueDate).getTime() < Date.now();
                    return (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: overdue ? '#f85149' : '#8b949e', fontSize: 11, fontWeight: overdue ? 700 : 500 }}>
                        <SIcon name="Calendar" size={10} color={overdue ? '#f85149' : '#8b949e'} />
                        {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add task form */}
      {canManage && (
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #21262d', flexShrink: 0 }}>
          <textarea
            value={newTask}
            onChange={(e) => onNewTaskChange(e.target.value)}
            placeholder="Description de la tâche…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddTask(); } }}
            rows={2}
            style={{
              width: '100%', resize: 'none', background: '#0d1117',
              border: '1px solid #30363d', borderRadius: 8,
              padding: '8px 10px', color: '#e6edf3', fontSize: 12,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              lineHeight: 1.5, marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <SIcon name="User" size={14} color="#484f58" />
            <select
              value={newTaskAssigneeId ?? ''}
              onChange={(e) => onAssigneeChange(e.target.value ? Number(e.target.value) : null)}
              style={{
                flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                padding: '5px 8px', color: newTaskAssigneeId ? '#e6edf3' : '#484f58',
                fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">Non assigné</option>
              {assignableUsers.map((p) => (
                <option key={p.userId} value={p.userId}>{p.userName}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <SIcon name="Calendar" size={14} color="#484f58" />
            <input
              type="date"
              value={newTaskDueDate}
              min={today}
              onChange={(e) => onDueDateChange(e.target.value)}
              style={{
                flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                padding: '5px 8px', color: newTaskDueDate ? '#e6edf3' : '#484f58',
                fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                colorScheme: 'dark',
              }}
            />
            {newTaskDueDate && (
              <button onClick={() => onDueDateChange('')} title="Retirer l'échéance" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#484f58', display: 'flex' }}>
                <SIcon name="X" size={11} color="#484f58" />
              </button>
            )}
          </div>

          {/* Schedule-a-meeting toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: newTaskDueDate ? 'pointer' : 'not-allowed', opacity: newTaskDueDate ? 1 : 0.5 }} title={newTaskDueDate ? '' : "Choisissez d'abord une date d'échéance"}>
            <input type="checkbox" checked={newTaskScheduleMeeting} disabled={!newTaskDueDate}
              onChange={(e) => onScheduleMeetingChange(e.target.checked)} />
            <SIcon name="CalendarPlus" size={13} color={newTaskScheduleMeeting ? '#58a6ff' : '#8b949e'} />
            <span style={{ fontSize: 12, fontWeight: 600, color: newTaskScheduleMeeting ? '#58a6ff' : '#8b949e' }}>
              Planifier aussi une réunion
            </span>
          </label>

          {newTaskScheduleMeeting && (
            <div style={{ marginBottom: 8, padding: '8px 10px', background: '#0d2d45', border: '1px solid #1a4a6e', borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <SIcon name="Clock" size={13} color="#58a6ff" />
                <input
                  type="time"
                  value={newTaskMtgTime}
                  min={mtgMinTime}
                  onChange={(e) => onMtgTimeChange(e.target.value)}
                  style={{
                    flex: 1, background: '#0d1117', border: '1px solid #1f6feb', borderRadius: 6,
                    padding: '5px 8px', color: '#e6edf3', fontSize: 12, fontFamily: 'inherit',
                    outline: 'none', cursor: 'pointer', colorScheme: 'dark',
                  }}
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={newTaskMtgDuration}
                  onChange={(e) => onMtgDurationChange(Math.max(5, Number(e.target.value) || 30))}
                  title="Durée (min)"
                  style={{
                    width: 60, background: '#0d1117', border: '1px solid #1f6feb', borderRadius: 6,
                    padding: '5px 8px', color: '#e6edf3', fontSize: 12, fontFamily: 'inherit',
                    outline: 'none', textAlign: 'center', colorScheme: 'dark',
                  }}
                />
                <span style={{ fontSize: 10, color: '#58a6ff' }}>min</span>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#79c0ff' }}>
                Réunion : {newTaskDueDate} à {newTaskMtgTime} ({newTaskMtgDuration} min)
                {newTaskAssigneeId ? ' · responsable invité' : ''}
              </p>
            </div>
          )}

          {newTaskError && (
            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#f85149' }}>{newTaskError}</p>
          )}
          <button
            onClick={onAddTask}
            disabled={adding || !newTask.trim()}
            style={{
              width: '100%', padding: '8px', borderRadius: 8, border: 'none',
              background: newTask.trim() ? '#1f6feb' : '#21262d',
              color: newTask.trim() ? '#fff' : '#484f58',
              fontSize: 12, fontWeight: 700, cursor: newTask.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {adding ? (
              <span style={{ opacity: 0.7 }}>Ajout…</span>
            ) : newTaskScheduleMeeting ? (
              <><SIcon name="CalendarPlus" size={13} color={newTask.trim() ? '#fff' : '#484f58'} /> Tâche + réunion</>
            ) : (
              <><SIcon name="Plus" size={13} color={newTask.trim() ? '#fff' : '#484f58'} /> Ajouter la tâche</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ChatPanel({ messages, input, currentUserEmail, onInputChange, onSend }: {
  messages: ChatMsg[];
  input: string;
  currentUserEmail: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!messages.length && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 40 }}>
            <span style={{ fontSize: 28 }}>💬</span>
            <p style={{ color: '#8b949e', fontSize: 13 }}>Aucun message. Soyez le premier !</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderEmail === currentUserEmail;
          const color = avatarColor(msg.senderName);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 3 }}>
              {!isMine && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                    {initials(msg.senderName).slice(0, 1)}
                  </div>
                  <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 600 }}>{msg.senderName}</span>
                </div>
              )}
              <div style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: isMine ? '#1f6feb' : '#1c2128',
                border: `1px solid ${isMine ? '#1f6feb' : '#30363d'}`,
              }}>
                <p style={{ color: '#e6edf3', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
              </div>
              <span style={{ fontSize: 10, color: '#484f58' }}>{fmtTime(msg.sentAt)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #21262d', flexShrink: 0, display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Votre message…"
          style={{
            flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: 10,
            padding: '9px 12px', color: '#e6edf3', fontSize: 13, fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim()}
          style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: 10, border: 'none',
            background: input.trim() ? '#1f6feb' : '#21262d',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <SIcon name="Send" size={16} color={input.trim() ? '#fff' : '#484f58'} />
        </button>
      </div>
    </div>
  );
}

function PanelLoading() {
  return <div style={{ padding: 20, color: '#8b949e', fontSize: 13, textAlign: 'center' }}>Chargement…</div>;
}

function EmptyPanel({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <p style={{ color: '#8b949e', fontSize: 13 }}>{text}</p>
    </div>
  );
}

// ── FilesPanel ────────────────────────────────────────────────────────────────

function fmtFileBytes(b?: number) {
  if (!b) return '';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function FilesPanel({ files, currentUserId, uploadPct, errorMsg, onPick, onDelete }: {
  files: MeetingFileDto[];
  currentUserId?: number;
  uploadPct: number | null;
  errorMsg: string;
  onPick: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
        <button onClick={onPick} disabled={uploadPct !== null} style={{
          width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed #30363d',
          background: '#0d1117', color: '#58a6ff', fontWeight: 600, fontSize: 13,
          cursor: uploadPct !== null ? 'wait' : 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <SIcon name="Upload" size={14} color="#58a6ff" />
          {uploadPct !== null ? `Envoi… ${uploadPct}%` : 'Partager un fichier'}
        </button>
        {errorMsg && <p style={{ color: '#f85149', fontSize: 11, marginTop: 6, margin: '6px 0 0' }}>{errorMsg}</p>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {files.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 40 }}>
            <span style={{ fontSize: 28 }}>📎</span>
            <p style={{ color: '#8b949e', fontSize: 13 }}>Aucun fichier partagé</p>
          </div>
        )}
        {files.map((f) => {
          const canDelete = currentUserId === f.uploadedById;
          return (
            <div key={f.id} style={{
              padding: '10px 14px', borderBottom: '1px solid #21262d',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SIcon name="FileText" size={15} color="#58a6ff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                  <div style={{ color: '#8b949e', fontSize: 11 }}>
                    {fmtFileBytes(f.fileSizeBytes)} · {f.uploadedByName}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={getMeetingFileViewUrl(f.id)} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, padding: '6px', borderRadius: 6, background: '#1f6feb', color: '#fff',
                  textAlign: 'center', fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <SIcon name="ExternalLink" size={12} color="#fff" /> Ouvrir
                </a>
                <a href={getMeetingFileDownloadUrl(f.id)} download style={{
                  padding: '6px 10px', borderRadius: 6, background: '#21262d', color: '#8b949e',
                  textAlign: 'center', fontSize: 11, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} title="Télécharger">
                  <SIcon name="Download" size={12} color="#8b949e" />
                </a>
                {canDelete && (
                  <button onClick={() => onDelete(f.id)} style={{
                    padding: '6px 10px', borderRadius: 6, background: '#21262d', border: 'none',
                    color: '#f85149', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                  }} title="Supprimer">
                    <SIcon name="Trash2" size={12} color="#f85149" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
