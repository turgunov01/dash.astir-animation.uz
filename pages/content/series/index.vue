<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.series
</script>

<template>
  <ContentCatalog :definition="definition" />
</template>
