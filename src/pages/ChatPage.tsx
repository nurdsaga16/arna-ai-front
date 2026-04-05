import React, { forwardRef, useState, useRef, useEffect } from 'react'
import {
  Bot, Heart, SendHorizonal, Sparkles, Copy, RotateCcw, Check,
  PanelLeftClose, PanelLeftOpen, PencilLine, MessageSquare,
} from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import api from '../lib/api'

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  chatType: string
}

interface SessionItem {
  sessionId: string
  preview: string
  timestamp: string
  chatType: string
}

interface GroupedSessions {
  today: SessionItem[]
  yesterday: SessionItem[]
  older: SessionItem[]
}

type ChatType = 'planner' | 'mental'

// ─── Styles ────────────────────────────────────────────────────────────────────

const Styles = () => (
  <style>{`
    @keyframes messageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes typingDot {
      0%, 60%, 100% { transform: translateY(0);    opacity: 0.3; }
      30%            { transform: translateY(-4px); opacity: 1;   }
    }
    .msg-anim { animation: messageIn 220ms ease-out both; }

    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(226,226,230,0.28);
      padding: 5px 6px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    .action-btn:hover {
      color: rgba(226,226,230,0.75);
      background: rgba(255,255,255,0.05);
    }

    .chat-scroll::-webkit-scrollbar { width: 3px; }
    .chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .chat-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.07);
      border-radius: 99px;
    }

    .sidebar-scroll::-webkit-scrollbar { width: 3px; }
    .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .sidebar-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.08);
      border-radius: 2px;
    }

    .send-btn-active:hover { opacity: 0.82; transform: scale(1.05); }
    .send-btn-active { transition: opacity 0.15s, transform 0.15s; }

    .input-pill { transition: border-color 0.18s; }
    .input-pill:focus-within { border-color: rgba(199,191,255,0.38) !important; }

    textarea::placeholder { color: rgba(226,226,230,0.28); }
    textarea:focus { outline: none; }

    .msg-time {
      font-size: 10px;
      color: rgba(226,226,230,0.22);
      letter-spacing: 0.03em;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .msg-row:hover .msg-time { opacity: 1; }

    .toggle-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: rgba(229,226,225,0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .toggle-btn:hover {
      color: #e5e2e1;
      background: rgba(255,255,255,0.07);
    }

    .sidebar-tab {
      flex: 1;
      padding: 6px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: all 0.15s;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }

    .session-row {
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .session-row:hover { background: rgba(255,255,255,0.04) !important; }

    .pencil-btn {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: rgba(229,226,225,0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .pencil-btn:hover { color: #c7bfff; background: rgba(199,191,255,0.1); }
  `}</style>
)

// ─── Date helpers ──────────────────────────────────────────────────────────────

const groupSessionsByDate = (sessions: SessionItem[]): GroupedSessions => ({
  today:     sessions.filter(s => isToday(new Date(s.timestamp))),
  yesterday: sessions.filter(s => isYesterday(new Date(s.timestamp))),
  older:     sessions.filter(s => !isToday(new Date(s.timestamp)) && !isYesterday(new Date(s.timestamp))),
})

// ─── Page ─────────────────────────────────────────────────────────────────────

const ChatPage = () => {
  const [sidebarOpen,          setSidebarOpen]          = useState(true)
  const [activeChatType,       setActiveChatType]       = useState<ChatType>('planner')
  const [plannerMessages,      setPlannerMessages]      = useState<Message[]>([])
  const [mentalMessages,       setMentalMessages]       = useState<Message[]>([])
  const [plannerSessions,      setPlannerSessions]      = useState<SessionItem[]>([])
  const [mentalSessions,       setMentalSessions]       = useState<SessionItem[]>([])
  const [activePlannerSession, setActivePlannerSession] = useState<string | null>(null)
  const [activeMentalSession,  setActiveMentalSession]  = useState<string | null>(null)
  const [currentSessionId,     setCurrentSessionId]     = useState<string>(() => crypto.randomUUID())
  const [inputValue,           setInputValue]           = useState('')
  const [isLoading,            setIsLoading]            = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  const messages    = activeChatType === 'planner' ? plannerMessages : mentalMessages
  const setMessages = activeChatType === 'planner' ? setPlannerMessages : setMentalMessages

  const activeSessionId = activeChatType === 'planner' ? activePlannerSession : activeMentalSession
  const currentSessions = activeChatType === 'planner' ? plannerSessions : mentalSessions
  const grouped         = groupSessionsByDate(currentSessions)

  // Override main-content scroll/padding so ChatPage fully owns the layout
  useEffect(() => {
    const el = document.querySelector('.main-content') as HTMLElement | null
    if (!el) return
    const prev = {
      overflowY: el.style.overflowY,
      padding:   el.style.padding,
      display:   el.style.display,
      flexDir:   el.style.flexDirection,
      height:    el.style.height,
    }
    el.style.overflowY      = 'hidden'
    el.style.padding        = '0'
    el.style.display        = 'flex'
    el.style.flexDirection  = 'column'
    el.style.height         = '100%'
    return () => {
      el.style.overflowY     = prev.overflowY
      el.style.padding       = prev.padding
      el.style.display       = prev.display
      el.style.flexDirection = prev.flexDir
      el.style.height        = prev.height
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [plannerMessages, mentalMessages, isLoading])

  // ─── Sessions ────────────────────────────────────────────────────────────────

  const loadSessions = async (chatType: ChatType) => {
    try {
      const res = await api.get<SessionItem[]>(`/api/chat/sessions?chatType=${chatType}`)
      if (chatType === 'planner') {
        setPlannerSessions(res.data)
      } else {
        setMentalSessions(res.data)
      }
    } catch {
      console.log('No sessions available')
    }
  }

  useEffect(() => {
    loadSessions('planner')
    loadSessions('mental')
  }, [])

  const loadSessionHistory = async (sessionId: string, chatType: ChatType) => {
    try {
      const res = await api.get<ChatHistoryItem[]>(`/api/chat/history?sessionId=${sessionId}`)
      const msgs: Message[] = res.data.map((item, index) => ({
        id: `history_${index}_${item.timestamp}`,
        role: item.role,
        content: item.content,
        createdAt: new Date(item.timestamp),
      }))
      if (chatType === 'planner') {
        setPlannerMessages(msgs)
        setActivePlannerSession(sessionId)
      } else {
        setMentalMessages(msgs)
        setActiveMentalSession(sessionId)
      }
    } catch {
      console.log('Failed to load session history')
    }
  }

  const handleNewChat = () => {
    const newSessionId = crypto.randomUUID()
    setCurrentSessionId(newSessionId)
    if (activeChatType === 'planner') {
      setPlannerMessages([])
      setActivePlannerSession(null)
    } else {
      setMentalMessages([])
      setActiveMentalSession(null)
    }
    setInputValue('')
  }

  // ─── Chat ────────────────────────────────────────────────────────────────────

  const handleSwitchChat = (type: ChatType) => {
    setActiveChatType(type)
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const sendMessage = async (text: string, targetChatType: ChatType, sessionId: string) => {
    const endpoint = targetChatType === 'planner' ? '/api/chat/planner' : '/api/chat/mental'
    const res = await api.post<{ content: string; chatType: string; createdAt: string }>(
      endpoint, { message: text, chatType: targetChatType, sessionId }
    )
    return res.data.content
  }

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const sessionIdToUse = activeSessionId || currentSessionId

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setIsLoading(true)
    try {
      const content = await sendMessage(text, activeChatType, sessionIdToUse)
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_ai',
        role: 'assistant',
        content,
        createdAt: new Date(),
      }])
      loadSessions(activeChatType)
    } catch {
      toast.error('Жауап алуда қате болды')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = async (aiMsgId: string) => {
    if (isLoading) return
    const currentMsgs = activeChatType === 'planner' ? plannerMessages : mentalMessages
    const aiIdx = currentMsgs.findIndex(m => m.id === aiMsgId)
    if (aiIdx === -1) return

    const userMsg = [...currentMsgs].slice(0, aiIdx).reverse().find(m => m.role === 'user')
    if (!userMsg) return

    setMessages(prev => prev.slice(0, aiIdx))
    setIsLoading(true)
    try {
      const content = await sendMessage(userMsg.content, activeChatType, activeSessionId || currentSessionId)
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_ai',
        role: 'assistant',
        content,
        createdAt: new Date(),
      }])
    } catch {
      toast.error('Жауап алуда қате болды')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  const handleChipClick = (text: string) => {
    setInputValue(text)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const showEmpty = messages.length === 0 && !isLoading

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <Styles />
      <div style={{
        height: '100%',
        background: '#0f0f0f',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>

        {/* ── Collapsible Sidebar ─────────────────────────────────────────── */}
        <aside style={{
          width: sidebarOpen ? 260 : 0,
          opacity: sidebarOpen ? 1 : 0,
          overflow: 'hidden',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          transition: 'width 0.25s ease, opacity 0.2s ease',
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}>

          {/* Inner container — fixed width so content doesn't collapse */}
          <div style={{
            width: 260,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>

            {/* 1. Sidebar header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '12px 10px 6px',
              flexShrink: 0,
            }}>
              <button
                className="pencil-btn"
                title="Жаңа чат"
                onClick={handleNewChat}
              >
                <PencilLine size={16} />
              </button>
            </div>

            {/* 2. Mode tabs */}
            <div style={{ padding: '0 12px', marginBottom: 8, flexShrink: 0 }}>
              <div style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}>
                {(['planner', 'mental'] as ChatType[]).map(type => {
                  const active   = activeChatType === type
                  const isPlanner = type === 'planner'
                  return (
                    <button
                      key={type}
                      className="sidebar-tab"
                      onClick={() => handleSwitchChat(type)}
                      style={{
                        background: active
                          ? isPlanner
                            ? 'rgba(199,191,255,0.15)'
                            : 'rgba(77,224,130,0.12)'
                          : 'transparent',
                        color: active
                          ? isPlanner ? '#c7bfff' : '#4de082'
                          : 'rgba(229,226,225,0.35)',
                      }}
                    >
                      {isPlanner
                        ? <Bot size={12} />
                        : <Heart size={12} />}
                      {isPlanner ? 'Жоспар' : 'Демеу'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. Recents */}
            <div
              className="sidebar-scroll"
              style={{ flexGrow: 1, overflowY: 'auto', padding: '0 8px' }}
            >
              {currentSessions.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '24px 12px',
                }}>
                  <MessageSquare size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 8 }} />
                  <span style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.3)',
                    textAlign: 'center',
                  }}>
                    Сөйлесулер жоқ
                  </span>
                </div>
              ) : (
                <>
                  {(
                    [
                      { key: 'today',     label: 'Бүгін',  items: grouped.today     },
                      { key: 'yesterday', label: 'Кеше',   items: grouped.yesterday },
                      { key: 'older',     label: 'Бұрын',  items: grouped.older     },
                    ] as { key: string; label: string; items: SessionItem[] }[]
                  ).map(({ key, label, items }) =>
                    items.length === 0 ? null : (
                      <div key={key}>
                        <div style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.25)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          padding: '4px 4px 6px',
                          marginTop: 8,
                        }}>
                          {label}
                        </div>
                        {items.map(session => {
                          const isActive = session.sessionId === activeSessionId
                          return (
                            <div
                              key={session.sessionId}
                              className="session-row"
                              onClick={() => loadSessionHistory(session.sessionId, activeChatType)}
                              style={{
                                background: isActive
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'transparent',
                              }}
                            >
                              <div style={{
                                fontSize: 13,
                                color: 'rgba(229,226,225,0.85)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                                fontWeight: 400,
                              }}>
                                {session.preview}
                              </div>
                              <div style={{
                                fontSize: 11,
                                color: 'rgba(229,226,225,0.3)',
                                marginTop: 2,
                              }}>
                                {(() => {
                                  try { return format(new Date(session.timestamp), 'HH:mm') }
                                  catch { return '' }
                                })()}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </aside>

        {/* ── Chat area ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Header */}
          <header style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px',
            background: 'rgba(15,15,15,0.92)',
            backdropFilter: 'blur(14px)',
            position: 'sticky',
            top: 0,
            zIndex: 20,
            flexShrink: 0,
          }}>
            <button
              className="toggle-btn"
              onClick={() => setSidebarOpen(prev => !prev)}
              title={sidebarOpen ? 'Жабу' : 'Ашу'}
            >
              {sidebarOpen
                ? <PanelLeftClose size={18} />
                : <PanelLeftOpen size={18} />}
            </button>

            <span style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#e2e2e6',
              letterSpacing: '-0.02em',
            }}>
              Chat
            </span>

            <span style={{
              fontSize: 11,
              color: activeChatType === 'planner' ? 'rgba(199,191,255,0.55)' : 'rgba(77,224,130,0.55)',
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {activeChatType === 'planner' ? 'Жоспарлаушы' : 'Демеуші'}
            </span>
          </header>

          {/* Messages */}
          <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div
              className="chat-scroll"
              style={{ flexGrow: 1, overflowY: 'auto', padding: '32px 36px 0' }}
            >
              <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
                {showEmpty ? (
                  <EmptyState
                    chatType={activeChatType}
                    onChipClick={handleChipClick}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {messages.map(msg => (
                      <MessageRow
                        key={msg.id}
                        message={msg}
                        chatType={activeChatType}
                        onRegenerate={() => handleRegenerate(msg.id)}
                      />
                    ))}
                    {isLoading && <TypingIndicator chatType={activeChatType} />}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Input */}
            <div style={{ padding: '0 36px 24px', background: '#0f0f0f', flexShrink: 0 }}>
              <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
                <InputPanel
                  ref={textareaRef}
                  value={inputValue}
                  chatType={activeChatType}
                  isLoading={isLoading}
                  onChange={setInputValue}
                  onKeyDown={handleKeyDown}
                  onInput={handleInput}
                  onSend={handleSend}
                />
                <p style={{
                  textAlign: 'center',
                  fontSize: 10,
                  color: 'rgba(226,226,230,0.16)',
                  marginTop: 8,
                  letterSpacing: '0.04em',
                }}>
                  Enter — жіберу · Shift+Enter — жол алмастыру
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  )
}

// ─── Message Row ───────────────────────────────────────────────────────────────

const MessageRow = ({
  message,
  chatType,
  onRegenerate,
}: {
  message: Message
  chatType: ChatType
  onRegenerate: () => void
}) => {
  const isUser    = message.role === 'user'
  const isPlanner = chatType === 'planner'
  const accent    = isPlanner ? '#c7bfff' : '#4de082'
  const timeStr   = (() => { try { return format(message.createdAt, 'HH:mm') } catch { return '' } })()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Көшіру сәтсіз болды')
    }
  }

  if (isUser) {
    return (
      <div className="msg-row msg-anim" style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        gap: 8,
      }}>
        <span className="msg-time">{timeStr}</span>
        <div style={{
          maxWidth: '62%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '18px 18px 4px 18px',
          padding: '12px 18px',
          fontSize: 15,
          lineHeight: 1.65,
          color: '#e2e2e6',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="msg-row msg-anim" style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: isPlanner
          ? 'linear-gradient(135deg, rgba(199,191,255,0.22), rgba(142,127,255,0.12))'
          : 'linear-gradient(135deg, rgba(77,224,130,0.2), rgba(77,224,130,0.07))',
        border: isPlanner
          ? '1px solid rgba(199,191,255,0.18)'
          : '1px solid rgba(77,224,130,0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        {isPlanner
          ? <Sparkles size={12} color="#c7bfff" />
          : <Heart size={12} color="#4de082" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: accent,
          marginBottom: 7,
          opacity: 0.7,
        }}>
          {isPlanner ? 'Жоспарлаушы' : 'Демеуші'}
        </div>

        <div style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'rgba(226,226,230,0.87)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          <RenderedContent content={message.content} accent={accent} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 10 }}>
          <button
            className="action-btn"
            title={copied ? 'Көшірілді!' : 'Көшіру'}
            onClick={handleCopy}
            style={{ color: copied ? accent : undefined }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button className="action-btn" title="Қайта жасау" onClick={onRegenerate}>
            <RotateCcw size={13} />
          </button>
          <span className="msg-time" style={{ marginLeft: 6, opacity: 1 }}>{timeStr}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Content renderer ──────────────────────────────────────────────────────────

const RenderedContent = ({ content, accent }: { content: string; accent: string }) => {
  const lines = content.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('> ') || line.startsWith('>')) {
          const text = line.replace(/^>\s?/, '')
          return (
            <div key={i} style={{
              borderLeft: `3px solid ${accent}`,
              paddingLeft: 14,
              margin: '10px 0',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 14,
              color: '#e2e2e6',
              opacity: 0.88,
            }}>
              {text}
            </div>
          )
        }
        return (
          <React.Fragment key={i}>
            {line}
            {i < lines.length - 1 && '\n'}
          </React.Fragment>
        )
      })}
    </>
  )
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────

const TypingIndicator = ({ chatType }: { chatType: ChatType }) => {
  const isPlanner = chatType === 'planner'
  const accent    = isPlanner ? '#c7bfff' : '#4de082'
  return (
    <div className="msg-anim" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: isPlanner
          ? 'linear-gradient(135deg, rgba(199,191,255,0.22), rgba(142,127,255,0.12))'
          : 'linear-gradient(135deg, rgba(77,224,130,0.2), rgba(77,224,130,0.07))',
        border: isPlanner
          ? '1px solid rgba(199,191,255,0.18)'
          : '1px solid rgba(77,224,130,0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        {isPlanner ? <Sparkles size={12} color="#c7bfff" /> : <Heart size={12} color="#4de082" />}
      </div>
      <div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: accent,
          marginBottom: 10,
          opacity: 0.7,
        }}>
          {isPlanner ? 'Жоспарлаушы' : 'Демеуші'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {[0, 0.16, 0.32].map((delay, i) => (
            <span key={i} style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: accent,
              display: 'inline-block',
              opacity: 0.4,
              animation: 'typingDot 1.1s ease-in-out infinite',
              animationDelay: `${delay}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState = ({
  chatType, onChipClick,
}: {
  chatType: ChatType
  onChipClick: (t: string) => void
}) => {
  const isPlanner = chatType === 'planner'
  const accent    = isPlanner ? '#c7bfff' : '#4de082'
  const chips = isPlanner
    ? ['Бүгінгі жоспарымды жаса', 'Мақсаттарымды талда', 'Апталық жоспар']
    : ['Бүгін өзімді жаман сезінемін', 'Стресс басып тұр', 'Сөйлескім келеді']

  return (
    <div style={{
      minHeight: 'calc(100vh - 260px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 48,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: isPlanner ? 'rgba(199,191,255,0.07)' : 'rgba(77,224,130,0.06)',
        border: isPlanner ? '1px solid rgba(199,191,255,0.13)' : '1px solid rgba(77,224,130,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
      }}>
        {isPlanner ? <Bot size={24} color="#c7bfff" /> : <Heart size={24} color="#4de082" />}
      </div>

      <h2 style={{
        fontSize: 20,
        fontWeight: 700,
        color: '#e2e2e6',
        margin: '0 0 8px',
        letterSpacing: '-0.02em',
        textAlign: 'center',
      }}>
        {isPlanner ? 'Сәлем! Мен Жоспарлаушы' : 'Сәлем! Мен Демеуші'}
      </h2>

      <p style={{
        fontSize: 13,
        color: 'rgba(226,226,230,0.36)',
        margin: '0 0 24px',
        textAlign: 'center',
        maxWidth: 360,
        lineHeight: 1.65,
      }}>
        {isPlanner
          ? 'Мақсаттарыңа жету жолында бірге жоспар жасайық'
          : 'Не сезіп тұрсыз? Маған айтыңыз, мен тыңдаймын'}
      </p>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
        {chips.map(chip => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 999,
              padding: '7px 15px',
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(226,226,230,0.42)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = isPlanner ? 'rgba(199,191,255,0.32)' : 'rgba(77,224,130,0.28)'
              el.style.color = accent
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = 'rgba(255,255,255,0.07)'
              el.style.color = 'rgba(226,226,230,0.42)'
            }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Input Panel ───────────────────────────────────────────────────────────────

const InputPanel = forwardRef<HTMLTextAreaElement, {
  value: string
  chatType: ChatType
  isLoading: boolean
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onInput: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void
  onSend: () => void
}>(({ value, chatType, isLoading, onChange, onKeyDown, onInput, onSend }, ref) => {
  const isPlanner = chatType === 'planner'
  const hasText   = value.trim().length > 0
  const active    = hasText && !isLoading

  return (
    <div
      className="input-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 999,
        padding: '11px 12px 11px 20px',
      }}
    >
      <textarea
        ref={ref}
        value={value}
        placeholder={isPlanner ? 'Жоспарлаушыға сұрақ қойыңыз…' : 'Не сезіп тұрсыз?'}
        rows={1}
        disabled={isLoading}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onInput={onInput}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: '#e2e2e6',
          fontSize: 14,
          fontFamily: 'inherit',
          resize: 'none',
          lineHeight: 1.55,
          minHeight: 22,
          maxHeight: 140,
          overflowY: 'auto',
        }}
      />
      <button
        className={active ? 'send-btn-active' : ''}
        onClick={onSend}
        disabled={!active}
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: 'none',
          background: active
            ? (isPlanner ? '#c7bfff' : '#4de082')
            : 'rgba(255,255,255,0.07)',
          color: active ? '#0f0f0f' : 'rgba(226,226,230,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: active ? 'pointer' : 'not-allowed',
          flexShrink: 0,
          transition: 'background 0.18s, color 0.18s',
        }}
      >
        <SendHorizonal size={14} />
      </button>
    </div>
  )
})
InputPanel.displayName = 'InputPanel'

export default ChatPage
