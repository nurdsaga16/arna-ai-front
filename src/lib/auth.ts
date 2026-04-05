const TOKEN_KEY = 'arna_token'
const USER_KEY = 'arna_user'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  createdAt?: string
}

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

export const getUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export const setUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const removeUser = (): void => {
  localStorage.removeItem(USER_KEY)
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}

export const logout = (): void => {
  removeToken()
  removeUser()
}
