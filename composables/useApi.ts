import type { ApiErrorInfo, ApiMethod } from '~/types/api'

interface ApiRequestOptions {
  method?: ApiMethod
  body?: unknown
  query?: Record<string, unknown>
  headers?: Record<string, string>
  skipAuthRetry?: boolean
}

export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const fetcher = $fetch as unknown as <Response>(request: string, opts: Record<string, unknown>) => Promise<Response>
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers || {})
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const execute = (token: string) =>
      fetcher<T>(path, {
        baseURL: String(config.public.apiBaseUrl || ''),
        method: options.method || 'GET',
        body: options.body,
        query: cleanQuery(options.query),
        headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers
      })

    try {
      return await execute(auth.accessToken)
    } catch (error) {
      const apiError = normalizeApiError(error)

      if (shouldRetryWithRefresh(path, apiError, options)) {
        const refreshed = await auth.refresh()
        if (refreshed) {
          return await execute(auth.accessToken)
        }
      }

      if (apiError.statusCode === 401 && !isLoginRequest(path)) {
        auth.clearSession()
        if (process.client) {
          await navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } })
        }
      }

      throw apiError
    }
  }

  return {
    request,
    get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    remove: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body })
  }
}

function shouldRetryWithRefresh(path: string, error: ApiErrorInfo, options: ApiRequestOptions): boolean {
  if (options.skipAuthRetry || error.statusCode !== 401) return false
  if (isAuthRequest(path)) return false

  const auth = useAuthStore()
  return Boolean(auth.refreshToken)
}

function isAuthRequest(path: string): boolean {
  return path.includes('/auth/login') || path.includes('/auth/otp') || path.includes('/auth/refresh')
}

function isLoginRequest(path: string): boolean {
  return path.includes('/auth/login') || path.includes('/auth/otp')
}

export function normalizeApiError(error: unknown): ApiErrorInfo {
  const record = error as {
    data?: unknown
    response?: { status?: number }
    statusCode?: number
    status?: number
    message?: string
  }

  const data = record?.data as Record<string, unknown> | undefined
  const nestedError = data?.error as Record<string, unknown> | string | undefined
  const legacyMessage = data?.message
  const message =
    localizedErrorMessage(nestedError) ||
    localizedErrorMessage(legacyMessage) ||
    record?.message ||
    'Не удалось выполнить запрос'

  const requestId =
    typeof nestedError === 'object' && nestedError?.requestId
      ? String(nestedError.requestId)
      : data?.requestId
        ? String(data.requestId)
        : undefined

  const code =
    typeof nestedError === 'object' && nestedError?.code
      ? String(nestedError.code)
      : typeof nestedError === 'string'
        ? nestedError
        : undefined

  return {
    code,
    message,
    requestId,
    statusCode: record.statusCode || record.status || record.response?.status,
    raw: error
  }
}

function localizedErrorMessage(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const direct = record.message
    if (typeof direct === 'string') return direct
    if (direct && typeof direct === 'object') {
      const localized = direct as Record<string, unknown>
      return String(localized.ru || localized.uz || localized.en || '')
    }
    return String(record.ru || record.uz || record.en || '')
  }

  return ''
}

function cleanQuery(query?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!query) return undefined

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
}
