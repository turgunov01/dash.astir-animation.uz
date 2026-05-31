<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.series
</script>

<template>
  <ResourceCreate :definition="definition" back-to="/content/series" />
</template>
