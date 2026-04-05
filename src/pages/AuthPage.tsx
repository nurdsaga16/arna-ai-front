import { useState, type CSSProperties } from 'react'
import logoArnaAi from '../assets/arna-ai-logo.png'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import type { AxiosError } from 'axios'

// ─── Schemas ────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Қате email форматы'),
  password: z.string().min(6, 'Кем дегенде 6 символ'),
})

const registerSchema = z
  .object({
    name: z.string().min(2, 'Кем дегенде 2 символ'),
    email: z.string().email('Қате email форматы'),
    password: z.string().min(6, 'Кем дегенде 6 символ'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Құпия сөздер сәйкес келмейді',
    path: ['confirmPassword'],
  })

type LoginValues    = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputBase: CSSProperties = {
  height: 50,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: 15,
  padding: '0 16px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, background 0.2s',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 8,
  display: 'block',
}

const errorStyle: CSSProperties = {
  color: '#f87171',
  fontSize: 12,
  marginTop: 5,
  display: 'block',
}

// ─── FieldInput ───────────────────────────────────────────────────────────────

function FieldInput({
  id, type, placeholder, focused, onFocus, onBlur, registration,
}: {
  id: string
  type: string
  placeholder: string
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  registration: object
}) {
  return (
    <input
      {...registration}
      id={id}
      type={type}
      placeholder={placeholder}
      style={{
        ...inputBase,
        ...(focused ? { borderColor: 'rgba(139,127,240,0.6)', background: 'rgba(139,127,240,0.05)' } : {}),
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}

// ─── Shared pieces ────────────────────────────────────────────────────────────

function SubmitButton({ isSubmitting, label, loadingLabel }: {
  isSubmitting: boolean; label: string; loadingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      style={{
        height: 50,
        width: '100%',
        borderRadius: 12,
        border: 'none',
        background: isSubmitting ? 'rgba(124,106,247,0.4)' : 'linear-gradient(135deg, #7c6af7, #a294f9)',
        color: 'white',
        fontSize: 16,
        fontWeight: 600,
        cursor: isSubmitting ? 'not-allowed' : 'pointer',
        opacity: isSubmitting ? 0.6 : 1,
        fontFamily: 'inherit',
        transition: 'opacity 0.15s, transform 0.15s',
        marginTop: 4,
      }}
      onMouseEnter={(e) => {
        if (!isSubmitting) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)' }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = isSubmitting ? '0.6' : '1'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {isSubmitting ? loadingLabel : label}
    </button>
  )
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginValues) => {
    setIsSubmitting(true)
    try {
      await login(data.email, data.password)
    } catch (err) {
      const error = err as AxiosError<{ message: string }>
      toast.error(error.response?.data?.message || 'Кіру кезінде қате орын алды')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label htmlFor="login-email" style={labelStyle}>Email</label>
        <FieldInput id="login-email" type="email" placeholder="email@example.com"
          focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
          registration={register('email')} />
        {errors.email && <span style={errorStyle}>{errors.email.message}</span>}
      </div>

      <div>
        <label htmlFor="login-password" style={labelStyle}>Құпия сөз</label>
        <FieldInput id="login-password" type="password" placeholder="••••••••"
          focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          registration={register('password')} />
        {errors.password && <span style={errorStyle}>{errors.password.message}</span>}
      </div>

      <SubmitButton isSubmitting={isSubmitting} label="Кіру" loadingLabel="Кіру..." />

      <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
        Есептік жазба жоқ па?{' '}
        <span style={{ color: '#8b7ff0', cursor: 'pointer' }} onClick={onSwitch}>Тіркелу →</span>
      </p>
    </form>
  )
}

// ─── Register Form ────────────────────────────────────────────────────────────

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { register: registerUser } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterValues) => {
    setIsSubmitting(true)
    try {
      await registerUser(data.email, data.name, data.password)
    } catch (err) {
      const error = err as AxiosError<{ message: string }>
      toast.error(error.response?.data?.message || 'Тіркелу кезінде қате орын алды')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label htmlFor="reg-name" style={labelStyle}>Аты</label>
        <FieldInput id="reg-name" type="text" placeholder="Атыңыз"
          focused={focused === 'name'} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
          registration={register('name')} />
        {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
      </div>

      <div>
        <label htmlFor="reg-email" style={labelStyle}>Email</label>
        <FieldInput id="reg-email" type="email" placeholder="email@example.com"
          focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
          registration={register('email')} />
        {errors.email && <span style={errorStyle}>{errors.email.message}</span>}
      </div>

      <div>
        <label htmlFor="reg-password" style={labelStyle}>Құпия сөз</label>
        <FieldInput id="reg-password" type="password" placeholder="••••••••"
          focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          registration={register('password')} />
        {errors.password && <span style={errorStyle}>{errors.password.message}</span>}
      </div>

      <div>
        <label htmlFor="reg-confirm" style={labelStyle}>Құпия сөзді растау</label>
        <FieldInput id="reg-confirm" type="password" placeholder="••••••••"
          focused={focused === 'confirmPassword'} onFocus={() => setFocused('confirmPassword')} onBlur={() => setFocused(null)}
          registration={register('confirmPassword')} />
        {errors.confirmPassword && <span style={errorStyle}>{errors.confirmPassword.message}</span>}
      </div>

      <SubmitButton isSubmitting={isSubmitting} label="Тіркелу" loadingLabel="Тіркелу..." />

      <p style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
        Есептік жазбаңыз бар ма?{' '}
        <span style={{ color: '#8b7ff0', cursor: 'pointer' }} onClick={onSwitch}>Кіру →</span>
      </p>
    </form>
  )
}

// ─── Main AuthPage ────────────────────────────────────────────────────────────

type Tab = 'login' | 'register'

const AuthPage = ({ initialTab }: { initialTab: Tab }) => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(initialTab)

  const switchTo = (t: Tab) => {
    setTab(t)
    navigate(t === 'login' ? '/login' : '/register', { replace: true })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0e11',
        backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(99,85,220,0.18), transparent 60%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        fontFamily: "'Outfit', -apple-system, sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* Logo above card */}
      <div style={{ marginBottom: 28, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <img src={logoArnaAi} alt="Arna AI" style={{ height: 50 }} />
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#13141a',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          padding: '36px 40px',
          boxSizing: 'border-box',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            padding: 4,
            marginBottom: 32,
          }}
        >
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTo(t)}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 9,
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                background: tab === t ? 'rgba(124,106,247,0.22)' : 'transparent',
                color: tab === t ? '#a294f9' : 'rgba(255,255,255,0.3)',
              }}
            >
              {t === 'login' ? 'Кіру' : 'Тіркелу'}
            </button>
          ))}
        </div>

        {/* Form */}
        {tab === 'login'
          ? <LoginForm onSwitch={() => switchTo('register')} />
          : <RegisterForm onSwitch={() => switchTo('login')} />
        }
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
      `}</style>
    </div>
  )
}

export default AuthPage
