<script setup lang="ts">
interface TagOption {
  id: string
  label: string
  slug: string
}

const props = defineProps<{
  open: boolean
  tags: TagOption[]
  selected: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  toggle: [id: string]
  clear: []
}>()

const search = ref('')

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.tags
  return props.tags.filter((tag) =>
    tag.label.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query)
  )
})

const selectedCount = computed(() => props.selected.length)

function close() {
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (open) search.value = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="tagmodal-overlay" @click.self="close">
      <div class="panel tagmodal-panel">
        <div class="panel-header tagmodal-header">
          <div>
            <h2 class="tagmodal-title">Все теги и хэштеги</h2>
            <p class="tagmodal-subtitle">Выбрано: {{ selectedCount }} · Всего: {{ tags.length }}</p>
          </div>
          <button class="icon-link" type="button" title="Закрыть" @click="close">
            <AppIcon name="i-lucide-x" />
          </button>
        </div>

        <div class="panel-body tagmodal-body">
          <input v-model="search" class="input" type="search" placeholder="Поиск по тегам и хэштегам...">

          <div v-if="filtered.length" class="tag-list tagmodal-list">
            <button
              v-for="tag in filtered"
              :key="tag.id"
              class="tag-chip"
              :class="{ active: selected.includes(tag.id) }"
              type="button"
              @click="emit('toggle', tag.id)"
            >
              {{ tag.label }}
            </button>
          </div>
          <p v-else class="field-hint">Ничего не найдено</p>
        </div>

        <div class="panel-footer tagmodal-footer">
          <button class="button secondary" type="button" :disabled="!selectedCount" @click="emit('clear')">
            <AppIcon name="i-lucide-x" />
            Сбросить ({{ selectedCount }})
          </button>
          <button class="button" type="button" @click="close">Готово</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tagmodal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 54%);
  padding: 20px;
}

.tagmodal-panel {
  width: min(640px, 100%);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

.tagmodal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tagmodal-title {
  margin: 0;
  font-size: 18px;
}

.tagmodal-subtitle {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.tagmodal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.tagmodal-list {
  max-height: 46vh;
  overflow-y: auto;
  padding-right: 4px;
}

.tagmodal-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
</style>
