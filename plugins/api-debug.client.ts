export default defineNuxtPlugin(() => {
  const debug = useApiDebugStore()
  debug.load()

  window.addEventListener('error', (event) => {
    debug.addAdminEvent(event.message || 'Ошибка в админке', {
      file: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    debug.addAdminEvent(reason instanceof Error ? reason.message : 'Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.stack : reason
    })
  })
})
