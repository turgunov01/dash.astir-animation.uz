<script setup lang="ts">
import { watchSessionTools } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Watch sessions and limits</h1>
        <p class="page-description">
          Операционный экран для device-token flow. Реальные watch sessions создаются paired devices и должны учитывать dailyMinutes, allowedFrom, allowedTo и allowedDays.
        </p>
      </div>
    </div>

    <div class="grid grid-2">
      <EndpointTool v-for="tool in watchSessionTools" :key="tool.title" :tool="tool" />
      <div class="panel">
        <div class="panel-header">
          <h2 style="margin: 0; font-size: 18px;">История и аналитика</h2>
        </div>
        <div class="panel-body empty-state">
          List/history endpoint в ТЗ не указан, поэтому аналитика оставлена read-only placeholder.
        </div>
      </div>
    </div>
  </section>
</template>
