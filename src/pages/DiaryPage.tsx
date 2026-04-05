import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { SquarePen, Trash2, BookOpen } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiaryEntry {
  id: string
  title?: string
  content: string
  entryDate: string
  createdAt: string
  updatedAt: string
}

type SaveStatus = 'saved' | 'saving' | null

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 2 }}>
    <div
      className="skeleton"
      style={{ width: '60%', height: 13, borderRadius: 4 }}
    />
    <div
      className="skeleton"
      style={{ width: '40%', height: 11, borderRadius: 4, marginTop: 6, background: 'rgba(255,255,255,0.04)' }}
    />
  </div>
)

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    style={{ animation: 'spin 0.8s linear infinite', display: 'block', flexShrink: 0 }}
  >
    <circle
      cx="5"
      cy="5"
      r="3.5"
      fill="none"
      stroke="rgba(255,255,255,0.2)"
      strokeWidth="1.5"
      strokeDasharray="11 6"
    />
  </svg>
)

// ─── New button (header) ──────────────────────────────────────────────────────

const NewButton = ({ onClick }: { onClick: () => void }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        background: hovered ? 'rgba(124,106,247,0.08)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? '#7c6af7' : 'rgba(255,255,255,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      <SquarePen size={15} />
    </button>
  )
}

// ─── Trash button ─────────────────────────────────────────────────────────────

const TrashButton = ({ onDelete }: { onDelete: (e: React.MouseEvent) => void }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onDelete}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        right: 8,
        top: 10,
        background: 'none',
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        color: hovered ? '#f87171' : 'rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        transition: 'color 0.15s',
      }}
    >
      <Trash2 size={13} />
    </button>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

const EntryCard = ({
  entry,
  isActive,
  isHovered,
  onSelect,
  onDelete,
  onMouseEnter,
  onMouseLeave,
}: {
  entry: DiaryEntry
  isActive: boolean
  isHovered: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) => {
  const preview = entry.content?.split('\n')[0] ?? ''

  return (
    <div
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        marginBottom: 2,
        cursor: 'pointer',
        transition: 'background 0.15s',
        position: 'relative',
        background: isActive
          ? 'rgba(255,255,255,0.07)'
          : isHovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.65)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            maxWidth: 'calc(100% - 28px)',
            display: 'block',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          {entry.title || 'Жазба'}
        </span>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          {format(new Date(entry.entryDate), 'd MMM')}
        </span>
        {preview && (
          <>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.25)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                maxWidth: 140,
              }}
            >
              {preview}
            </span>
          </>
        )}
      </div>

      {/* Trash — visible only on card hover */}
      {isHovered && <TrashButton onDelete={onDelete} />}
    </div>
  )
}

// ─── Empty state (editor) ─────────────────────────────────────────────────────

const EditorEmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SquarePen size={36} color="rgba(255,255,255,0.07)" style={{ marginBottom: 14 }} />
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
        Жазба таңдаңыз
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.15)', marginTop: 4, marginBottom: 0 }}>
        немесе жаңасын жасаңыз
      </p>
      <button
        onClick={onCreate}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          marginTop: 20,
          border: '1px solid rgba(124,106,247,0.2)',
          background: hovered ? 'rgba(124,106,247,0.1)' : 'rgba(124,106,247,0.05)',
          borderRadius: 10,
          padding: '9px 20px',
          color: '#7c6af7',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}
      >
        <SquarePen size={14} />
        Жаңа жазба
      </button>
    </div>
  )
}

// ─── Empty state (list) ───────────────────────────────────────────────────────

const ListEmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ paddingTop: 60, textAlign: 'center' }}>
      <BookOpen size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0 }}>Жазба жоқ</p>
      <button
        onClick={onCreate}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          marginTop: 14,
          border: `1px solid ${hovered ? 'rgba(124,106,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
          background: 'transparent',
          borderRadius: 8,
          padding: '7px 16px',
          color: hovered ? '#7c6af7' : 'rgba(255,255,255,0.4)',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
      >
        Жаңа жазба
      </button>
    </div>
  )
}

// ─── DiaryPage ────────────────────────────────────────────────────────────────

const DiaryPage = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [titleText, setTitleText] = useState('')
  const [contentText, setContentText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const [isNew, setIsNew] = useState(false)
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    api
      .get<DiaryEntry[]>('/api/diary')
      .then((res) => setEntries(res.data))
      .catch(() => toast.error('Жүктеу қатесі'))
      .finally(() => setIsLoading(false))
  }, [])

  // ── Auto-resize textarea ──────────────────────────────────────────────────

  const autoResize = () => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    autoResize()
  }, [contentText])

  // ── Save logic ────────────────────────────────────────────────────────────

  const doSave = useCallback(
    async (
      title: string,
      content: string,
      currentSelectedId: string | null,
      currentIsNew: boolean,
      entryDate?: string,
    ) => {
      if (!currentSelectedId) return

      const trimmedTitle = title.trim() || undefined
      const trimmedContent = content.trim()

      if (!trimmedTitle && !trimmedContent) {
        setSaveStatus(null)
        return
      }

      const finalContent = trimmedContent || trimmedTitle || ''
      const finalTitle = trimmedContent ? trimmedTitle : undefined

      try {
        if (currentIsNew) {
          const res = await api.post<DiaryEntry>('/diary', {
            title: finalTitle,
            content: finalContent,
            entryDate: format(new Date(), 'yyyy-MM-dd'),
          })
          setEntries((prev) => [res.data, ...prev])
          setSelectedId(res.data.id)
          setIsNew(false)
        } else {
          const res = await api.put<DiaryEntry>(`/diary/${currentSelectedId}`, {
            title: finalTitle,
            content: finalContent,
            entryDate: entryDate ?? format(new Date(), 'yyyy-MM-dd'),
          })
          setEntries((prev) => prev.map((e) => (e.id === currentSelectedId ? res.data : e)))
        }
        setSaveStatus('saved')
      } catch {
        setSaveStatus(null)
      }
    },
    [],
  )

  // ── Autosave debounce ─────────────────────────────────────────────────────

  useEffect(() => {
    if (selectedId === null) return

    clearTimeout(saveTimer.current)
    setSaveStatus('saving')

    const capturedId = selectedId
    const capturedIsNew = isNew
    const capturedEntryDate = selectedEntry?.entryDate

    saveTimer.current = setTimeout(() => {
      doSave(titleText, contentText, capturedId, capturedIsNew, capturedEntryDate)
    }, 3000)

    return () => clearTimeout(saveTimer.current)
  }, [titleText, contentText, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateNew = () => {
    clearTimeout(saveTimer.current)
    setSelectedId('__new__')
    setIsNew(true)
    setTitleText('')
    setContentText('')
    setSaveStatus(null)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const handleSelect = (entry: DiaryEntry) => {
    clearTimeout(saveTimer.current)
    setSelectedId(entry.id)
    setIsNew(false)
    setTitleText(entry.title ?? '')
    setContentText(entry.content)
    setSaveStatus('saved')
    setTimeout(() => contentRef.current?.focus(), 50)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Жазбаны жою?')) return
    try {
      await api.delete(`/diary/${id}`)
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        setTitleText('')
        setContentText('')
        setIsNew(false)
        setSaveStatus(null)
      }
      toast.success('Жазба жойылды')
    } catch {
      toast.error('Жою қатесі')
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      contentRef.current?.focus()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const editorDate = selectedEntry?.entryDate ? new Date(selectedEntry.entryDate) : new Date()

  return (
    <Layout>
      {/* Escape Layout padding */}
      <div style={{ margin: '-32px -40px', display: 'flex', height: '100vh' }}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div
          style={{
            width: 280,
            minWidth: 280,
            maxWidth: 280,
            flexShrink: 0,
            background: '#0d0d0d',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 16px 12px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.88)',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Күнделік
            </span>
            <NewButton onClick={handleCreateNew} />
          </div>

          {/* List */}
          <div
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '4px 8px 16px 16px',
              width: '100%',
              boxSizing: 'border-box',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            } as React.CSSProperties}
          >
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                {/* Unsaved new entry card */}
                {isNew && selectedId === '__new__' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      marginBottom: 2,
                      background: 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'rgba(255,255,255,0.88)',
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    >
                      Жаңа жазба
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                      {format(new Date(), 'd MMM')}
                    </div>
                  </div>
                )}

                {entries.length === 0 && !isNew ? (
                  <ListEmptyState onCreate={handleCreateNew} />
                ) : (
                  entries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      isActive={selectedId === entry.id}
                      isHovered={hoveredCardId === entry.id}
                      onSelect={() => handleSelect(entry)}
                      onDelete={(e) => handleDelete(entry.id, e)}
                      onMouseEnter={() => setHoveredCardId(entry.id)}
                      onMouseLeave={() => setHoveredCardId(null)}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right panel (editor) ────────────────────────────────────────── */}
        <div
          style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0a',
            overflowY: 'auto',
          }}
        >
          {selectedId === null ? (
            <EditorEmptyState onCreate={handleCreateNew} />
          ) : (
            <>
              {/* Status bar */}
              <div
                style={{
                  padding: '12px 40px 0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                  minHeight: 32,
                  alignItems: 'center',
                }}
              >
                {saveStatus === 'saving' && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Spinner />
                    Сақталуда
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                    Сақталды ✓
                  </span>
                )}
              </div>

              {/* Title input */}
              <input
                ref={titleRef}
                type="text"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                placeholder="Тақырып..."
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: 700,
                  margin: '0 auto',
                  padding: '28px 40px 10px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 28,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.92)',
                  fontFamily: 'Manrope, sans-serif',
                  caretColor: '#7c6af7',
                  boxSizing: 'border-box',
                } as React.CSSProperties}
              />

              {/* Thin divider */}
              <div
                style={{
                  maxWidth: 700,
                  margin: '0 auto',
                  padding: '0 40px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
              </div>

              {/* Metadata */}
              <div
                style={{
                  maxWidth: 700,
                  margin: '0 auto',
                  padding: '8px 40px 0',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {format(editorDate, 'd MMMM yyyy, EEEE')}
                </span>
              </div>

              {/* Content textarea */}
              <textarea
                ref={contentRef}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                onInput={autoResize}
                placeholder="Жазыңыз..."
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: 700,
                  margin: '0 auto',
                  padding: '16px 40px 80px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  lineHeight: 1.85,
                  color: 'rgba(255,255,255,0.78)',
                  caretColor: '#7c6af7',
                  minHeight: 400,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                } as React.CSSProperties}
              />
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default DiaryPage
