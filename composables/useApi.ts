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
    const method = options.method || 'GET'
    const startedAt = Date.now()
    const debugStore = process.client ? useApiDebugStore() : null
    const debugId = debugStore?.startRequest({
      method,
      path,
      baseUrl: String(config.public.apiBaseUrl || ''),
      query: options.query,
      body: options.body,
      source: 'admin-ui'
    })
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
        method,
        body: options.body,
        query: cleanQuery(options.query),
        headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers
      })

    try {
      const response = await execute(auth.accessToken)
      debugStore?.finishRequest(debugId, {
        status: 'success',
        durationMs: Date.now() - startedAt,
        response
      })
      return response
    } catch (error) {
      const apiError = normalizeApiError(error)

      if (shouldRetryWithRefresh(path, apiError, options)) {
        const refreshed = await auth.refresh()
        if (refreshed) {
          try {
            const response = await execute(auth.accessToken)
            debugStore?.finishRequest(debugId, {
              status: 'success',
              durationMs: Date.now() - startedAt,
              response
            })
            return response
          } catch (retryError) {
            const retryApiError = normalizeApiError(retryError)
            await handleUnauthorized(path, retryApiError)
            debugStore?.finishRequest(debugId, {
              status: 'error',
              statusCode: retryApiError.statusCode,
              durationMs: Date.now() - startedAt,
              response: retryApiError.raw,
              errorMessage: retryApiError.message,
              errorCode: retryApiError.code,
              requestId: retryApiError.requestId
            })
            throw retryApiError
          }
        }
      }

      await handleUnauthorized(path, apiError)

      debugStore?.finishRequest(debugId, {
        status: 'error',
        statusCode: apiError.statusCode,
        durationMs: Date.now() - startedAt,
        response: apiError.raw,
        errorMessage: apiError.message,
        errorCode: apiError.code,
        requestId: apiError.requestId
      })
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

async function handleUnauthorized(path: string, error: ApiErrorInfo) {
  if (error.statusCode !== 401 || isLoginRequest(path)) return

  const auth = useAuthStore()
  auth.clearSession()
  if (process.client) {
    await navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } })
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
    message: humanReadableErrorMessage(code, message),
    requestId,
    statusCode: record.statusCode || record.status || record.response?.status,
    raw: error
  }
}

function humanReadableErrorMessage(code: string | undefined, message: string): string {
  const normalizedCode = String(code || '').toLowerCase()
  const normalizedMessage = String(message || '').toLowerCase()

  if (normalizedCode === 'invalid_role' || normalizedMessage === 'invalid_role') {
    return 'Выбранная роль не поддерживается этим endpoint.'
  }

  return message
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
