<script setup lang="ts">
interface TagOption {
  id: string
  label: string
  slug: string
  active: boolean
}

const props = withDefaults(
  defineProps<{
    selectedTagIds?: string[]
    freeFormTags?: string[]
    disabled?: boolean
    allowFreeForm?: boolean
  }>(),
  {
    selectedTagIds: () => [],
    freeFormTags: () => [],
    disabled: false,
    allowFreeForm: true
  }
)

const emit = defineEmits<{
  'update:selectedTagIds': [value: string[]]
  'update:freeFormTags': [value: string[]]
}>()

const api = useApi()
const tagOptions = ref<TagOption[]>([])
const loading = ref(false)
const loadError = ref('')
const freeFormTagInput = ref('')

onMounted(loadTagOptions)

function toggleTagId(tagId: string) {
  if (props.disabled) return

  const current = props.selectedTagIds || []
  emit(
    'update:selectedTagIds',
    current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
  )
}

function addFreeFormTag() {
  if (props.disabled) return

  const candidates = freeFormTagInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const existing = new Set((props.freeFormTags || []).map((tag) => tag.toLowerCase()))
  const next = [...(props.freeFormTags || [])]

  for (const tag of candidates) {
    const key = tag.toLowerCase()
    if (!existing.has(key)) {
      existing.add(key)
      next.push(tag)
    }
  }

  emit('update:freeFormTags', next)
  freeFormTagInput.value = ''
}

function removeFreeFormTag(tag: string) {
  if (props.disabled) return
  emit('update:freeFormTags', (props.freeFormTags || []).filter((item) => item !== tag))
}

async function loadTagOptions() {
  loading.value = true
  loadError.value = ''

  try {
    const response = await api.get('/v1/content/tags', { limit: 100 })
    tagOptions.value = normalizeList(response, 'tags').items
      .map(toTagOption)
      .filter((option): option is TagOption => Boolean(option))
  } catch {
    loadError.value = 'Не удалось загрузить теги'
    tagOptions.value = []
  } finally {
    loading.value = false
  }
}

function toTagOption(item: Record<string, unknown>): TagOption | null {
  const id = getItemId(item)
  if (id === undefined) return null

  const name = String(getResourceValue(item, 'name') || '').trim()
  const slug = String(getResourceValue(item, 'slug') || '').trim()

  return {
    id: String(id),
    label: name || slug || String(id),
    slug,
    active: normalizeBooleanValue(getResourceValue(item, 'active'))
  }
}

function normalizeBooleanValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'active'].includes(normalized)) return true
    if (['false', '0', 'no', 'inactive'].includes(normalized)) return false
  }

  return Boolean(value)
}
</script>

<template>
  <div class="tag-selector">
    <div v-if="loading" class="field-hint">Загрузка тегов...</div>
    <div v-else-if="tagOptions.length" class="tag-list">
      <button
        v-for="tag in tagOptions"
        :key="tag.id"
        class="tag-chip"
        :class="{ active: selectedTagIds.includes(tag.id), inactive: !tag.active }"
        type="button"
        :disabled="disabled"
        @click="toggleTagId(tag.id)"
      >
        {{ tag.label }}
      </button>
    </div>
    <small v-else class="field-hint">{{ loadError || 'Существующие теги пока не созданы.' }}</small>

    <div v-if="allowFreeForm" class="tag-input-row">
      <input
        v-model="freeFormTagInput"
        class="input"
        type="text"
        placeholder="Новый тег"
        :disabled="disabled"
        @keydown.enter.prevent="addFreeFormTag"
      >
      <button class="button secondary" type="button" :disabled="disabled || !freeFormTagInput.trim()" @click="addFreeFormTag">
        Добавить
      </button>
    </div>

    <div v-if="allowFreeForm && freeFormTags.length" class="tag-list">
      <button
        v-for="tag in freeFormTags"
        :key="tag"
        class="tag-chip active removable"
        type="button"
        :disabled="disabled"
        title="Убрать тег"
        @click="removeFreeFormTag(tag)"
      >
        {{ tag }}
        <AppIcon name="i-lucide-x" />
      </button>
    </div>
  </div>
</template>
