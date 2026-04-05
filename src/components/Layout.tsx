import { useState, type ReactNode } from 'react'
import logoArnaAi from '../assets/arna-ai-logo.png'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  BookOpen,
  MessageSquare,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  icon: ReactNode
  label: string
  path: string
}

interface LayoutProps {
  children: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { icon: <LayoutDashboard size={16} />, label: 'Басты бет',    path: '/dashboard' },
  { icon: <Target size={16} />,          label: 'Мақсаттар',    path: '/goals'     },
  { icon: <CheckSquare size={16} />,     label: 'Тапсырмалар',  path: '/tasks'     },
  { icon: <BookOpen size={16} />,        label: 'Күнделік',     path: '/diary'     },
  { icon: <MessageSquare size={16} />,   label: 'Чат',          path: '/chat'      },
]

const Layout = ({ children }: LayoutProps) => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()

  const initials = user?.name ? user.name.charAt(0).toUpperCase() : 'A'

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#080808',
      padding: 12,
      gap: 10,
      overflow: 'hidden',
    }}>

      {/* ── Sidebar island ─────────────────────────────────────────────── */}
      <div style={{
        width: 220,
        flexShrink: 0,
        background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

         {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1, padding: '4px 8px', marginBottom: 10 }}>
          <img src={logoArnaAi} alt="Arna AI" style={{ height: 32 }} />
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <NavItemButton
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        {/* Bottom — user block */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            margin: '12px 0',
          }} />
          <UserBlock
            name={user?.name ?? ''}
            initials={initials}
            onLogout={logout}
          />
        </div>
      </div>

      {/* ── Main content island ─────────────────────────────────────────── */}
      <div style={{
        flexGrow: 1,
        background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div
          className="main-content"
          style={{ flexGrow: 1, overflowY: 'auto', padding: '28px 32px' }}
        >
          {children}
        </div>
      </div>

    </div>
  )
}

// ─── NavItemButton ─────────────────────────────────────────────────────────────

const NavItemButton = ({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) => {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: isActive ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        outline: 'none',
        background: isActive
          ? 'rgba(124,106,247,0.12)'
          : hovered
          ? 'rgba(255,255,255,0.05)'
          : 'transparent',
        color: isActive
          ? '#a78bfa'
          : hovered
          ? 'rgba(255,255,255,0.7)'
          : 'rgba(255,255,255,0.35)',
      }}
    >
      <span style={{
        flexShrink: 0,
        color: isActive ? '#7c6af7' : 'inherit',
        display: 'flex',
        alignItems: 'center',
      }}>
        {item.icon}
      </span>
      {item.label}
    </button>
  )
}

// ─── UserBlock ─────────────────────────────────────────────────────────────────

const UserBlock = ({
  name,
  initials,
  onLogout,
}: {
  name: string
  initials: string
  onLogout: () => void
}) => {
  const [blockHovered, setBlockHovered] = useState(false)
  const [logoutHovered, setLogoutHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setBlockHovered(true)}
      onMouseLeave={() => setBlockHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 8px',
        borderRadius: 12,
        background: blockHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
        cursor: 'default',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'linear-gradient(135deg, #7c6af7, #a78bfa)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        color: 'white',
        flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Name + status */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          color: 'white',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 1,
        }}>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#4ade80',
            flexShrink: 0,
          }} />
          Онлайн
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        onMouseEnter={() => setLogoutHovered(true)}
        onMouseLeave={() => setLogoutHovered(false)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          color: logoutHovered ? '#f87171' : 'rgba(255,255,255,0.2)',
          transition: 'color 0.15s',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}

export default Layout
