export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  const isPublic = Boolean(to.meta.public) || to.path === '/login'

  if (!isPublic && auth.accessToken && !auth.user) {
    await auth.loadMe().catch(async () => {
      const refreshed = await auth.refresh().catch(() => false)
      if (refreshed) {
        await auth.loadMe().catch(() => auth.clearSession())
      } else {
        auth.clearSession()
      }
    })
  }

  if (!isPublic && !auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.path === '/login' && auth.isAuthenticated) {
    return navigateTo('/')
  }

  const roles = to.meta.roles as string[] | undefined
  if (!isPublic && roles?.length && auth.role && !auth.hasAnyRole(roles)) {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Недостаточно прав' }))
  }
})
