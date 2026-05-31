<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.tvDevices
</script>

<template>
  <ResourceTable :definition="definition" />
</template>
