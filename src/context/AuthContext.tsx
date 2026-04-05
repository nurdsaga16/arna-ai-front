import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import * as auth from '../lib/auth'
import type { User } from '../lib/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(auth.getUser())
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = auth.getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    api
      .get<User>('/auth/me')
      .then((res) => {
        setUser(res.data)
        auth.setUser(res.data)
      })
      .catch(() => {
        auth.logout()
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    const res = await api.post<{
      token: string
      expiresIn: number
      email: string
      name: string
    }>('/auth/login', { email, password })

    auth.setToken(res.data.token)

    const meRes = await api.get<User>('/auth/me')
    auth.setUser(meRes.data)
    setUser(meRes.data)

    navigate('/dashboard')
  }

  const register = async (
    email: string,
    name: string,
    password: string
  ): Promise<void> => {
    const res = await api.post<{
      token: string
      expiresIn: number
      email: string
      name: string
    }>('/auth/register', { email, name, password })

    auth.setToken(res.data.token)

    const meRes = await api.get<User>('/auth/me')
    auth.setUser(meRes.data)
    setUser(meRes.data)

    navigate('/dashboard')
  }

  const logoutHandler = (): void => {
    auth.logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout: logoutHandler,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
