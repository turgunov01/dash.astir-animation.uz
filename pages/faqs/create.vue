<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.faqs
</script>

<template>
  <ResourceCreate :definition="definition" back-to="/faqs" />
</template>
