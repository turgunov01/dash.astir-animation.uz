<script setup lang="ts">
definePageMeta({ roles: ['admin', 'super_admin'] })

const config = useRuntimeConfig()
const auth = useAuthStore()
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-description">Runtime-настройки frontend и сведения о текущей сессии.</p>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="panel">
        <div class="panel-header">
          <h2 style="margin: 0; font-size: 18px;">API</h2>
        </div>
        <div class="panel-body meta-list">
          <div class="meta-row">
            <span>Base URL</span>
            <strong>{{ config.public.apiBaseUrl }}</strong>
          </div>
          <div class="meta-row">
            <span>Auth</span>
            <StatusBadge :value="auth.isAuthenticated" />
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 style="margin: 0; font-size: 18px;">Current user</h2>
          <CopyButton :value="JSON.stringify(auth.user || {}, null, 2)" />
        </div>
        <div class="panel-body">
          <pre class="code">{{ JSON.stringify(auth.user, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>
