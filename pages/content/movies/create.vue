<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin'] })
const definition = resourceDefinitions.movies
</script>

<template>
  <ContentCreateModal :definition="definition" content-type="movie" back-to="/content/movies" />
</template>
