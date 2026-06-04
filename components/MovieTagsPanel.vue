<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const props = defineProps<{
  movieId: string | number
  movie?: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  updated: []
}>()

const api = useApi()
const selectedTagIds = ref<string[]>([])
const saving = ref(false)
const error = ref<ApiErrorInfo | null>(null)

watch(
  () => props.movie,
  () => {
    selectedTagIds.value = extractMovieTagIds(props.movie)
  },
  { immediate: true, deep: true }
)

async function saveTags() {
  saving.value = true
  error.value = null

  try {
    await api.put(resolveEndpoint('/v1/content/movies/{id}/tags', { id: props.movieId }), {
      tag_ids: selectedTagIds.value
    })
    emit('updated')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    saving.value = false
  }
}

function extractMovieTagIds(movie: Record<string, unknown> | null | undefined): string[] {
  const direct = getResourceValue(movie, 'tag_ids')

  if (Array.isArray(direct)) {
    return direct
      .map((id) => (typeof id === 'string' || typeof id === 'number' ? String(id) : ''))
      .filter(Boolean)
  }

  const tags = getResourceValue(movie, 'tags')
  if (!Array.isArray(tags)) return []

  return tags
    .map((tag) => getItemId(tag))
    .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
    .map(String)
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Редактирование тегов</h2>
      </div>
    </div>
    <div class="panel-body">
      <ApiErrorAlert :error="error" />
      <ContentTagSelector
        v-model:selected-tag-ids="selectedTagIds"
        :free-form-tags="[]"
        :disabled="saving"
        :allow-free-form="false"
      />
      <div class="content-modal-actions">
        <button class="button" type="button" :disabled="saving" @click="saveTags">
          <AppIcon :name="saving ? 'i-lucide-loader-circle' : 'i-lucide-save'" :spin="saving" />
          {{ saving ? 'Сохранение...' : 'Сохранить теги' }}
        </button>
      </div>
    </div>
  </div>
</template>
