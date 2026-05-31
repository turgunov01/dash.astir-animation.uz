<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.categories
</script>

<template>
  <ResourceCreate :definition="definition" back-to="/content/categories" />
</template>
