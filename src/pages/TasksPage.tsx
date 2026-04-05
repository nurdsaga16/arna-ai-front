import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import {
  Plus, Check, Edit2, Trash2, CalendarDays, Target,
  ListTodo, CheckCircle2, CheckSquare, X, Sparkles,
} from 'lucide-react'
import Layout from '../components/Layout'
import api from '../lib/api'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TaskResponse {
  id: string
  title: string
  isDone: boolean
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  scheduledDate: string
  completedAt?: string
  createdAt: string
  goalId?: string
  goalTitle?: string
}

interface GoalOption {
  id: string
  title: string
}

interface PlannerResponse {
  content: string
  chatType: string
  createdAt: string
  generatedTasks: TaskResponse[]
}

type FilterKey = 'ALL' | 'TODAY' | 'ACTIVE' | 'DONE'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',    label: 'Барлығы' },
  { key: 'TODAY',  label: 'Бүгін' },
  { key: 'ACTIVE', label: 'Белсенді' },
  { key: 'DONE',   label: 'Орындалған' },
]

const PRIORITY_STYLES: Record<TaskResponse['priority'], {
  background: string; color: string; accent: string; border: string; label: string; order: number
}> = {
  HIGH:   { background: 'rgba(248,113,113,0.1)',  color: 'rgba(248,113,113,0.85)', accent: '#f87171', border: 'rgba(248,113,113,0.2)',  label: 'Жоғары', order: 1 },
  MEDIUM: { background: 'rgba(251,191,36,0.1)',   color: 'rgba(251,191,36,0.85)',  accent: '#fbbf24', border: 'rgba(251,191,36,0.2)',   label: 'Орта',   order: 2 },
  LOW:    { background: 'rgba(74,222,128,0.08)',  color: 'rgba(74,222,128,0.75)',  accent: '#4ade80', border: 'rgba(74,222,128,0.18)',  label: 'Төмен',  order: 3 },
}

const PRIORITY_ORDER: Record<TaskResponse['priority'], number> = { HIGH: 1, MEDIUM: 2, LOW: 3 }

// Group tasks by scheduledDate, sorted: today → yesterday → older desc → no date
function groupByDay(tasks: TaskResponse[]): { label: string; date: string | null; tasks: TaskResponse[] }[] {
  const groups: Record<string, TaskResponse[]> = {}
  tasks.forEach(t => {
    const key = t.scheduledDate ?? '__none__'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })

  Object.values(groups).forEach(g => g.sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  }))

  const dateKeys = Object.keys(groups).filter(k => k !== '__none__')
  dateKeys.sort((a, b) => b.localeCompare(a))

  const result: { label: string; date: string | null; tasks: TaskResponse[] }[] = []

  dateKeys.forEach(key => {
    const d = parseISO(key)
    let label: string
    if (isToday(d))          label = 'Бүгін'
    else if (isYesterday(d)) label = 'Кеше'
    else                     label = format(d, 'd MMMM')
    result.push({ label, date: key, tasks: groups[key] })
  })

  if (groups['__none__']) {
    result.push({ label: 'Күні белгісіз', date: null, tasks: groups['__none__'] })
  }

  return result
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title:         z.string().min(1, 'Атауы міндетті'),
  priority:      z.enum(['LOW', 'MEDIUM', 'HIGH']),
  scheduledDate: z.string().optional(),
  goalId:        z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── TasksPage ────────────────────────────────────────────────────────────────

const TasksPage = () => {
  const [tasks,        setTasks]        = useState<TaskResponse[]>([])
  const [goals,        setGoals]        = useState<GoalOption[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL')
  const [isModalOpen,  setIsModalOpen]  = useState(false)
  const [editingTask,  setEditingTask]  = useState<TaskResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAiLoading,  setIsAiLoading]  = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get<TaskResponse[]>('/api/tasks'),
      api.get<GoalOption[]>('/api/goals?status=ACTIVE'),
    ])
      .then(([tasksRes, goalsRes]) => {
        setTasks(tasksRes.data)
        setGoals(goalsRes.data)
      })
      .catch(() => toast.error('Жүктеу қатесі'))
      .finally(() => setIsLoading(false))
  }, [])

  // ── Filter ────────────────────────────────────────────────────────────────

  const filteredTasks: TaskResponse[] = (() => {
    switch (activeFilter) {
      case 'TODAY':  return tasks.filter(t => t.scheduledDate === today)
      case 'ACTIVE': return tasks.filter(t => !t.isDone)
      case 'DONE':   return tasks.filter(t => t.isDone)
      default:       return tasks
    }
  })()

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => { setEditingTask(null); setIsModalOpen(true) }
  const openEdit   = (task: TaskResponse) => { setEditingTask(task); setIsModalOpen(true) }
  const closeModal = () => { setIsModalOpen(false); setEditingTask(null) }

  const handleDone = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: true } : t))
    try {
      const res = await api.patch<TaskResponse>(`/tasks/${id}/done`)
      if (res.data?.id) {
        setTasks(prev => prev.map(t => t.id === id ? res.data : t))
      }
    } catch (error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: false } : t))
      toast.error('Қате болды')
      console.error('Done task error:', error)
    }
  }

  const handleUndone = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: false } : t))
    try {
      const res = await api.patch<TaskResponse>(`/tasks/${id}/undone`)
      if (res.data?.id) {
        setTasks(prev => prev.map(t => t.id === id ? res.data : t))
      }
    } catch (error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: true } : t))
      toast.error('Қате болды')
      console.error('Undone task error:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Тапсырманы жою?')) return
    try {
      await api.delete(`/tasks/${id}`)
      setTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Тапсырма жойылды')
    } catch {
      toast.error('Жоюда қате болды')
    }
  }

  const handleSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    try {
      const body = {
        title:         data.title,
        priority:      data.priority,
        scheduledDate: data.scheduledDate || undefined,
        goalId:        data.goalId || undefined,
      }
      if (editingTask) {
        const res = await api.put<TaskResponse>(`/tasks/${editingTask.id}`, body)
        setTasks(prev => prev.map(t => t.id === editingTask.id ? res.data : t))
        toast.success('Тапсырма жаңартылды')
      } else {
        const res = await api.post<TaskResponse>('/tasks', body)
        setTasks(prev => [res.data, ...prev])
        toast.success('Тапсырма қосылды')
      }
      closeModal()
    } catch {
      toast.error('Қате болды')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateAIPlan = async () => {
    setIsAiLoading(true)
    try {
      const res = await api.post<PlannerResponse>('/chat/planner')
      if (res.data.generatedTasks && res.data.generatedTasks.length > 0) {
        setTasks(prev => [...res.data.generatedTasks, ...prev])
        toast.success(`AI ${res.data.generatedTasks.length} тапсырма қосты`)
      }
    } catch {
      toast.error('AI жоспар жасауда қате болды')
    } finally {
      setIsAiLoading(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const todayCount = tasks.filter(t => t.scheduledDate === today).length
  const doneCount  = tasks.filter(t => t.isDone).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'white', margin: 0 }}>Тапсырмалар</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
            {tasks.length} тапсырма
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AiPlanButton onClick={handleGenerateAIPlan} isLoading={isAiLoading} />
          <AddButton onClick={openCreate} />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4,
        border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content',
      }}>
        {FILTERS.map(f => (
          <FilterTab
            key={f.key}
            label={f.label}
            active={activeFilter === f.key}
            isToday={f.key === 'TODAY'}
            today={today}
            onClick={() => setActiveFilter(f.key)}
          />
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard
          icon={<ListTodo size={18} color="rgba(255,255,255,0.6)" />}
          iconBg="rgba(255,255,255,0.06)"
          value={tasks.length}
          label="барлық тапсырма"
        />
        <StatCard
          icon={<CalendarDays size={18} color="#7c6af7" />}
          iconBg="rgba(124,106,247,0.1)"
          value={todayCount}
          label="бүгінгі"
        />
        <StatCard
          icon={<CheckCircle2 size={18} color="#4ade80" />}
          iconBg="rgba(74,222,128,0.1)"
          value={doneCount}
          label="орындалған"
        />
      </div>

      {/* Task list */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16 }} />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState filter={activeFilter} onAdd={openCreate} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groupByDay(filteredTasks).map(group => (
            <div key={group.date ?? '__none__'}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                {group.date && isToday(parseISO(group.date)) && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#7c6af7', boxShadow: '0 0 8px #7c6af7',
                    flexShrink: 0, display: 'inline-block',
                  }} />
                )}
                <span style={{
                  fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: group.date && isToday(parseISO(group.date))
                    ? '#7c6af7' : 'rgba(255,255,255,0.35)',
                }}>
                  {group.label}
                </span>
                {group.date && !isToday(parseISO(group.date)) && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontWeight: 400 }}>
                    {format(parseISO(group.date), 'dd.MM')}
                  </span>
                )}
                <div style={{
                  flex: 1, height: 1,
                  background: group.date && isToday(parseISO(group.date))
                    ? 'linear-gradient(90deg, rgba(124,106,247,0.25) 0%, transparent 80%)'
                    : 'rgba(255,255,255,0.05)',
                }} />
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 500,
                  background: 'rgba(255,255,255,0.04)', padding: '2px 8px',
                  borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {group.tasks.length}
                </span>
              </div>

              {/* Cards grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 320px))',
                gap: 10,
              }}>
                {group.tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    today={today}
                    onDone={handleDone}
                    onUndone={handleUndone}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <TaskModal
          editingTask={editingTask}
          goals={goals}
          isSubmitting={isSubmitting}
          today={today}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </Layout>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

const TaskCard = ({
  task, today, onDone, onUndone, onEdit, onDelete,
}: {
  task: TaskResponse
  today: string
  onDone: (id: string) => void
  onUndone: (id: string) => void
  onEdit: (task: TaskResponse) => void
  onDelete: (id: string) => void
}) => {
  const [hovered,   setHovered]   = useState(false)
  const [checkHov,  setCheckHov]  = useState(false)
  const [editHov,   setEditHov]   = useState(false)
  const [deleteHov, setDeleteHov] = useState(false)

  const taskIsToday = task.scheduledDate === today
  const p = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES['MEDIUM']

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'rgba(255,255,255,0.055)'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16,
        transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
        opacity: task.isDone ? 0.4 : 1,
        boxShadow: hovered && !task.isDone ? '0 12px 40px rgba(0,0,0,0.35)' : 'none',
        padding: '16px 18px',
        cursor: 'default',
      }}
    >
      {/* Top row: checkbox + title + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Checkbox */}
        <div
          onMouseEnter={() => setCheckHov(true)}
          onMouseLeave={() => setCheckHov(false)}
          onClick={() => task.isDone ? onUndone(task.id) : onDone(task.id)}
          style={{
            width: 22, height: 22, borderRadius: 7,
            flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.18s',
            ...(task.isDone
              ? { background: 'linear-gradient(135deg, #7c6af7, #a78bfa)', border: 'none' }
              : {
                  background: checkHov ? 'rgba(199,191,255,0.07)' : 'transparent',
                  border: `1.5px solid ${checkHov ? 'rgba(199,191,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
                }
            ),
          }}
        >
          {(task.isDone || checkHov) && (
            <Check size={12} color={task.isDone ? 'white' : 'rgba(199,191,255,0.8)'} strokeWidth={3} />
          )}
        </div>

        {/* Title */}
        <span style={{
          flex: 1,
          fontSize: 14, fontWeight: 500, lineHeight: 1.4,
          color: task.isDone ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.88)',
          textDecoration: task.isDone ? 'line-through' : 'none',
        }}>
          {task.title}
          {!task.goalTitle && taskIsToday && !task.isDone && (
            <Sparkles size={10} color="rgba(199,191,255,0.5)"
              style={{ display: 'inline', marginLeft: 5, verticalAlign: 'middle' }} />
          )}
        </span>

        {/* Action buttons — appear on hover */}
        <div style={{
          display: 'flex', gap: 2, flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
        }}>
          <IconButton hovered={editHov} onHover={setEditHov}
            onClick={() => onEdit(task)}
            hoverBg="rgba(255,255,255,0.08)" hoverColor="rgba(255,255,255,0.85)">
            <Edit2 size={13} />
          </IconButton>
          <IconButton hovered={deleteHov} onHover={setDeleteHov}
            onClick={() => onDelete(task.id)}
            hoverBg="rgba(248,113,113,0.12)" hoverColor="#f87171">
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>

      {/* Bottom meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 8, paddingLeft: 32, flexWrap: 'wrap',
      }}>
        {/* Priority chip — no dot */}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
          padding: '3px 8px', borderRadius: 6,
          background: p.background, color: p.color,
          border: `1px solid ${p.border}`,
        }}>
          {p.label}
        </span>

        {/* Goal chip */}
        {task.goalTitle && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <Target size={8} color="rgba(255,255,255,0.25)" />
            {task.goalTitle}
          </span>
        )}

        {/* Completed time */}
        {task.isDone && task.completedAt && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: 'rgba(74,222,128,0.45)',
          }}>
            <CheckCircle2 size={9} />
            {format(new Date(task.completedAt), 'HH:mm')}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── TaskModal ────────────────────────────────────────────────────────────────

const TaskModal = ({
  editingTask, goals, isSubmitting, today, onClose, onSubmit,
}: {
  editingTask: TaskResponse | null
  goals: GoalOption[]
  isSubmitting: boolean
  today: string
  onClose: () => void
  onSubmit: (data: FormValues) => void
}) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editingTask
      ? {
          title:         editingTask.title,
          priority:      editingTask.priority,
          scheduledDate: editingTask.scheduledDate,
          goalId:        editingTask.goalId ?? '',
        }
      : { title: '', priority: 'MEDIUM', scheduledDate: today, goalId: '' },
  })

  useEffect(() => {
    reset(editingTask
      ? {
          title:         editingTask.title,
          priority:      editingTask.priority,
          scheduledDate: editingTask.scheduledDate,
          goalId:        editingTask.goalId ?? '',
        }
      : { title: '', priority: 'MEDIUM', scheduledDate: today, goalId: '' }
    )
  }, [editingTask, reset, today])

  const [closeHov,     setCloseHov]  = useState(false)
  const [cancelHov,    setCancelHov] = useState(false)
  const [focusedField, setFocused]   = useState<string | null>(null)

  const inputStyle = (field: string): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${focusedField === field ? 'rgba(124,106,247,0.5)' : 'rgba(255,255,255,0.08)'}`,
    boxShadow: focusedField === field ? '0 0 0 3px rgba(124,106,247,0.08)' : 'none',
    borderRadius: 10, height: 44, padding: '0 14px',
    color: 'white', fontSize: 14, width: '100%',
    outline: 'none', transition: 'all 0.2s',
    fontFamily: 'inherit', boxSizing: 'border-box',
  })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161616', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 32,
          width: 460, maxWidth: 'calc(100vw - 32px)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, color: 'white', fontWeight: 600, margin: 0 }}>
            {editingTask ? 'Тапсырманы өңдеу' : 'Тапсырма қосу'}
          </h2>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: closeHov ? 'white' : 'rgba(255,255,255,0.4)',
              transition: 'color 0.15s', padding: 4, display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}
        >
          {/* Title */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
              Атауы *
            </label>
            <input
              {...register('title')}
              placeholder="Тапсырма атауы"
              style={inputStyle('title')}
              onFocus={() => setFocused('title')}
              onBlur={() => setFocused(null)}
            />
            {errors.title && (
              <span style={{ fontSize: 12, color: '#f87171', marginTop: 4, display: 'block' }}>
                {errors.title.message}
              </span>
            )}
          </div>

          {/* Priority */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
              Басымдық
            </label>
            <select
              {...register('priority')}
              onFocus={() => setFocused('priority')}
              onBlur={() => setFocused(null)}
              style={{ ...inputStyle('priority'), cursor: 'pointer' }}
            >
              <option value="LOW"    style={{ background: '#1a1a1a', color: 'white' }}>Төмен</option>
              <option value="MEDIUM" style={{ background: '#1a1a1a', color: 'white' }}>Орта</option>
              <option value="HIGH"   style={{ background: '#1a1a1a', color: 'white' }}>Жоғары</option>
            </select>
          </div>

          {/* Scheduled date */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
              Күні
            </label>
            <input
              {...register('scheduledDate')}
              type="date"
              onFocus={() => setFocused('scheduledDate')}
              onBlur={() => setFocused(null)}
              style={{ ...inputStyle('scheduledDate'), colorScheme: 'dark' }}
            />
          </div>

          {/* Goal */}
          {goals.length > 0 && (
            <div>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
                Мақсат
              </label>
              <select
                {...register('goalId')}
                onFocus={() => setFocused('goalId')}
                onBlur={() => setFocused(null)}
                style={{ ...inputStyle('goalId'), cursor: 'pointer' }}
              >
                <option value="" style={{ background: '#1a1a1a', color: 'white' }}>Мақсатсыз</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id} style={{ background: '#1a1a1a', color: 'white' }}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setCancelHov(true)}
              onMouseLeave={() => setCancelHov(false)}
              style={{
                background: 'transparent',
                border: `1px solid ${cancelHov ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10, padding: '10px 20px',
                color: cancelHov ? 'white' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer', fontSize: 14, transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              Болдырмау
            </button>
            <SubmitButton isSubmitting={isSubmitting} />
          </div>
        </form>
      </div>

      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }`}</style>
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

const StatCard = ({
  icon, iconBg, value, label,
}: {
  icon: React.ReactNode
  iconBg: string
  value: number
  label: string
}) => (
  <div style={{
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14, padding: '16px 18px',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: iconBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 22, color: 'white', fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{label}</div>
    </div>
  </div>
)

const IconButton = ({
  hovered, onHover, onClick, hoverBg, hoverColor, children,
}: {
  hovered: boolean
  onHover: (v: boolean) => void
  onClick: () => void
  hoverBg: string
  hoverColor: string
  children: React.ReactNode
}) => (
  <button
    onClick={onClick}
    onMouseEnter={() => onHover(true)}
    onMouseLeave={() => onHover(false)}
    style={{
      width: 28, height: 28, borderRadius: 6,
      background: hovered ? hoverBg : 'transparent',
      border: 'none', cursor: 'pointer',
      color: hovered ? hoverColor : 'rgba(255,255,255,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', flexShrink: 0,
    }}
  >
    {children}
  </button>
)

const AiPlanButton = ({ onClick, isLoading }: { onClick: () => void; isLoading: boolean }) => {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(199,191,255,0.15)' : 'rgba(199,191,255,0.1)',
        border: '1px solid rgba(199,191,255,0.2)',
        borderRadius: 10, padding: '8px 16px',
        color: '#c7bfff', fontSize: 13,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.15s', fontFamily: 'inherit',
      }}
    >
      <Sparkles size={14} />
      {isLoading ? 'Жасалуда...' : 'AI жоспар'}
    </button>
  )
}

const AddButton = ({ onClick }: { onClick: () => void }) => {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'linear-gradient(135deg, #7c6af7, #9b8bf9)',
        border: 'none', borderRadius: 10, padding: '10px 18px',
        color: 'white', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        opacity: hov ? 0.9 : 1, transition: 'opacity 0.2s', fontFamily: 'inherit',
      }}
    >
      <Plus size={16} /> Тапсырма қосу
    </button>
  )
}

const FilterTab = ({
  label, active, isToday: isTodayTab, today, onClick,
}: {
  label: string
  active: boolean
  isToday: boolean
  today: string
  onClick: () => void
}) => {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: active ? 'rgba(124,106,247,0.15)' : 'transparent',
        color: active ? '#7c6af7' : hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
        fontWeight: active ? 500 : 400,
        borderRadius: 8, padding: '6px 14px',
        cursor: 'pointer', border: 'none', fontSize: 14,
        transition: 'all 0.15s', fontFamily: 'inherit',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
      }}
    >
      {label}
      {isTodayTab && active && (
        <span style={{ fontSize: 12, color: 'rgba(124,106,247,0.6)', marginLeft: 6 }}>
          {format(new Date(today), 'd MMM')}
        </span>
      )}
    </button>
  )
}

const SubmitButton = ({ isSubmitting }: { isSubmitting: boolean }) => {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'linear-gradient(135deg, #7c6af7, #9b8bf9)',
        border: 'none', borderRadius: 10, padding: '10px 24px',
        color: 'white', fontSize: 14, fontWeight: 500,
        cursor: isSubmitting ? 'not-allowed' : 'pointer',
        opacity: isSubmitting ? 0.6 : hov ? 0.9 : 1,
        transition: 'opacity 0.2s', fontFamily: 'inherit',
      }}
    >
      {isSubmitting ? 'Сақталуда...' : 'Сақтау'}
    </button>
  )
}

const EMPTY_MESSAGES: Record<FilterKey, string> = {
  TODAY:  'Бүгін тапсырма жоқ',
  DONE:   'Орындалған тапсырма жоқ',
  ACTIVE: 'Белсенді тапсырма жоқ',
  ALL:    'Тапсырма қосылмаған',
}

const EmptyState = ({ filter, onAdd }: { filter: FilterKey; onAdd: () => void }) => {
  const [hov, setHov] = useState(false)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      marginTop: 80,
    }}>
      <CheckSquare size={52} color="rgba(255,255,255,0.08)" />
      <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 12, marginBottom: 20 }}>
        {EMPTY_MESSAGES[filter]}
      </p>
      <button
        onClick={onAdd}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? 'rgba(124,106,247,0.15)' : 'rgba(124,106,247,0.08)',
          border: '1px solid rgba(124,106,247,0.2)',
          borderRadius: 10, padding: '10px 20px',
          color: '#7c6af7', fontSize: 14, cursor: 'pointer',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        Тапсырма қосу
      </button>
    </div>
  )
}

export default TasksPage
