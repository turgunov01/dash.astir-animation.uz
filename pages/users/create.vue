<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['super_admin'] })
const definition = resourceDefinitions.users
</script>

<template>
  <ResourceCreate :definition="definition" back-to="/users" />
</template>
