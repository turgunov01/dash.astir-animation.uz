<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const route = useRoute()
const definition = resourceDefinitions.series
</script>

<template>
  <ResourceDetail :definition="definition" :id="String(route.params.id)" />
</template>
