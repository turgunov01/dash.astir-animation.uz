<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const props = defineProps<{
  childId: string | number
}>()

const api = useApi()
const items = ref<Record<string, unknown>[]>([])
const contentId = ref('')
const loading = ref(false)
const saving = ref(false)
const deletingContentId = ref('')
const error = ref<ApiErrorInfo | null>(null)

const endpoint = computed(() => `/v1/children/${encodeURIComponent(String(props.childId))}/blacklist`)

watch(
  () => props.childId,
  () => {
    items.value = []
    void loadBlacklist()
  }
)

onMounted(loadBlacklist)

async function loadBlacklist() {
  loading.value = true
  error.value = null

  try {
    const response = await api.get(endpoint.value)
    items.value = normalizeList(response, ['blacklist', 'items', 'movies', 'content'])
      .items
      .map(normalizeBlacklistItem)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    items.value = []
  } finally {
    loading.value = false
  }
}

async function addContent() {
  const normalizedContentId = contentId.value.trim()
  if (!normalizedContentId) {
    error.value = { message: 'Content ID is required.' }
    return
  }

  saving.value = true
  error.value = null

  try {
    await api.post(endpoint.value, { contentId: normalizedContentId })
    contentId.value = ''
    await loadBlacklist()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    saving.value = false
  }
}

async function removeContent(row: Record<string, unknown>) {
  const id = contentIdOf(row)
  if (!id) return

  deletingContentId.value = id
  error.value = null

  try {
    await api.remove(`${endpoint.value}/${encodeURIComponent(id)}`)
    await loadBlacklist()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    deletingContentId.value = ''
  }
}

function normalizeBlacklistItem(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { contentId: value }
}

function contentIdOf(row: Record<string, unknown>): string {
  const value =
    getResourceValue(row, 'contentId') ??
    getResourceValue(row, 'content_id') ??
    getResourceValue(row, 'movie_id') ??
    getResourceValue(row, 'id') ??
    getItemId(getResourceValue(row, 'content')) ??
    getItemId(getResourceValue(row, 'movie'))

  return value === undefined || value === null ? '' : String(value)
}

function titleOf(row: Record<string, unknown>): string {
  return (
    pickLocalized(getResourceValue(row, 'title')) ||
    pickLocalized(getResourceValue(row, 'content.title')) ||
    pickLocalized(getResourceValue(row, 'movie.title')) ||
    String(getResourceValue(row, 'name') || getResourceValue(row, 'content.name') || getResourceValue(row, 'movie.name') || 'Untitled')
  )
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Blacklist</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Blocked content for this child profile.</p>
      </div>
      <button class="button secondary" type="button" :disabled="loading" @click="loadBlacklist">
        <AppIcon name="i-lucide-refresh-cw" />
        Refresh
      </button>
    </div>

    <div class="panel-body">
      <ApiErrorAlert :error="error" />

      <form class="child-blacklist-form" @submit.prevent="addContent">
        <label class="field">
          <span class="field-label">Content ID</span>
          <input v-model="contentId" class="input" type="text" placeholder="movie-id">
        </label>
        <button class="button" type="submit" :disabled="saving">
          <AppIcon :name="saving ? 'i-lucide-loader-circle' : 'i-lucide-plus'" :spin="saving" />
          Add
        </button>
      </form>

      <div v-if="loading" class="loading-state" style="min-height: 120px;">Loading blacklist...</div>
      <div v-else-if="!items.length" class="empty-state" style="min-height: 120px;">No blocked content</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Content</th>
              <th>ID</th>
              <th style="width: 1%;"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="contentIdOf(row) || JSON.stringify(row)">
              <td>
                <strong>{{ titleOf(row) }}</strong>
              </td>
              <td>{{ contentIdOf(row) || '-' }}</td>
              <td>
                <button
                  class="button secondary icon"
                  type="button"
                  :disabled="!contentIdOf(row) || deletingContentId === contentIdOf(row)"
                  title="Remove"
                  @click="removeContent(row)"
                >
                  <AppIcon :name="deletingContentId === contentIdOf(row) ? 'i-lucide-loader-circle' : 'i-lucide-trash-2'" :spin="deletingContentId === contentIdOf(row)" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
