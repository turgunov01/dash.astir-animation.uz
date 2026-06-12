<script setup lang="ts">
import type { ApiErrorInfo, ResourceDefinition } from '~/types/api'

const props = defineProps<{
  definition: ResourceDefinition
  id: string | number
}>()

const route = useRoute()
const api = useApi()
const item = ref<Record<string, unknown> | null>(null)
const loading = ref(false)
const activeSaving = ref(false)
const deleting = ref(false)
const error = ref<ApiErrorInfo | string | null>(null)
const deleteTarget = ref(false)

const queryParentId = computed(() => queryText(route.query.parentId))
const parentId = computed(() => {
  const value =
    getResourceValue(item.value, 'parent_id') ??
    getResourceValue(item.value, 'parentId') ??
    getResourceValue(item.value, 'parent.id') ??
    queryParentId.value

  return value === undefined || value === null || value === '' ? '' : String(value)
})
const parent = computed(() => getResourceValue(item.value, 'parent') as Record<string, unknown> | undefined)
const childActive = computed(() => normalizeBoolean(getResourceValue(item.value, 'active')))
const pageTitle = computed(() => {
  const name = String(getResourceValue(item.value, 'name') || '').trim()
  return name ? `Ребенок: ${name}` : `Дети #${props.id}`
})

watch(
  () => [props.id, route.query.parentId],
  () => load()
)
onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  item.value = null

  try {
    const child = queryParentId.value
      ? await loadChildForParent(queryParentId.value)
      : await findChildAcrossParents()

    if (!child) {
      error.value = 'Ребенок не найден. Проверьте ID или откройте запись из общего списка детей.'
      return
    }

    item.value = child
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    loading.value = false
  }
}

async function loadChildForParent(parentIdValue: string) {
  const [parentValue, childrenResponse] = await Promise.all([
    loadParent(parentIdValue),
    api.get(`/api/v1/users/${encodeURIComponent(parentIdValue)}/children`)
  ])

  const child = normalizeList(childrenResponse, 'children').items.find((row) => sameId(getItemId(row), props.id))
  return child ? withParent(child, parentValue || { id: parentIdValue }) : null
}

async function findChildAcrossParents() {
  const parents = await loadParents()

  for (const parentValue of parents) {
    const parentIdValue = getItemId(parentValue)
    if (parentIdValue === undefined) continue

    try {
      const response = await api.get(`/api/v1/users/${encodeURIComponent(String(parentIdValue))}/children`)
      const child = normalizeList(response, 'children').items.find((row) => sameId(getItemId(row), props.id))
      if (child) return withParent(child, parentValue)
    } catch {
      // Keep scanning other parents; one inaccessible parent should not break direct child lookup.
    }
  }

  return null
}

async function loadParent(parentIdValue: string) {
  try {
    const response = await api.get(`/api/v1/users/${encodeURIComponent(parentIdValue)}`)
    return unwrapPayload<Record<string, unknown>>(response, 'user')
  } catch {
    return null
  }
}

async function loadParents() {
  const parents: Record<string, unknown>[] = []
  const pageSize = 100
  let offset = 0
  let totalParents: number | undefined

  for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
    const response = await api.get('/api/v1/users', {
      role: 'parent',
      limit: pageSize,
      offset
    })
    const normalized = normalizeList(response, 'users')
    parents.push(...normalized.items)
    totalParents = normalized.total ?? totalParents

    if (!normalized.items.length) break
    offset += pageSize
    if (totalParents !== undefined && offset >= totalParents) break
    if (totalParents === undefined && normalized.items.length < pageSize) break
  }

  return parents
}

async function toggleActive() {
  if (!item.value || !parentId.value) return

  activeSaving.value = true
  error.value = null

  try {
    const response = await api.patch<Record<string, unknown>>(
      `/api/v1/users/${encodeURIComponent(parentId.value)}/children/${encodeURIComponent(String(props.id))}/active`,
      { active: !childActive.value }
    )
    item.value = withParent(unwrapPayload<Record<string, unknown>>(response, 'child'), parent.value || { id: parentId.value })
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    activeSaving.value = false
  }
}

async function confirmDelete() {
  if (!parentId.value) {
    error.value = 'Не удалось определить parent_id для удаления.'
    return
  }

  deleting.value = true
  error.value = null

  try {
    await api.remove(`/api/v1/users/${encodeURIComponent(parentId.value)}/children/${encodeURIComponent(String(props.id))}`)
    deleteTarget.value = false
    await navigateTo('/children')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    deleting.value = false
  }
}

function withParent(child: Record<string, unknown>, parentValue: Record<string, unknown>) {
  const parentIdValue = getItemId(parentValue) ?? getResourceValue(child, 'parent_id') ?? getResourceValue(child, 'parentId')

  return {
    ...child,
    parent_id: parentIdValue,
    parentId: parentIdValue,
    parent: {
      ...parentValue,
      id: parentIdValue
    }
  }
}

function parentDisplayName(value: Record<string, unknown> | undefined) {
  return firstText([
    getResourceValue(value, 'name'),
    getResourceValue(value, 'email'),
    getResourceValue(value, 'phone'),
    parentId.value
  ])
}

function firstText(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }

  return ''
}

function sameId(left: unknown, right: unknown) {
  return String(left || '') === String(right || '')
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'active'].includes(normalized)) return true
    if (['false', '0', 'no', 'inactive'].includes(normalized)) return false
  }

  return Boolean(value)
}

function queryText(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <NuxtLink class="badge neutral" to="/children">
          <AppIcon name="i-lucide-arrow-left" />
          Назад
        </NuxtLink>
        <h1 class="page-title" style="margin-top: 12px;">{{ pageTitle }}</h1>
        <p v-if="definition.description" class="page-description">{{ definition.description }}</p>
      </div>
      <div class="page-actions">
        <button
          v-if="item"
          class="category-toggle-button"
          :class="{ active: childActive }"
          type="button"
          role="switch"
          :aria-checked="childActive"
          :disabled="activeSaving || !parentId"
          @click="toggleActive"
        >
          <span class="category-toggle-track">
            <span class="category-toggle-thumb" />
          </span>
          <span>{{ childActive ? 'Активен' : 'Неактивен' }}</span>
        </button>
        <button class="button secondary" type="button" :disabled="loading" @click="load">
          <AppIcon name="i-lucide-refresh-cw" />
          Обновить
        </button>
        <button v-if="item" class="button danger" type="button" @click="deleteTarget = true">
          <AppIcon name="i-lucide-trash-2" />
          Удалить
        </button>
      </div>
    </div>

    <ApiErrorAlert :error="error" />
    <div v-if="loading" class="loading-state">Загрузка записи...</div>

    <div v-else-if="item" class="split-layout">
      <div class="grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 style="margin: 0; font-size: 18px;">Профиль</h2>
              <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Данные ребенка из админского endpoint родителя.</p>
            </div>
          </div>
          <div class="panel-body meta-list">
            <div class="meta-row">
              <span>ID</span>
              <strong>{{ getItemId(item) || '-' }}</strong>
            </div>
            <div class="meta-row">
              <span>Имя</span>
              <strong>{{ getResourceValue(item, 'name') || '-' }}</strong>
            </div>
            <div class="meta-row">
              <span>Возраст</span>
              <strong>{{ getResourceValue(item, 'age') ?? '-' }}</strong>
            </div>
            <div class="meta-row">
              <span>Статус</span>
              <StatusBadge :value="childActive" />
            </div>
            <div class="meta-row">
              <span>Продлено до</span>
              <DateTimeCell :value="getResourceValue(item, 'extended_until') || getResourceValue(item, 'extendedUntil')" />
            </div>
            <div class="meta-row">
              <span>Создан</span>
              <DateTimeCell :value="getResourceValue(item, 'created_at') || getResourceValue(item, 'createdAt')" />
            </div>
            <div class="meta-row">
              <span>Обновлен</span>
              <DateTimeCell :value="getResourceValue(item, 'updated_at') || getResourceValue(item, 'updatedAt')" />
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 style="margin: 0; font-size: 18px;">Родитель</h2>
              <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">Контекст нужен backend-у для админских операций над ребенком.</p>
            </div>
            <NuxtLink v-if="parentId" class="button secondary" :to="`/users/${encodeURIComponent(parentId)}`">
              <AppIcon name="i-lucide-user" />
              Открыть
            </NuxtLink>
          </div>
          <div class="panel-body meta-list">
            <div class="meta-row">
              <span>Parent ID</span>
              <strong>{{ parentId || '-' }}</strong>
            </div>
            <div class="meta-row">
              <span>Имя</span>
              <strong>{{ parentDisplayName(parent) || '-' }}</strong>
            </div>
            <div class="meta-row">
              <span>Email</span>
              <strong>{{ getResourceValue(parent, 'email') || '-' }}</strong>
            </div>
            <div class="meta-row">
              <span>Телефон</span>
              <strong>{{ getResourceValue(parent, 'phone') || '-' }}</strong>
            </div>
          </div>
        </div>
      </div>

      <MetadataCard :item="item" />
    </div>

    <ConfirmDeleteModal
      :model-value="deleteTarget"
      :loading="deleting"
      @update:model-value="deleteTarget = false"
      @confirm="confirmDelete"
    />
  </section>
</template>
