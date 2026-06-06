<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

definePageMeta({ roles: ['admin', 'super_admin'] })

const api = useApi()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const contentId = ref(queryText(route.query.contentId) || queryText(route.query.id))
const loadedContentId = ref('')
const comments = ref<Record<string, unknown>[]>([])
const newBody = ref('')
const editBody = ref('')
const editingId = ref('')
const loading = ref(false)
const adding = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const notice = ref('')
const deleteTarget = ref<Record<string, unknown> | null>(null)

const trimmedContentId = computed(() => contentId.value.trim())
const currentContentId = computed(() => loadedContentId.value || trimmedContentId.value)
const canLoad = computed(() => Boolean(trimmedContentId.value) && !loading.value)
const canAdd = computed(() => Boolean(currentContentId.value && newBody.value.trim()) && !adding.value)

onMounted(() => {
  if (trimmedContentId.value) void loadComments()
})

watch(
  () => [route.query.contentId, route.query.id],
  ([contentQuery, idQuery]) => {
    const nextId = queryText(contentQuery) || queryText(idQuery)
    if (!nextId || nextId === contentId.value) return
    contentId.value = nextId
    void loadComments()
  }
)

async function loadComments(targetId = trimmedContentId.value) {
  const id = String(targetId || '').trim()
  if (!id || loading.value) return

  loading.value = true
  error.value = null
  notice.value = ''

  try {
    const response = await api.get(`/api/v1/content/${encodeURIComponent(id)}/comments`)
    comments.value = sortComments(normalizeList(response, 'comments').items)
    loadedContentId.value = id
    contentId.value = id
    await syncContentIdQuery(id)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    comments.value = []
    loadedContentId.value = ''
  } finally {
    loading.value = false
  }
}

async function addComment() {
  const id = currentContentId.value.trim()
  const body = newBody.value.trim()
  if (!id || !body || adding.value) return

  adding.value = true
  error.value = null
  notice.value = ''

  try {
    await api.post(`/api/v1/content/${encodeURIComponent(id)}/comments`, { body })
    newBody.value = ''
    await loadComments(id)
    notice.value = 'Комментарий добавлен'
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    adding.value = false
  }
}

function startEdit(comment: Record<string, unknown>) {
  const id = commentId(comment)
  if (!id) return

  editingId.value = id
  editBody.value = commentBody(comment)
  error.value = null
  notice.value = ''
}

function cancelEdit() {
  editingId.value = ''
  editBody.value = ''
}

async function saveComment(comment: Record<string, unknown>) {
  const id = commentId(comment)
  const body = editBody.value.trim()
  if (!id || !body || saving.value) return

  saving.value = true
  error.value = null
  notice.value = ''

  try {
    await api.put(`/api/v1/comments/${encodeURIComponent(id)}`, { body })
    cancelEdit()
    await loadComments(currentContentId.value)
    notice.value = 'Комментарий обновлен'
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const id = deleteTarget.value ? commentId(deleteTarget.value) : ''
  if (!id || deleting.value) return

  deleting.value = true
  error.value = null
  notice.value = ''

  try {
    await api.remove(`/api/v1/comments/${encodeURIComponent(id)}`)
    deleteTarget.value = null
    await loadComments(currentContentId.value)
    notice.value = 'Комментарий удален'
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    deleting.value = false
  }
}

async function syncContentIdQuery(id: string) {
  if (queryText(route.query.contentId) === id) return
  await router.replace({ path: route.path, query: { ...route.query, contentId: id, id: undefined } })
}

function commentId(comment: Record<string, unknown>): string {
  return firstText([
    getItemId(comment, 'comment_id'),
    getResourceValue(comment, 'comment_id'),
    getResourceValue(comment, 'commentId'),
    getResourceValue(comment, 'id')
  ])
}

function commentBody(comment: Record<string, unknown>): string {
  return firstText([
    getResourceValue(comment, 'body'),
    getResourceValue(comment, 'text'),
    getResourceValue(comment, 'message'),
    getResourceValue(comment, 'comment'),
    getResourceValue(comment, 'content')
  ])
}

function commentAuthor(comment: Record<string, unknown>): string {
  return firstDisplayText([
    userName(getResourceValue(comment, 'user')),
    userName(getResourceValue(comment, 'author')),
    userName(getResourceValue(comment, 'owner')),
    userName(getResourceValue(comment, 'parent')),
    getResourceValue(comment, 'user.name'),
    getResourceValue(comment, 'author.name'),
    getResourceValue(comment, 'owner.name'),
    getResourceValue(comment, 'user.email'),
    getResourceValue(comment, 'author.email'),
    getResourceValue(comment, 'username'),
    getResourceValue(comment, 'email')
  ]) || 'Пользователь'
}

function commentAuthorMeta(comment: Record<string, unknown>): string {
  return firstText([
    getResourceValue(comment, 'user.email'),
    getResourceValue(comment, 'author.email'),
    getResourceValue(comment, 'owner.email'),
    getResourceValue(comment, 'user.phone'),
    getResourceValue(comment, 'author.phone'),
    getResourceValue(comment, 'phone'),
    commentOwnerId(comment)
  ])
}

function commentTime(comment: Record<string, unknown>): string {
  return formatDateTime(
    getResourceValue(comment, 'createdAt') ??
      getResourceValue(comment, 'created_at') ??
      getResourceValue(comment, 'updatedAt') ??
      getResourceValue(comment, 'updated_at')
  )
}

function commentUpdatedTime(comment: Record<string, unknown>): string {
  const created = firstText([getResourceValue(comment, 'createdAt'), getResourceValue(comment, 'created_at')])
  const updated = firstText([getResourceValue(comment, 'updatedAt'), getResourceValue(comment, 'updated_at')])
  if (!updated || updated === created) return ''
  return formatDateTime(updated)
}

function canEditComment(comment: Record<string, unknown>): boolean {
  const ownerId = commentOwnerId(comment)
  return !ownerId || ownerId === currentUserId()
}

function isOwnComment(comment: Record<string, unknown>): boolean {
  const ownerId = commentOwnerId(comment)
  return Boolean(ownerId && ownerId === currentUserId())
}

function currentUserId(): string {
  return firstText([
    auth.user?.id,
    getResourceValue(auth.user, 'uuid'),
    getResourceValue(auth.user, '_id'),
    getResourceValue(auth.user, 'user_id'),
    getResourceValue(auth.user, 'userId')
  ])
}

function commentOwnerId(comment: Record<string, unknown>): string {
  return firstText([
    getResourceValue(comment, 'user_id'),
    getResourceValue(comment, 'userId'),
    getResourceValue(comment, 'author_id'),
    getResourceValue(comment, 'authorId'),
    getResourceValue(comment, 'owner_id'),
    getResourceValue(comment, 'ownerId'),
    getResourceValue(comment, 'user.id'),
    getResourceValue(comment, 'author.id'),
    getResourceValue(comment, 'owner.id'),
    getResourceValue(comment, 'user.uuid'),
    getResourceValue(comment, 'author.uuid')
  ])
}

function userName(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

  return firstDisplayText([
    getResourceValue(value, 'name'),
    getResourceValue(value, 'fullName'),
    getResourceValue(value, 'full_name'),
    getResourceValue(value, 'displayName'),
    getResourceValue(value, 'display_name'),
    getResourceValue(value, 'username'),
    getResourceValue(value, 'email'),
    getResourceValue(value, 'phone')
  ])
}

function sortComments(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items
    .map((comment, index) => ({ comment, index, time: commentTimestamp(comment) }))
    .sort((left, right) => {
      if (left.time === right.time) return left.index - right.index
      if (left.time === undefined) return 1
      if (right.time === undefined) return -1
      return right.time - left.time
    })
    .map((entry) => entry.comment)
}

function commentTimestamp(comment: Record<string, unknown>): number | undefined {
  const value =
    getResourceValue(comment, 'createdAt') ??
    getResourceValue(comment, 'created_at') ??
    getResourceValue(comment, 'updatedAt') ??
    getResourceValue(comment, 'updated_at')
  if (!value) return undefined

  const time = new Date(String(value)).getTime()
  return Number.isNaN(time) ? undefined : time
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim()
      if (text) return text
    }
  }

  return ''
}

function firstDisplayText(values: unknown[]): string {
  for (const value of values) {
    const text = firstText([value])
    if (text && !isUuidLike(text)) return text
  }

  return ''
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function queryText(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim()
}
</script>

<template>
  <section class="comments-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Комментарии</h1>
        <p class="page-description">Список, добавление и модерация комментариев по ID контента.</p>
      </div>
      <button class="button secondary" type="button" :disabled="!currentContentId || loading" @click="loadComments(currentContentId)">
        <AppIcon name="i-lucide-refresh-cw" :spin="loading" />
        Обновить
      </button>
    </div>

    <div class="panel comments-controls">
      <form class="comments-content-form" @submit.prevent="loadComments()">
        <label class="field comments-content-field">
          <span class="field-label">Content ID</span>
          <input v-model="contentId" class="input" type="text" placeholder="ID контента">
        </label>
        <button class="button" type="submit" :disabled="!canLoad">
          <AppIcon name="i-lucide-search" />
          Загрузить
        </button>
      </form>
    </div>

    <ApiErrorAlert :error="error" />
    <div v-if="notice" class="alert comments-notice">{{ notice }}</div>

    <div class="comments-layout">
      <section class="panel comments-list-panel">
        <div class="panel-header">
          <div>
            <h2 class="comments-panel-title">Список</h2>
            <p v-if="loadedContentId" class="comments-panel-subtitle">Content ID: {{ loadedContentId }}</p>
          </div>
          <span class="badge neutral">{{ comments.length }}</span>
        </div>

        <div class="panel-body comments-list">
          <div v-if="loading" class="loading-state">Загрузка комментариев...</div>
          <div v-else-if="!loadedContentId" class="empty-state">
            <div>
              <strong>Укажите Content ID</strong>
              <p>После загрузки здесь появятся комментарии.</p>
            </div>
          </div>
          <div v-else-if="!comments.length" class="empty-state">
            <div>
              <strong>Комментариев нет</strong>
              <p>Для этого контента пока нет комментариев.</p>
            </div>
          </div>

          <article v-for="comment in comments" v-else :key="commentId(comment) || JSON.stringify(comment)" class="comment-item">
            <header class="comment-head">
              <div class="comment-author">
                <span class="comment-avatar">{{ commentAuthor(comment).slice(0, 2).toUpperCase() }}</span>
                <div>
                  <strong>{{ commentAuthor(comment) }}</strong>
                  <small v-if="commentAuthorMeta(comment)">{{ commentAuthorMeta(comment) }}</small>
                </div>
              </div>
              <div class="comment-meta">
                <span v-if="isOwnComment(comment)" class="badge info">мой</span>
                <time v-if="commentTime(comment)">{{ commentTime(comment) }}</time>
              </div>
            </header>

            <form v-if="editingId === commentId(comment)" class="comment-edit-form" @submit.prevent="saveComment(comment)">
              <textarea v-model="editBody" class="textarea" rows="4" :disabled="saving" />
              <div class="comment-actions">
                <button class="button secondary" type="button" :disabled="saving" @click="cancelEdit">Отмена</button>
                <button class="button" type="submit" :disabled="!editBody.trim() || saving">
                  <AppIcon name="i-lucide-save" />
                  {{ saving ? 'Сохранение...' : 'Сохранить' }}
                </button>
              </div>
            </form>

            <template v-else>
              <p class="comment-body">{{ commentBody(comment) || 'Комментарий без текста' }}</p>
              <div class="comment-footer">
                <span v-if="commentUpdatedTime(comment)">Изменен: {{ commentUpdatedTime(comment) }}</span>
                <span v-else></span>
                <div class="comment-actions">
                  <button
                    v-if="canEditComment(comment)"
                    class="button secondary icon"
                    type="button"
                    title="Редактировать"
                    @click="startEdit(comment)"
                  >
                    <AppIcon name="i-lucide-pencil" />
                  </button>
                  <button class="button secondary icon danger-link" type="button" title="Удалить" @click="deleteTarget = comment">
                    <AppIcon name="i-lucide-trash-2" />
                  </button>
                </div>
              </div>
            </template>
          </article>
        </div>
      </section>

      <aside class="panel comments-composer-panel">
        <div class="panel-header">
          <h2 class="comments-panel-title">Новый комментарий</h2>
        </div>
        <form class="panel-body comments-composer" @submit.prevent="addComment">
          <label class="field">
            <span class="field-label">Текст</span>
            <textarea v-model="newBody" class="textarea" rows="6" placeholder="Комментарий" :disabled="adding || !currentContentId" />
          </label>
          <button class="button" type="submit" :disabled="!canAdd">
            <AppIcon name="i-lucide-send-horizontal" />
            {{ adding ? 'Отправка...' : 'Добавить' }}
          </button>
        </form>
      </aside>
    </div>

    <ConfirmDeleteModal
      :model-value="Boolean(deleteTarget)"
      :loading="deleting"
      title="Удалить комментарий?"
      message="Комментарий будет удален без возможности восстановления."
      @update:model-value="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
