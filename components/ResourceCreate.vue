<script setup lang="ts">
import type { ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
  backTo: string
}>()

const router = useRouter()

async function onSuccess(response: unknown) {
  const payload = unwrapPayload<Record<string, unknown>>(response)
  const id = getItemId(payload, props.definition.idKey)
  await router.push(id && props.definition.detailRoute ? `${props.definition.detailRoute}/${id}` : props.backTo)
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <NuxtLink class="badge neutral" :to="backTo">
          <AppIcon name="i-lucide-arrow-left" />
          Назад
        </NuxtLink>
        <h1 class="page-title" style="margin-top: 12px;">Создать: {{ definition.title }}</h1>
        <p v-if="definition.description" class="page-description">{{ definition.description }}</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body">
        <ResourceForm
          :fields="definition.formFields || []"
          :endpoint="definition.createEndpoint"
          method="POST"
          submit-label="Создать"
          :background-redirect-to="backTo"
          :background-label="`Создание: ${definition.title}`"
          :background-result-route-base="definition.detailRoute || ''"
          :force-multipart="definition.createSubmit?.forceMultipart || false"
          :metadata-key="definition.createSubmit?.metadataKey || 'metadata'"
          :metadata-fields="definition.createSubmit?.metadataFields || []"
          @success="onSuccess"
        />
      </div>
    </div>
  </section>
</template>
