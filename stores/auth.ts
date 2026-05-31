import type { AuthUser } from '~/types/api'

interface LoginPayload {
  email: string
  password: string
}

const SUPER_ADMIN_EMAILS = new Set(['sardorceeksamurai@gmail.com'])
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24

export const useAuthStore = defineStore('auth', () => {
  const accessTokenCookie = useCookie<string | null>('astir_access_token', {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS
  })
  const refreshTokenCookie = useCookie<string | null>('astir_refresh_token', {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS
  })

  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  const accessToken = computed(() => accessTokenCookie.value || '')
  const refreshToken = computed(() => refreshTokenCookie.value || '')
  const isAuthenticated = computed(() => Boolean(accessToken.value))
  const role = computed(() => normalizeRole(user.value?.role || firstArrayValue(user.value?.roles)))

  function setTokens(access?: string, refresh?: string) {
    accessTokenCookie.value = access || null
    if (refresh !== undefined) refreshTokenCookie.value = refresh || null
  }

  async function login(payload: LoginPayload) {
    loading.value = true
    try {
      const api = useApi()
      const response = await api.post<Record<string, unknown>>('/api/v1/auth/login', payload)
      const data = unwrapAuthResponse(response)
      const token = extractToken(data, 'access')
      const refresh = extractToken(data, 'refresh')

      if (!token) {
        throw normalizeApiError({ message: 'Backend не вернул access token' })
      }

      setTokens(token, refresh)
      user.value = normalizeUser(extractUser(data)) || null
      await loadMe()
    } finally {
      loading.value = false
    }
  }

  async function requestOtp(email: string) {
    const api = useApi()
    return api.post('/api/v1/auth/otp/request', { email })
  }

  async function verifyOtp(email: string, code: string) {
    loading.value = true
    try {
      const api = useApi()
      const response = await api.post<Record<string, unknown>>('/api/v1/auth/otp/verify', { email, code })
      const data = unwrapAuthResponse(response)
      const token = extractToken(data, 'access')
      const refresh = extractToken(data, 'refresh')

      if (!token) {
        throw normalizeApiError({ message: 'Backend не вернул access token' })
      }

      setTokens(token, refresh)
      user.value = normalizeUser(extractUser(data)) || null
      await loadMe()
    } finally {
      loading.value = false
    }
  }

  async function loadMe() {
    if (!accessToken.value) {
      initialized.value = true
      return
    }

    const api = useApi()
    const response = await api.get<Record<string, unknown>>('/api/v1/auth/me')
    const data = unwrapAuthResponse(response)
    user.value = normalizeUser(extractUser(data) || (data as unknown as AuthUser))
    initialized.value = true
  }

  async function refresh() {
    if (!refreshToken.value) return false

    try {
      const api = useApi()
      const response = await api.request<Record<string, unknown>>('/api/v1/auth/refresh', {
        method: 'POST',
        skipAuthRetry: true,
        body: {
          refreshToken: refreshToken.value,
          refresh_token: refreshToken.value,
          token: refreshToken.value
        }
      })
      const data = unwrapAuthResponse(response)
      const token = extractToken(data, 'access')
      const refreshValue = extractToken(data, 'refresh')

      if (!token) return false
      setTokens(token, refreshValue || refreshToken.value)
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function logout() {
    if (accessToken.value) {
      const api = useApi()
      await api.post('/api/v1/auth/logout').catch(() => undefined)
    }

    clearSession()
    await navigateTo('/login')
  }

  function clearSession() {
    setTokens('', '')
    user.value = null
    initialized.value = true
  }

  function hasAnyRole(roles?: string[]) {
    if (!roles?.length) return true
    const allowedRoles = roles.map((entry) => normalizeRole(entry)).filter(Boolean)
    return Boolean(role.value && allowedRoles.includes(role.value))
  }

  return {
    accessToken,
    refreshToken,
    user,
    role,
    initialized,
    loading,
    isAuthenticated,
    login,
    logout,
    loadMe,
    refresh,
    requestOtp,
    verifyOtp,
    hasAnyRole,
    clearSession
  }
})

function unwrapAuthResponse(response: Record<string, unknown>): Record<string, unknown> {
  if (response.data && typeof response.data === 'object') return response.data as Record<string, unknown>
  return response
}

function extractUser(data: Record<string, unknown>): AuthUser | undefined {
  const user = data.user || data.currentUser || data.admin || data.profile || data.account
  return user && typeof user === 'object' ? (user as AuthUser) : undefined
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeUser(value?: AuthUser): AuthUser | null {
  if (!value || typeof value !== 'object') return null
  const record = value as unknown as Record<string, unknown>
  const email = String(record.email || record.mail || record.login || '').toLowerCase()

  return {
    ...value,
    role: normalizeRole(
      (email && SUPER_ADMIN_EMAILS.has(email) ? 'super_admin' : '') ||
        value.role ||
        firstArrayValue(value.roles) ||
        getRecordValue(record, 'role.name') ||
        getRecordValue(record, 'role.slug') ||
        getRecordValue(record, 'userRole') ||
        getRecordValue(record, 'type') ||
        getRecordValue(record, 'accountType') ||
        booleanRole(record)
    )
  }
}

function normalizeRole(value: unknown): string {
  if (!value) return ''

  if (Array.isArray(value)) {
    return normalizeRole(firstArrayValue(value))
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return normalizeRole(record.name || record.slug || record.code || record.value || record.role)
  }

  const role = String(value)
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()

  const aliases: Record<string, string> = {
    superadmin: 'super_admin',
    super_admin: 'super_admin',
    root: 'super_admin',
    owner: 'super_admin',
    administrator: 'admin',
    admin_user: 'admin',
    user_admin: 'admin',
    parent_user: 'parent'
  }

  return aliases[role] || role
}

function firstArrayValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined
}

function booleanRole(value: Record<string, unknown>): string {
  if (value.isSuperAdmin || value.superAdmin) return 'super_admin'
  if (value.isAdmin || value.admin) return 'admin'
  return ''
}

function getRecordValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

function extractToken(data: Record<string, unknown>, type: 'access' | 'refresh'): string {
  const keys =
    type === 'access'
      ? ['accessToken', 'access_token', 'access', 'token', 'jwt']
      : ['refreshToken', 'refresh_token', 'refresh']

  for (const key of keys) {
    const value = stringValue(data[key])
    if (value) return value
  }

  const containers = [data.tokens, data.auth, data.session]
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue
    const token = extractToken(container as Record<string, unknown>, type)
    if (token) return token
  }

  return ''
}
