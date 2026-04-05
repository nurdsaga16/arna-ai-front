import axios from 'axios'
import { getToken, logout } from './auth'

const api = axios.create({
  // Если VITE_API_URL не задан, используем '/api' по умолчанию
  // Это заставит браузер слать запросы на https://arna-ai-chi.vercel.app/api/...
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
