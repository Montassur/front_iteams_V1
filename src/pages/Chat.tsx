import { useState, useEffect, useRef, useCallback } from 'react'
import { SIcon } from '../components/icons/SIcon'
import { useStompChat } from '../hooks/useStompChat'
import * as chatApi from '../api/chat'
import type { ConversationDto, MessageDto, UserSummaryDto } from '../types/chat'
import type { User } from '../types'

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6']
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
const initials = (name: string) => (name ?? '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()

function fmt(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

interface ChatPageProps { user: User; selectedOrgId?: number | null; onRead?: () => void }

export function ChatPage({ user, selectedOrgId, onRead }: ChatPageProps) {
  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [activeConv, setActiveConv] = useState<ConversationDto | null>(null)
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)

  // New DM modal
  const [showNewDm, setShowNewDm] = useState(false)
  const [orgMembers, setOrgMembers] = useState<UserSummaryDto[]>([])
  const [selectedOrgMembers, setSelectedOrgMembers] = useState<UserSummaryDto[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  // All org IDs the user belongs to
  const [_myOrgIds, setMyOrgIds] = useState<number[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const data = await chatApi.getConversations()
      setConversations(data)
    } catch { /* ignore */ }
  }, [])

  // On mount: load membership orgs, bootstrap group chats, load all members for DM modal
  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadConversations(),
      chatApi.getMyOrgs().then(async (orgs) => {
        const ids = orgs.map(o => o.id)
        setMyOrgIds(ids)

        if (ids.length === 0) return

        // Bootstrap group chats for orgs the user belongs to
        await Promise.allSettled(ids.map(id => chatApi.getOrCreateGroup(id)))
        await loadConversations()

        // Load all members across orgs for DM modal (deduplicated)
        const memberArrays = await Promise.allSettled(ids.map(id => chatApi.getOrgMembers(id)))
        const seen = new Set<number>()
        const all: UserSummaryDto[] = []
        for (const r of memberArrays) {
          if (r.status === 'fulfilled') {
            for (const m of r.value) {
              if (!seen.has(m.id)) { seen.add(m.id); all.push(m) }
            }
          }
        }
        setOrgMembers(all)
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // When opened from an org (OrgHome), ensure group chat exists and load that org's members
  useEffect(() => {
    if (!selectedOrgId) return
    chatApi.getOrCreateGroup(selectedOrgId).then(conv => {
      setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
    }).catch(() => {})
    chatApi.getOrgMembers(selectedOrgId).then(setSelectedOrgMembers).catch(() => {})
  }, [selectedOrgId])

  const openConversation = async (conv: ConversationDto) => {
    setActiveConv(conv)
    setMsgLoading(true)
    try {
      const msgs = await chatApi.getMessages(conv.id)
      setMessages(msgs)
      await chatApi.markRead(conv.id)
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      onRead?.()
    } catch { /* ignore */ } finally {
      setMsgLoading(false)
    }
  }

  // STOMP real-time
  const { sendMessage } = useStompChat({
    activeConversationId: activeConv?.id ?? null,
    onMessage: (msg) => {
      if (activeConv && msg.conversationId === activeConv.id) {
        // Deduplicate: don't add if a message with the same id already exists
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      }
      loadConversations()
    },
    onUnreadUpdate: loadConversations,
  })

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = () => {
    const txt = input.trim()
    if (!txt || !activeConv) return
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)
    sendMessage(activeConv.id, txt)
    // No optimistic update — the backend broadcasts back to the sender via WebSocket,
    // so the message arrives once through onMessage and gets added there.
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Group consecutive messages from same sender
  const grouped = messages.reduce<(MessageDto & { hideAvatar?: boolean })[]>((acc, msg, i) => {
    const prev = messages[i - 1]
    const hide = !!prev && prev.senderId === msg.senderId && msg.senderId !== (user.id ?? 0)
    acc.push({ ...msg, hideAvatar: hide })
    return acc
  }, [])

  // When in org context, show only that org's group chat + DMs with its members
  const filteredConvs = (() => {
    let list = conversations
    if (selectedOrgId) {
      const memberIds = new Set(selectedOrgMembers.map(m => m.id))
      list = list.filter(c =>
        (c.type === 'GROUP' && c.organizationId === selectedOrgId) ||
        (c.type === 'DM' && c.otherUserId != null && memberIds.has(c.otherUserId))
      )
    }
    return list.filter(c =>
      !search || (c.name ?? c.otherUserName ?? '').toLowerCase().includes(search.toLowerCase())
    )
  })()

  const openNewDm = () => {
    setMemberSearch('')
    setShowNewDm(true)
  }

  const startDm = async (targetId: number) => {
    setShowNewDm(false)
    try {
      const conv = await chatApi.getOrCreateDm(targetId)
      setConversations(prev => {
        const exists = prev.find(c => c.id === conv.id)
        return exists ? prev : [conv, ...prev]
      })
      openConversation(conv)
    } catch { /* ignore */ }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  const HEADER_ACTIONS = [
    { icon: 'Video', label: 'Appel vidéo' },
    { icon: 'Phone', label: 'Appel' },
    { icon: 'Search', label: 'Rechercher' },
  ] as const

  return (
    <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Conversations sidebar ── */}
      <div style={{ width: 300, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 15 }}>Messages</span>
              {totalUnread > 0 && (
                <span style={{ background: 'var(--ms-accent)', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>{totalUnread}</span>
              )}
            </div>
            <button onClick={openNewDm}
              style={{ width: 30, height: 30, borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--ms-accent-pale)'; e.currentTarget.style.borderColor = 'var(--ms-accent-border)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0' }}
              title="Nouveau message">
              <SIcon name="SquarePen" size={14} color="#64748b" />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 'var(--ms-radius-sm)', padding: '7px 11px', border: '1px solid #e2e8f0' }}>
            <SIcon name="Search" size={14} color="#94a3b8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', width: '100%' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, width: '70%' }} />
                    <div style={{ height: 10, background: '#f1f5f9', borderRadius: 4, width: '90%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredConvs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <SIcon name="MessageCircle" size={32} color="#cbd5e1" />
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
                {search ? 'Aucun résultat' : 'Aucune conversation'}
              </p>
            </div>
          )}

          {!loading && filteredConvs.map(conv => {
            const active = activeConv?.id === conv.id
            const displayName = conv.type === 'GROUP' ? conv.name : conv.otherUserName
            const color = avatarColor(displayName ?? '')
            const init = initials(displayName ?? '?')
            return (
              <div key={conv.id} onClick={() => openConversation(conv)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', cursor: 'pointer', transition: 'background 0.13s', background: active ? 'var(--ms-accent-pale)' : 'transparent', borderLeft: active ? '3px solid var(--ms-accent)' : '3px solid transparent' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: conv.type === 'GROUP' ? 'var(--ms-radius-sm)' : '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{init}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: conv.unreadCount ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0, marginLeft: 6 }}>{fmt(conv.lastMessageTime)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ color: conv.unreadCount ? '#334155' : '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: conv.unreadCount ? 500 : 400 }}>{conv.lastMessage ?? 'Démarrer la conversation'}</p>
                    {conv.unreadCount > 0 && (
                      <span style={{ background: 'var(--ms-accent)', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Message thread ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
        {activeConv ? (
          <>
            {/* Thread header */}
            <div style={{ height: 'var(--ms-topbar)', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
              {(() => {
                const name = activeConv.type === 'GROUP' ? activeConv.name : activeConv.otherUserName
                const color = avatarColor(name ?? '')
                return (
                  <>
                    <div style={{ width: 34, height: 34, borderRadius: activeConv.type === 'GROUP' ? 'var(--ms-radius-sm)' : '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(name ?? '?')}</div>
                    <div>
                      <p style={{ color: '#0f172a', fontWeight: 700, fontSize: 14 }}>{name}</p>
                      <p style={{ color: '#94a3b8', fontSize: 11 }}>{activeConv.type === 'GROUP' ? 'Groupe' : 'Message direct'}</p>
                    </div>
                  </>
                )
              })()}
              <div style={{ flex: 1 }} />
              {HEADER_ACTIONS.map(a => (
                <button key={a.icon} title={a.label}
                  style={{ width: 34, height: 34, borderRadius: 'var(--ms-radius-sm)', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.13s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--ms-accent-pale)'; e.currentTarget.style.borderColor = 'var(--ms-accent-border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0' }}>
                  <SIcon name={a.icon} size={15} color="#64748b" />
                </button>
              ))}
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {msgLoading && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chargement…</div>
              )}
              {!msgLoading && messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <SIcon name="MessageCircle" size={40} color="#cbd5e1" />
                  <p style={{ color: '#94a3b8', fontSize: 13 }}>Soyez le premier à écrire !</p>
                </div>
              )}
              {!msgLoading && grouped.map(msg => {
                const mine = msg.senderId === (user.id ?? -1)
                const color = avatarColor(msg.senderName)
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                    {!mine && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.hideAvatar ? 'transparent' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
                        {!msg.hideAvatar && initials(msg.senderName)}
                      </div>
                    )}
                    <div style={{ maxWidth: '65%' }}>
                      {!mine && !msg.hideAvatar && (
                        <p style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4, marginLeft: 2 }}>{msg.senderName}</p>
                      )}
                      <div style={{ padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: mine ? 'var(--ms-accent)' : '#fff', color: mine ? '#fff' : '#0f172a', fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: mine ? 'none' : '1px solid #e2e8f0' }}>{msg.content}</div>
                      <p style={{ color: '#94a3b8', fontSize: 10, marginTop: 3, textAlign: mine ? 'right' : 'left', marginLeft: 2, marginRight: 2 }}>{fmt(msg.sentAt)}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding: '14px 20px', background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: '#f8fafc', borderRadius: 'var(--ms-radius)', border: '1px solid #e2e8f0', padding: '8px 14px' }}>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                  placeholder={`Message à ${activeConv.type === 'GROUP' ? activeConv.name : activeConv.otherUserName}…`}
                  rows={1} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#0f172a', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }} />
                <button onClick={send} disabled={!input.trim()}
                  style={{ width: 34, height: 34, borderRadius: 'var(--ms-radius-sm)', border: 'none', background: input.trim() ? 'var(--ms-accent)' : '#e2e8f0', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  <SIcon name="Send" size={15} color={input.trim() ? '#fff' : '#94a3b8'} />
                </button>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6, textAlign: 'center' }}>Entrée pour envoyer · Maj+Entrée pour saut de ligne</p>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SIcon name="MessageCircle" size={28} color="#cbd5e1" />
            </div>
            <p style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>Sélectionnez une conversation</p>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>ou démarrez un nouveau message</p>
          </div>
        )}
      </div>

      {/* ── New DM modal ── */}
      {showNewDm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowNewDm(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 400, maxHeight: 480, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Nouveau message</span>
              <button onClick={() => setShowNewDm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <SIcon name="X" size={16} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #e2e8f0' }}>
                <SIcon name="Search" size={13} color="#94a3b8" />
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Rechercher un membre…"
                  autoFocus style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', width: '100%' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(selectedOrgId ? selectedOrgMembers : orgMembers).filter(m => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase())).map(m => (
                <div key={m.id} onClick={() => startDm(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(m.name)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.globalRole}</div>
                  </div>
                </div>
              ))}
              {(selectedOrgId ? selectedOrgMembers : orgMembers).filter(m => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aucun membre trouvé</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
