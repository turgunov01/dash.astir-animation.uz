<script setup lang="ts">
import { pairingTools } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Devices and pairing</h1>
        <p class="page-description">
          QA-инструменты для modern pairing flow. Child/TV устройства после подтверждения получают device tokens и дальше используют device bearer auth.
        </p>
      </div>
    </div>

    <div class="grid grid-2">
      <EndpointTool v-for="tool in pairingTools" :key="tool.title" :tool="tool" />
    </div>
  </section>
</template>
