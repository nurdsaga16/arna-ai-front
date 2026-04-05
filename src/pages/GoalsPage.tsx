import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Target, Plus, Edit2, Trash2, CalendarDays, X } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../lib/api'

interface GoalResponse {
  id: string
  title: string
  description?: string
  deadline?: string
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  progressPct: number
  createdAt: string
  updatedAt: string
}

type FilterKey = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Барлығы' },
  { key: 'ACTIVE', label: 'Белсенді' },
  { key: 'COMPLETED', label: 'Аяқталған' },
  { key: 'ARCHIVED', label: 'Мұрағат' },
]

const STATUS_LABELS: Record<GoalResponse['status'], string> = {
  ACTIVE: 'Белсенді',
  COMPLETED: 'Аяқталған',
  ARCHIVED: 'Мұрағат',
}

const STATUS_STYLES: Record<GoalResponse['status'], { background: string; color: string }> = {
  ACTIVE:    { background: 'rgba(74,222,128,0.1)',   color: '#4ade80' },
  COMPLETED: { background: 'rgba(124,106,247,0.1)',  color: '#7c6af7' },
  ARCHIVED:  { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title:       z.string().min(1, 'Атауы міндетті'),
  description: z.string().optional(),
  deadline:    z.string().optional(),
  status:      z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
})

type FormValues = z.infer<typeof schema>

// ─── Page ─────────────────────────────────────────────────────────────────────

const GoalsPage = () => {
  const [goals,        setGoals]        = useState<GoalResponse[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL')
  const [isModalOpen,  setIsModalOpen]  = useState(false)
  const [editingGoal,  setEditingGoal]  = useState<GoalResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    api.get<GoalResponse[]>('/api/goals')
      .then(res => setGoals(res.data))
      .catch(() => toast.error('Мақсаттарды жүктеуде қате'))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredGoals = activeFilter === 'ALL'
    ? goals
    : goals.filter(g => g.status === activeFilter)

  const openCreate = () => { setEditingGoal(null); setIsModalOpen(true) }
  const openEdit   = (goal: GoalResponse) => { setEditingGoal(goal); setIsModalOpen(true) }
  const closeModal = () => { setIsModalOpen(false); setEditingGoal(null) }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Мақсатты жою?')) return
    try {
      await api.delete(`/api/goals/${id}`)
      setGoals(prev => prev.filter(g => g.id !== id))
      toast.success('Мақсат жойылды')
    } catch {
      toast.error('Жоюда қате болды')
    }
  }

  const handleSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    try {
      const body = { ...data, description: data.description || undefined, deadline: data.deadline || undefined }
      if (editingGoal) {
        const res = await api.put<GoalResponse>(`/api/goals/${editingGoal.id}`, body)
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? res.data : g))
        toast.success('Мақсат жаңартылды')
      } else {
        const res = await api.post<GoalResponse>('/api/goals', body)
        setGoals(prev => [res.data, ...prev])
        toast.success('Мақсат қосылды')
      }
      closeModal()
    } catch {
      toast.error('Қате болды')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .skeleton { animation: pulse 1.5s ease-in-out infinite; background: rgba(255,255,255,0.06); border-radius: 12px; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'white', margin: 0 }}>Мақсаттар</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4, margin: '4px 0 0' }}>
            {goals.length} мақсат
          </p>
        </div>
        <AddButton onClick={openCreate} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {FILTERS.map(f => (
          <FilterTab key={f.key} label={f.label} active={activeFilter === f.key} onClick={() => setActiveFilter(f.key)} />
        ))}
      </div>

      {/* Goals grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
        </div>
      ) : filteredGoals.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <GoalModal
          editingGoal={editingGoal}
          isSubmitting={isSubmitting}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </Layout>
  )
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

const GoalCard = ({ goal, onEdit, onDelete }: {
  goal: GoalResponse
  onEdit: (g: GoalResponse) => void
  onDelete: (id: string) => void
}) => {
  const [hovered, setHovered] = useState(false)
  const [editHov, setEditHov] = useState(false)
  const [delHov,  setDelHov]  = useState(false)

  const deadlineStr = goal.deadline
    ? (() => { try { return format(new Date(goal.deadline), 'dd MMM yyyy') } catch { return null } })()
    : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16,
        padding: 22,
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, color: 'white', fontWeight: 500, lineHeight: 1.3 }}>{goal.title}</div>
          {goal.description && (
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {goal.description}
            </div>
          )}
        </div>
        <div style={{ ...STATUS_STYLES[goal.status], fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {STATUS_LABELS[goal.status]}
        </div>
      </div>

      {/* Deadline */}
      {deadlineStr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 14 }}>
          <CalendarDays size={13} color="rgba(255,255,255,0.3)" />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{deadlineStr}</span>
        </div>
      )}

      {/* Progress */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Прогресс</span>
          <span style={{ fontSize: 13, color: '#7c6af7', fontWeight: 600 }}>{goal.progressPct}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{ height: 4, width: `${goal.progressPct}%`, background: 'linear-gradient(90deg, #7c6af7, #9b8bf9)', borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 18, display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 14 }}>
        <button
          onClick={() => onEdit(goal)}
          onMouseEnter={() => setEditHov(true)}
          onMouseLeave={() => setEditHov(false)}
          style={{ background: editHov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 14px', color: editHov ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', fontFamily: 'inherit' }}
        >
          <Edit2 size={13} /> Өңдеу
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          onMouseEnter={() => setDelHov(true)}
          onMouseLeave={() => setDelHov(false)}
          style={{ background: delHov ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8, padding: '7px 14px', color: delHov ? '#f87171' : 'rgba(248,113,113,0.7)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', fontFamily: 'inherit' }}
        >
          <Trash2 size={13} /> Жою
        </button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const GoalModal = ({ editingGoal, isSubmitting, onClose, onSubmit }: {
  editingGoal: GoalResponse | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (data: FormValues) => void
}) => {
  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editingGoal
      ? { title: editingGoal.title, description: editingGoal.description ?? '', deadline: editingGoal.deadline?.split('T')[0] ?? '', status: editingGoal.status }
      : { title: '', description: '', deadline: '', status: 'ACTIVE' },
  })

  useEffect(() => {
    reset(editingGoal
      ? { title: editingGoal.title, description: editingGoal.description ?? '', deadline: editingGoal.deadline?.split('T')[0] ?? '', status: editingGoal.status }
      : { title: '', description: '', deadline: '', status: 'ACTIVE' }
    )
  }, [editingGoal, reset])

  const [closeHov,  setCloseHov]  = useState(false)
  const [cancelHov, setCancelHov] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const inputStyle = (field: string): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${focusedField === field ? 'rgba(124,106,247,0.5)' : 'rgba(255,255,255,0.08)'}`,
    boxShadow: focusedField === field ? '0 0 0 3px rgba(124,106,247,0.08)' : 'none',
    borderRadius: 10,
    height: 44,
    padding: '0 14px',
    color: 'white',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32, width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, color: 'white', fontWeight: 600, margin: 0 }}>
            {editingGoal ? 'Мақсатты өңдеу' : 'Мақсат қосу'}
          </h2>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: closeHov ? 'white' : 'rgba(255,255,255,0.4)', transition: 'color 0.15s', padding: 4, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Атауы *</label>
            <input {...register('title')} placeholder="Мақсат атауы" style={inputStyle('title')} onFocus={() => setFocusedField('title')} onBlur={() => setFocusedField(null)} />
            {errors.title && <span style={{ fontSize: 12, color: '#f87171', marginTop: 4, display: 'block' }}>{errors.title.message}</span>}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Сипаттама</label>
            <textarea
              {...register('description')}
              placeholder="Мақсат туралы толығырақ..."
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
              style={{ ...inputStyle('description'), height: 88, padding: '12px 14px', resize: 'none', lineHeight: 1.5 } as React.CSSProperties}
            />
          </div>

          {/* Deadline */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Мерзімі</label>
            <input
              {...register('deadline')}
              type="date"
              onFocus={() => setFocusedField('deadline')}
              onBlur={() => setFocusedField(null)}
              style={{ ...inputStyle('deadline'), colorScheme: 'dark' }}
            />
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Күй</label>
            <select
              {...register('status')}
              onFocus={() => setFocusedField('status')}
              onBlur={() => setFocusedField(null)}
              style={{ ...inputStyle('status'), cursor: 'pointer' }}
            >
              <option value="ACTIVE"    style={{ background: '#1a1a1a', color: 'white' }}>Белсенді</option>
              <option value="COMPLETED" style={{ background: '#1a1a1a', color: 'white' }}>Аяқталған</option>
              <option value="ARCHIVED"  style={{ background: '#1a1a1a', color: 'white' }}>Мұрағат</option>
            </select>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setCancelHov(true)}
              onMouseLeave={() => setCancelHov(false)}
              style={{ background: 'transparent', border: `1px solid ${cancelHov ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '10px 20px', color: cancelHov ? 'white' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, transition: 'all 0.15s', fontFamily: 'inherit' }}
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

const AddButton = ({ onClick }: { onClick: () => void }) => {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'linear-gradient(135deg, #7c6af7, #9b8bf9)', border: 'none', borderRadius: 10, padding: '10px 18px', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: hov ? 0.9 : 1, transition: 'opacity 0.2s', fontFamily: 'inherit' }}>
      <Plus size={16} /> Мақсат қосу
    </button>
  )
}

const FilterTab = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: active ? 'rgba(124,106,247,0.15)' : 'transparent', color: active ? '#7c6af7' : hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', fontWeight: active ? 500 : 400, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', border: 'none', fontSize: 14, transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}

const SubmitButton = ({ isSubmitting }: { isSubmitting: boolean }) => {
  const [hov, setHov] = useState(false)
  return (
    <button type="submit" disabled={isSubmitting} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'linear-gradient(135deg, #7c6af7, #9b8bf9)', border: 'none', borderRadius: 10, padding: '10px 24px', color: 'white', fontSize: 14, fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : hov ? 0.9 : 1, transition: 'opacity 0.2s', fontFamily: 'inherit' }}>
      {isSubmitting ? 'Сақталуда...' : 'Сақтау'}
    </button>
  )
}

const EmptyState = ({ onAdd }: { onAdd: () => void }) => {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 0 }}>
      <Target size={56} color="rgba(255,255,255,0.1)" />
      <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 12, marginBottom: 20 }}>Мақсат қосылмаған</p>
      <button onClick={onAdd} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ background: hov ? 'rgba(124,106,247,0.15)' : 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.2)', borderRadius: 10, padding: '10px 20px', color: '#7c6af7', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
        Бірінші мақсатты қосу
      </button>
    </div>
  )
}

export default GoalsPage
