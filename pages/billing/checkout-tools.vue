<script setup lang="ts">
import { billingTools } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Click billing</h1>
        <p class="page-description">
          Checkout создает backend. Админка не отправляет amount, не считает подписи и не вызывает Click prepare/complete.
        </p>
      </div>
    </div>

    <div class="grid">
      <ClickCheckoutPanel />
    </div>

    <div class="grid grid-2" style="margin-top: 16px;">
      <EndpointTool v-for="tool in billingTools" :key="tool.title" :tool="tool" />
    </div>
  </section>
</template>
