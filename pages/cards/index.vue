<script setup lang="ts">
import { resourceDefinitions } from '~/utils/resources'

definePageMeta({ roles: ['admin', 'super_admin', 'parent'] })
const definition = resourceDefinitions.cards
</script>

<template>
  <section>
    <ResourceTable :definition="definition" />
    <div class="grid" style="margin-top: 16px;">
      <EndpointTool v-for="tool in definition.tools || []" :key="tool.title" :tool="tool" />
    </div>
  </section>
</template>
