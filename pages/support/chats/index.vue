<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.supportChats
</script>

<template>
  <ResourceTable :definition="definition" />
</template>
