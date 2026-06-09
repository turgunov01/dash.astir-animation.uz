<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.children
</script>

<template>
  <AdminChildrenTable :definition="definition" />
</template>
