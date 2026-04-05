import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target, CheckSquare, BookOpen, Sparkles,
  RefreshCw, Check, CalendarDays, Star,
  Sun, Smile, Minus, CloudRain, CloudLightning,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GoalResponse {
  id: string
  title: string
  status: string
  progressPct: number
  deadline?: string
}

interface TaskResponse {
  id: string
  title: string
  isDone: boolean
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  scheduledDate: string
  goalTitle?: string
}

interface PlannerResponse {
  content: string
  chatType: string
  createdAt: string
  generatedTasks: TaskResponse[]
}

interface DiaryResponse {
  id: string
  title?: string
  content: string
  entryDate: string
}

interface MoodResponse {
  id: string
  mood: 'GREAT' | 'GOOD' | 'NEUTRAL' | 'BAD' | 'TERRIBLE'
  energy: number
  stress: number
  aiReasoning: string
  createdAt: string
}

const MOOD_ICON: Record<MoodResponse['mood'], ReactNode> = {
  GREAT: <Sun size={32} color="#4de082" />,
  GOOD: <Smile size={32} color="#c7bfff" />,
  NEUTRAL: <Minus size={32} color="#fbbf24" />,
  BAD: <CloudRain size={32} color="#f87171" />,
  TERRIBLE: <CloudLightning size={32} color="#ef4444" />,
}

const MOOD_LABEL: Record<MoodResponse['mood'], string> = {
  GREAT: 'Керемет',
  GOOD: 'Жақсы',
  NEUTRAL: 'Бейтарап',
  BAD: 'Нашар',
  TERRIBLE: 'Өте нашар',
}

const MOOD_COLOR: Record<MoodResponse['mood'], string> = {
  GREAT: '#4de082',
  GOOD: '#c7bfff',
  NEUTRAL: '#fbbf24',
  BAD: '#f87171',
  TERRIBLE: '#ef4444',
}

const PRIORITY_COLOR: Record<TaskResponse['priority'], string> = {
  HIGH: '#f87171',
  MEDIUM: '#fbbf24',
  LOW: '#4de082',
}

// ─── DashboardPage ──────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeGoals, setActiveGoals] = useState<GoalResponse[]>([])
  const [todayTasks, setTodayTasks] = useState<TaskResponse[]>([])
  const [diaryEntries, setDiaryEntries] = useState<DiaryResponse[]>([])
  const [moodData, setMoodData] = useState<MoodResponse | null>(null)
  const [dailyPlan, setDailyPlan] = useState<string | null>(null)
  const [isPlanLoading, setIsPlanLoading] = useState(false)
  const [isMoodLoading, setIsMoodLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const [refreshHovered, setRefreshHovered] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [goalsRes, tasksRes, diaryRes, moodRes] = await Promise.all([
          api.get<GoalResponse[]>('/goals', { params: { status: 'ACTIVE' } }),
          api.get<TaskResponse[]>('/tasks/today'),
          api.get<DiaryResponse[]>('/diary'),
          api.get<MoodResponse>('/mood/latest').catch(() => ({ data: null })),
        ])
        setActiveGoals(goalsRes.data)
        setTodayTasks(tasksRes.data)
        setDiaryEntries(diaryRes.data)
        setMoodData(moodRes.data)
      } catch {
        toast.error('Деректерді жүктеу кезінде қате болды')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleGeneratePlan = async () => {
    setIsPlanLoading(true)
    try {
      const res = await api.post<PlannerResponse>('/chat/planner')
      setDailyPlan(res.data.content)
      if (res.data.generatedTasks && res.data.generatedTasks.length > 0) {
        setTodayTasks(res.data.generatedTasks)
        toast.success(`AI ${res.data.generatedTasks.length} тапсырма қосты`)
      }
    } catch {
      toast.error('Жоспар жасауда қате болды')
    } finally {
      setIsPlanLoading(false)
    }
  }

  const handleToggleTask = async (id: string, isDone: boolean) => {
    setTodayTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: !isDone } : t))
    try {
      if (isDone) {
        await api.patch(`/tasks/${id}/undone`)
      } else {
        await api.patch(`/tasks/${id}/done`)
      }
    } catch (error) {
      setTodayTasks(prev => prev.map(t => t.id === id ? { ...t, isDone } : t))
      toast.error('Қате болды')
      console.error('Toggle task error:', error)
    }
  }

  const handleAnalyzeMood = async () => {
    setIsMoodLoading(true)
    try {
      const res = await api.post<MoodResponse>('/mood/analyze')
      setMoodData(res.data)
    } catch {
      toast.error('Талдауда қате болды')
    } finally {
      setIsMoodLoading(false)
    }
  }

  const doneTasks = todayTasks.filter(t => t.isDone).length
  const totalTasks = todayTasks.length
  const donePercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const PRIORITY_ORDER: Record<TaskResponse['priority'], number> = { HIGH: 1, MEDIUM: 2, LOW: 3 }
  const sortedTodayTasks = [...todayTasks].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  })
  const lastDiary = diaryEntries[0] ?? null

  // SVG donut constants
  const CIRC = 2 * Math.PI * 80
  const energyFill = moodData ? (moodData.energy / 5) * CIRC * 0.45 : 0
  const stressFill = moodData ? (moodData.stress / 5) * CIRC * 0.45 : 0
  const energyOffset = CIRC - energyFill
  const stressOffset = CIRC - stressFill

  return (
    <Layout>
      {/* Google Fonts */}
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-in-up { animation: fadeInUp 0.4s ease forwards; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .skeleton { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      {/*
        The Layout component adds padding: 28px 32px.
        We use negative margins to reset it, then re-apply our own spacing.
      */}
      <div style={{ margin: '-28px -32px 0', fontFamily: 'Inter, sans-serif' }}>

        {/* ── HEADER ──────────────────────────────────────────────────────────── */}
        <div
          className="fade-in-up"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '32px 48px 16px',
          }}
        >
          {/* Left: greeting */}
          <div>
            <p style={{
              fontSize: 13,
              color: 'rgba(229,226,225,0.4)',
              margin: '0 0 4px',
              letterSpacing: '0.02em',
            }}>
              Қайырлы күн
            </p>
            <h1 style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: 32,
              fontWeight: 800,
              color: '#e5e2e1',
              letterSpacing: '-0.5px',
              margin: 0,
            }}>
              {user?.name}
            </h1>
          </div>

          {/* Right: date */}
          <div style={{ textAlign: 'right' }}>
            <p style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: 20,
              fontWeight: 700,
              color: '#e5e2e1',
              margin: 0,
              letterSpacing: '-0.3px',
            }}>
              {format(new Date(), 'EEEE, d MMMM')}
            </p>
          </div>
        </div>

        {/* ── BENTO GRID ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '0 48px 48px' }}>

          {/* ROW 1: Stat cards */}
          <div
            className="fade-in-up"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 24,
              animationDelay: '0.05s',
            }}
          >
            {/* Card 1: Active Goals */}
            <div style={{
              background: '#1c1b1b',
              borderRadius: 24,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 180,
            }}>
              <span style={{
                fontSize: 10,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'rgba(229,226,225,0.5)',
                textTransform: 'uppercase',
              }}>
                Белсенді мақсаттар
              </span>
              {isLoading ? (
                <div className="skeleton" style={{ height: 64, width: 80, background: '#353534', borderRadius: 8, marginTop: 16 }} />
              ) : (
                <>
                  <div style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 64,
                    fontWeight: 700,
                    color: '#e5e2e1',
                    letterSpacing: '-2px',
                    lineHeight: 1,
                    marginTop: 16,
                  }}>
                    {activeGoals.length}
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(229,226,225,0.4)' }}>белсенді</span>
                </>
              )}
            </div>

            {/* Card 2: AI Plan (highlighted) */}
            <div style={{
              background: 'linear-gradient(135deg, #7c6af7, #5b3fd4)',
              borderRadius: 24,
              padding: 32,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(124,106,247,0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 180,
            }}>
              {/* Decorative icon */}
              <div style={{
                position: 'absolute',
                right: -16,
                top: -16,
                opacity: 0.2,
                color: 'white',
              }}>
                <Sparkles size={96} />
              </div>

              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                position: 'relative',
                zIndex: 1,
              }}>
                AI Күнделікті жоспар
              </span>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'white',
                  marginTop: 8,
                  marginBottom: 20,
                }}>
                  Жеке жоспар
                </div>
                <button
                  onClick={handleGeneratePlan}
                  disabled={isPlanLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    fontWeight: 800,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    padding: '12px 24px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: isPlanLoading ? 'not-allowed' : 'pointer',
                    opacity: isPlanLoading ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isPlanLoading) { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.22)' } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)' }}
                >
                  <Sparkles size={16} />
                  Жоспар жасау
                </button>
              </div>
            </div>

            {/* Card 3: Today's tasks */}
            <div style={{
              background: '#1c1b1b',
              borderRadius: 24,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 180,
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'rgba(229,226,225,0.5)',
                textTransform: 'uppercase',
              }}>
                Бүгінгі тапсырмалар
              </span>
              {isLoading ? (
                <div className="skeleton" style={{ height: 64, width: 100, background: '#353534', borderRadius: 8, marginTop: 16 }} />
              ) : (
                <>
                  <div style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 64,
                    fontWeight: 700,
                    color: '#e5e2e1',
                    letterSpacing: '-2px',
                    lineHeight: 1,
                    marginTop: 16,
                  }}>
                    {doneTasks}/{totalTasks}
                  </div>
                  <span style={{ fontSize: 13, color: '#4de082' }}>{donePercent}% орындалды</span>
                </>
              )}
            </div>

            {/* Card 4: Diary entries */}
            <div style={{
              background: '#1c1b1b',
              borderRadius: 24,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 180,
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'rgba(229,226,225,0.5)',
                textTransform: 'uppercase',
              }}>
                Күнделік жазбалары
              </span>
              {isLoading ? (
                <div className="skeleton" style={{ height: 64, width: 60, background: '#353534', borderRadius: 8, marginTop: 16 }} />
              ) : (
                <>
                  <div style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 64,
                    fontWeight: 700,
                    color: '#e5e2e1',
                    letterSpacing: '-2px',
                    lineHeight: 1,
                    marginTop: 16,
                  }}>
                    {diaryEntries.length}
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(229,226,225,0.4)' }}>жазба</span>
                </>
              )}
            </div>
          </div>

          {/* ROW 2: Main content grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 24,
            marginTop: 24,
          }}>

            {/* ── LEFT COLUMN (col-span-8) ──────────────────────────────────── */}
            <div
              className="fade-in-up"
              style={{
                gridColumn: 'span 8',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                animationDelay: '0.1s',
              }}
            >
              {/* Tasks block */}
              <div style={{
                background: '#1c1b1b',
                borderRadius: 24,
                padding: 32,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 32,
                }}>
                  <span style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#e5e2e1',
                  }}>
                    Бүгінгі тапсырмалар
                  </span>
                  <span style={{ fontSize: 12, color: '#c7bfff', fontWeight: 600 }}>
                    {doneTasks}/{totalTasks} аяқталды
                  </span>
                </div>

                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton" style={{ height: 24, borderRadius: 6, background: '#353534' }} />
                    ))}
                  </div>
                ) : todayTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <CheckSquare size={32} style={{ opacity: 0.2, margin: '0 auto', display: 'block' }} />
                    <p style={{ fontSize: 14, opacity: 0.4, marginTop: 12 }}>Бүгін тапсырма жоқ</p>
                    <button
                      onClick={() => navigate('/tasks')}
                      style={{
                        marginTop: 12,
                        fontSize: 13,
                        color: '#c7bfff',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Тапсырма қосу →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {sortedTodayTasks.slice(0, 5).map(task => (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task.id, task.isDone)}
                        onMouseEnter={() => setHoveredTask(task.id)}
                        onMouseLeave={() => setHoveredTask(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: 12,
                          marginLeft: -8,
                          background: hoveredTask === task.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: task.isDone ? '#c7bfff' : 'transparent',
                          border: task.isDone ? 'none' : `2px solid ${hoveredTask === task.id ? '#c7bfff' : 'rgba(199,191,255,0.3)'}`,
                          transition: 'all 0.2s',
                        }}>
                          {task.isDone && <Check size={12} color="#25008c" />}
                        </div>

                        {/* Title */}
                        <span style={{
                          fontSize: 17,
                          fontWeight: 500,
                          color: task.isDone ? 'rgba(229,226,225,0.4)' : '#e5e2e1',
                          textDecoration: task.isDone ? 'line-through' : 'none',
                          textDecorationColor: 'rgba(199,191,255,0.4)',
                          flex: 1,
                        }}>
                          {task.title}
                        </span>

                        {/* Right: priority + date */}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: PRIORITY_COLOR[task.priority],
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: 10,
                            color: 'rgba(229,226,225,0.3)',
                            fontFamily: 'monospace',
                            fontWeight: task.isDone ? 700 : 400,
                            letterSpacing: task.isDone ? '0.05em' : undefined,
                          }}>
                            {task.isDone ? 'ОРЫНДАЛДЫ' : format(new Date(task.scheduledDate), 'dd MMM')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Goals block */}
              {!isLoading && activeGoals.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 20,
                }}>
                  {activeGoals.slice(0, 4).map((goal, idx) => (
                    <div
                      key={goal.id}
                      style={{
                        background: '#1c1b1b',
                        borderRadius: 24,
                        padding: 32,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 24,
                      }}>
                        {/* Icon */}
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: idx % 2 === 0 ? 'rgba(77,224,130,0.1)' : 'rgba(0,223,198,0.1)',
                        }}>
                          {idx % 2 === 0
                            ? <Target size={20} color="#4de082" />
                            : <Star size={20} color="#00dfc6" />
                          }
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(229,226,225,0.5)' }}>
                          {goal.progressPct}%
                        </span>
                      </div>

                      <div style={{
                        fontFamily: 'Manrope, sans-serif',
                        fontSize: 17,
                        fontWeight: 700,
                        color: '#e5e2e1',
                        marginBottom: 16,
                      }}>
                        {goal.title}
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 3, background: '#353534', borderRadius: 999 }}>
                        <div style={{
                          height: 3,
                          width: `${goal.progressPct}%`,
                          borderRadius: 999,
                          background: 'linear-gradient(90deg, #c7bfff, #4de082)',
                          transition: 'width 0.6s ease',
                        }} />
                      </div>

                      {goal.deadline && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 12,
                          fontSize: 10,
                          color: 'rgba(229,226,225,0.3)',
                        }}>
                          <CalendarDays size={11} />
                          {format(new Date(goal.deadline), 'dd MMM')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (col-span-4) ──────────────────────────────────── */}
            <div
              className="fade-in-up"
              style={{
                gridColumn: 'span 4',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                animationDelay: '0.15s',
              }}
            >
              {/* Mood widget */}
              <div style={{
                background: '#1c1b1b',
                borderRadius: 24,
                padding: 32,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24,
                }}>
                  <span style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#e5e2e1',
                  }}>
                    Ағымдағы күй
                  </span>
                  <button
                    onClick={handleAnalyzeMood}
                    onMouseEnter={() => setRefreshHovered(true)}
                    onMouseLeave={() => setRefreshHovered(false)}
                    title="AI талдауды жаңарту"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: refreshHovered ? '#c7bfff' : 'rgba(229,226,225,0.3)',
                      transition: 'color 0.15s',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <RefreshCw size={14} className={isMoodLoading ? 'spin' : ''} />
                  </button>
                </div>

                {!moodData ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <p style={{ fontSize: 14, opacity: 0.4, marginBottom: 12 }}>Талдау жасалмаған</p>
                    <button
                      onClick={handleAnalyzeMood}
                      style={{
                        fontSize: 13,
                        color: '#c7bfff',
                        background: 'rgba(199,191,255,0.08)',
                        border: '1px solid rgba(199,191,255,0.15)',
                        borderRadius: 10,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      AI талдауды бастау
                    </button>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const wellnessScore = Math.round((moodData.energy / 5 * 60) + ((5 - moodData.stress) / 5 * 40))
                      const energyColor = MOOD_COLOR[moodData.mood]
                      const stressColor = moodData.stress >= 4 ? '#f87171' : '#4de082'

                      return (
                        <>
                    {/* Donut chart */}
                    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                      <svg width={192} height={192} viewBox="0 0 192 192">
                        {/* Track */}
                        <circle
                          cx={96} cy={96} r={80}
                          stroke="#353534"
                          strokeWidth={14}
                          fill="none"
                        />
                        {/* Energy arc */}
                        <circle
                          cx={96} cy={96} r={80}
                          stroke={energyColor}
                          strokeWidth={14}
                          fill="none"
                          strokeDasharray={CIRC.toString()}
                          strokeDashoffset={energyOffset}
                          strokeLinecap="round"
                          transform="rotate(-90 96 96)"
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                        {/* Stress arc */}
                        <circle
                          cx={96} cy={96} r={80}
                          stroke={stressColor}
                          strokeWidth={14}
                          fill="none"
                          strokeDasharray={CIRC.toString()}
                          strokeDashoffset={stressOffset}
                          strokeLinecap="round"
                          transform="rotate(90 96 96)"
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                      </svg>
                      {/* Center label */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>{MOOD_ICON[moodData.mood]}</div>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#e5e2e1',
                          marginTop: 4,
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {MOOD_LABEL[moodData.mood]}
                        </div>
                        <div style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: MOOD_COLOR[moodData.mood],
                          marginTop: 4,
                        }}>
                          {wellnessScore}
                        </div>
                        <div style={{
                          fontSize: 9,
                          color: 'rgba(229,226,225,0.4)',
                          letterSpacing: '0.1em',
                        }}>
                          WELLNESS
                        </div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: energyColor, flexShrink: 0 }} />
                        <span style={{ color: 'rgba(229,226,225,0.7)' }}>
                          Энергия: <strong style={{ color: '#e5e2e1' }}>{moodData.energy}/5</strong>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={`energy-${i}`}
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: i <= moodData.energy ? energyColor : 'rgba(255,255,255,0.1)',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stressColor, flexShrink: 0 }} />
                        <span style={{ color: 'rgba(229,226,225,0.7)' }}>
                          Стресс: <strong style={{ color: '#e5e2e1' }}>{moodData.stress}/5</strong>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={`stress-${i}`}
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: i <= moodData.stress ? stressColor : 'rgba(255,255,255,0.1)',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* AI reasoning */}
                    {moodData.aiReasoning && (
                      <div style={{
                        marginTop: 24,
                        paddingTop: 20,
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <p style={{
                          fontStyle: 'italic',
                          fontSize: 13,
                          color: 'rgba(229,226,225,0.5)',
                          lineHeight: 1.6,
                          margin: 0,
                        }}>
                          "{moodData.aiReasoning}"
                        </p>
                        <span style={{
                          display: 'block',
                          marginTop: 8,
                          fontSize: 10,
                          color: 'rgba(229,226,225,0.25)',
                        }}>
                          {format(new Date(moodData.createdAt), 'HH:mm, d MMM')}
                        </span>
                        <p style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          color: '#c7bfff',
                          textTransform: 'uppercase',
                          marginTop: 8,
                        }}>
                          — Arna AI
                        </p>
                      </div>
                    )}
                        </>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* Diary widget */}
              <div style={{
                background: '#1c1b1b',
                borderRadius: 24,
                padding: 32,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {lastDiary ? (
                  <>
                    {/* BG gradient */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, rgba(124,106,247,0.05), rgba(0,223,198,0.05))',
                      pointerEvents: 'none',
                    }} />

                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: '#c7bfff',
                      textTransform: 'uppercase',
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      Соңғы жазба
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: 'rgba(229,226,225,0.4)',
                      marginTop: 4,
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      {format(new Date(lastDiary.entryDate), 'd MMMM')}
                    </span>
                    <div style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#e5e2e1',
                      marginTop: 8,
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      {lastDiary.title || 'Жазба'}
                    </div>
                    <p style={{
                      fontSize: 13,
                      color: 'rgba(229,226,225,0.5)',
                      lineHeight: 1.6,
                      marginTop: 8,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      {lastDiary.content.slice(0, 120)}...
                    </p>
                    <button
                      onClick={() => navigate('/diary')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#e5e2e1',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: 20,
                        padding: 0,
                        fontFamily: 'Inter, sans-serif',
                        position: 'relative',
                        zIndex: 1,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#c7bfff' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e5e2e1' }}
                    >
                      Барлық жазбалар →
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <BookOpen size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto' }} />
                    <p style={{ fontSize: 14, opacity: 0.4, marginTop: 12, marginBottom: 16 }}>
                      Күнделік жазбасы жоқ
                    </p>
                    <button
                      onClick={() => navigate('/diary')}
                      style={{
                        fontSize: 13,
                        color: '#c7bfff',
                        background: 'rgba(199,191,255,0.08)',
                        border: '1px solid rgba(199,191,255,0.15)',
                        borderRadius: 10,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Жазба қосу
                    </button>
                  </div>
                )}
              </div>

              {/* AI Plan result widget */}
              {(dailyPlan !== null || isPlanLoading) && (
                <div
                  className="fade-in-up"
                  style={{
                    background: 'linear-gradient(135deg, rgba(199,191,255,0.05), rgba(0,223,198,0.03))',
                    border: '1px solid rgba(199,191,255,0.1)',
                    borderRadius: 24,
                    padding: 32,
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: '#c7bfff',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 16,
                  }}>
                    AI Күнделікті жоспар
                  </span>

                  {isPlanLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="skeleton" style={{ height: 12, background: '#353534', borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 12, width: '80%', background: '#353534', borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 12, width: '60%', background: '#353534', borderRadius: 6 }} />
                    </div>
                  ) : (
                    <>
                      <p style={{
                        fontSize: 14,
                        lineHeight: 1.75,
                        color: 'rgba(229,226,225,0.85)',
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        fontFamily: 'Inter, sans-serif',
                      }}>
                        {dailyPlan}
                      </p>

                      {todayTasks.length > 0 && (
                        <div style={{
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          marginTop: 16,
                          paddingTop: 16,
                        }}>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'rgba(199,191,255,0.7)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: 10,
                          }}>
                            Қосылған тапсырмалар
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {sortedTodayTasks.map(task => (
                              <div
                                key={task.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                              >
                                <div
                                  onClick={() => handleToggleTask(task.id, task.isDone)}
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    ...(task.isDone
                                      ? { background: '#c7bfff', border: 'none' }
                                      : { background: 'transparent', border: '2px solid rgba(199,191,255,0.3)' }
                                    ),
                                  }}
                                >
                                  {task.isDone && <Check size={10} color="#25008c" />}
                                </div>
                                <span style={{
                                  fontSize: 13,
                                  color: task.isDone ? 'rgba(229,226,225,0.4)' : 'rgba(229,226,225,0.8)',
                                  textDecoration: task.isDone ? 'line-through' : 'none',
                                  flex: 1,
                                }}>
                                  {task.title}
                                </span>
                                <div style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  background: PRIORITY_COLOR[task.priority],
                                  flexShrink: 0,
                                }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default DashboardPage
