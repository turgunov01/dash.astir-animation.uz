<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const props = defineProps<{
  seriesId: string | number
}>()

const emit = defineEmits<{
  updated: []
}>()

const api = useApi()
const config = useRuntimeConfig()

const posterInput = ref<HTMLInputElement | null>(null)
const posterFile = ref<File | null>(null)
const posterSaving = ref(false)
const posterAvailable = ref(true)
const posterCacheKey = ref(Date.now())
const error = ref<ApiErrorInfo | null>(null)

const selectedPosterPreview = computed(() => {
  if (!posterFile.value || !process.client) return ''
  return URL.createObjectURL(posterFile.value)
})
const posterUrl = computed(() => {
  const baseUrl = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
  const id = encodeURIComponent(String(props.seriesId))
  return `${baseUrl}/api/v1/series/${id}/poster?v=${posterCacheKey.value}`
})
const previewUrl = computed(() => selectedPosterPreview.value || (posterAvailable.value ? posterUrl.value : ''))

watch(
  () => props.seriesId,
  () => {
    posterAvailable.value = true
    posterCacheKey.value = Date.now()
    posterFile.value = null
  }
)

async function uploadPoster() {
  if (!posterFile.value) {
    posterInput.value?.click()
    return
  }

  posterSaving.value = true
  error.value = null

  try {
    const body = new FormData()
    body.append('file', posterFile.value)

    await api.post(`/api/v1/series/${encodeURIComponent(String(props.seriesId))}/poster`, body)
    posterFile.value = null
    posterAvailable.value = true
    posterCacheKey.value = Date.now()
    emit('updated')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    posterSaving.value = false
  }
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Постер</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Текущий постер сериала и замена изображения.</p>
      </div>
    </div>

    <div class="panel-body">
      <ApiErrorAlert :error="error" />

      <div class="movie-media-panel">
        <button class="movie-poster-preview" type="button" @click="posterInput?.click()">
          <img v-if="previewUrl" :src="previewUrl" alt="" @error="posterAvailable = false">
          <span v-else>
            <AppIcon name="i-lucide-image" />
            Нет постера
          </span>
        </button>

        <div class="movie-media-actions">
          <input
            ref="posterInput"
            hidden
            type="file"
            accept="image/*"
            @change="posterFile = ($event.target as HTMLInputElement).files?.[0] || null"
          >
          <button class="button secondary" type="button" @click="posterInput?.click()">
            <AppIcon name="i-lucide-image-plus" />
            {{ posterFile ? posterFile.name : 'Выбрать постер' }}
          </button>
          <button class="button" type="button" :disabled="posterSaving || !posterFile" @click="uploadPoster">
            <AppIcon :name="posterSaving ? 'i-lucide-loader-circle' : 'i-lucide-upload-cloud'" :spin="posterSaving" />
            {{ posterSaving ? 'Загрузка...' : 'Сохранить постер' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
