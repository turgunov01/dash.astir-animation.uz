<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.series
</script>

<template>
  <ContentCreateModal :definition="definition" content-type="series" back-to="/content/series" />
</template>
