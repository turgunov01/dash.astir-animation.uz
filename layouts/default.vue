<script setup lang="ts">
import { navigation } from '~/utils/resources'

const route = useRoute()
const auth = useAuthStore()
const colorMode = useColorMode()

const breadcrumbs = computed(() =>
  route.path
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/-/g, ' '))
)

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <NuxtLink class="brand" to="/">
        <span class="brand-mark">A</span>
        <span>
          <p class="brand-title">Astir Admin</p>
          <p class="brand-subtitle">Streaming operations</p>
        </span>
      </NuxtLink>

      <nav class="sidebar-nav">
        <template v-for="item in navigation" :key="item.label">
          <div v-if="'children' in item" class="nav-group">
            <div class="nav-group-label">
              <AppIcon :name="item.icon" />
              {{ item.label }}
            </div>
            <div class="nav-children">
              <NuxtLink v-for="child in item.children" :key="child.to" class="nav-link" :to="child.to">
                <AppIcon :name="child.icon" />
                {{ child.label }}
              </NuxtLink>
            </div>
          </div>
          <NuxtLink v-else class="nav-link" :to="item.to">
            <AppIcon :name="item.icon" />
            {{ item.label }}
          </NuxtLink>
        </template>
      </nav>
    </aside>

    <div class="main">
      <header class="topbar">
        <div>
          <div class="breadcrumbs">
            <NuxtLink to="/">Dashboard</NuxtLink>
            <template v-for="part in breadcrumbs" :key="part">
              <span>/</span>
              <span style="text-transform: capitalize;">{{ part }}</span>
            </template>
          </div>
        </div>

        <div class="topbar-actions">
          <button class="button secondary icon" type="button" title="Тема" @click="toggleTheme">
            <AppIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" />
          </button>
          <!-- <div class="badge neutral">
            <AppIcon name="i-lucide-user" />
            {{ auth.user?.name || auth.user?.email || 'Admin' }}
            <StatusBadge v-if="auth.role" :value="auth.role" />
          </div> -->
          <button class="button secondary icon" type="button" title="Выйти" @click="auth.logout">
            <AppIcon name="i-lucide-log-out" />
          </button>
        </div>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>
