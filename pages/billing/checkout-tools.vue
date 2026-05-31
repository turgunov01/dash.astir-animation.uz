<script setup lang="ts">
import { billingTools } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Billing and checkout tools</h1>
        <p class="page-description">
          Операторские и developer-only формы для checkout, recurring charge, Apple/Google verification и Click tools. Webhook endpoints не вынесены как обычные действия.
        </p>
      </div>
    </div>

    <div class="grid grid-2">
      <EndpointTool v-for="tool in billingTools" :key="tool.title" :tool="tool" />
    </div>
  </section>
</template>
