const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`)
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return res.json()
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }))
      throw new Error(error.error ?? `POST ${path} failed: ${res.status}`)
    }
    return res.json()
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }))
      throw new Error(error.error ?? `PATCH ${path} failed: ${res.status}`)
    }
    return res.json()
  },

  async del<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`)
    return res.json()
  },
}
