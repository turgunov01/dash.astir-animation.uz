<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.adminCards
</script>

<template>
  <ResourceTable :definition="definition" />
</template>
