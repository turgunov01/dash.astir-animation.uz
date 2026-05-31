<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['super_admin'] })
const definition = resourceDefinitions.tariffs
</script>

<template>
  <ResourceCreate :definition="definition" back-to="/tariffs" />
</template>
