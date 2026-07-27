<script setup lang="ts">
interface PreviewItem {
  id: string
  poster: string
  title: string
  age: string
  description: string
  rating: string
  status: string
  statusTone: string
  allTags: string[]
  detailRoute: string
  commentsPath: string
  statsRoute: string
}

interface PreviewComment {
  author: string
  body: string
  time: string
}

const props = defineProps<{
  open: boolean
  item: PreviewItem | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()

const TAG_LIMIT = 10
const audioLanguages = ref<string[]>([])
const comments = ref<PreviewComment[]>([])
const loadingExtra = ref(false)

const visibleTags = computed(() => (props.item?.allTags || []).slice(0, TAG_LIMIT))
const hasMoreTags = computed(() => (props.item?.allTags?.length || 0) > TAG_LIMIT)

function close() {
  emit('update:open', false)
}

function commentTs(comment: Record<string, unknown>): number {
  const value = getResourceValue(comment, 'createdAt') ?? getResourceValue(comment, 'created_at')
  const time = value ? new Date(String(value)).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function commentAuthor(comment: Record<string, unknown>): string {
  const user = getResourceValue(comment, 'user') ?? getResourceValue(comment, 'author')
  const name = user && typeof user === 'object'
    ? String(getResourceValue(user, 'name') || getResourceValue(user, 'email') || '')
    : ''
  return name.trim() || 'Пользователь'
}

// Enrich the lightweight preview with audio languages + last 5 comments only when
// the modal actually opens — nothing is fetched while the table just sits there.
watch(() => props.open, async (open) => {
  const id = props.item?.id
  if (!open || !id) return

  audioLanguages.value = []
  comments.value = []
  loadingExtra.value = true

  const [assetsResult, commentsResult] = await Promise.allSettled([
    api.get(`/v1/content/movies/${encodeURIComponent(id)}/streaming-assets`),
    api.get(`/api/v1/content/${encodeURIComponent(id)}/comments`)
  ])

  if (assetsResult.status === 'fulfilled') {
    const payload = (assetsResult.value as Record<string, unknown>)?.data ?? assetsResult.value
    audioLanguages.value = normalizeStreamingState(payload).audioTracks
      .map((track) => track.label || track.languageCode)
      .filter(Boolean)
  }

  if (commentsResult.status === 'fulfilled') {
    comments.value = normalizeList(commentsResult.value, 'comments').items
      .map((comment) => ({
        author: commentAuthor(comment),
        body: String(getResourceValue(comment, 'body') ?? getResourceValue(comment, 'text') ?? '').trim(),
        time: formatDateTime(getResourceValue(comment, 'createdAt') ?? getResourceValue(comment, 'created_at')),
        ts: commentTs(comment)
      }))
      .sort((left, right) => right.ts - left.ts)
      .slice(0, 5)
      .map(({ author, body, time }) => ({ author, body, time }))
  }

  loadingExtra.value = false
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open && item" class="cpreview-overlay" @click.self="close">
      <div class="panel cpreview-panel">
        <div class="panel-header cpreview-header">
          <h2 class="cpreview-title">Обзор контента</h2>
          <button class="icon-link" type="button" title="Закрыть" @click="close">
            <AppIcon name="i-lucide-x" />
          </button>
        </div>

        <div class="panel-body cpreview-body">
          <div class="cpreview-top">
            <div class="cpreview-poster">
              <DeferredImage :src="item.poster" :alt="item.title">
                <template #fallback><AppIcon name="i-lucide-image" /></template>
              </DeferredImage>
            </div>
            <div class="cpreview-info">
              <h3 class="cpreview-name">{{ item.title }}</h3>
              <div class="cpreview-badges">
                <span class="age-pill">{{ item.age }}</span>
                <span class="table-tag status-tag" :class="item.statusTone">{{ item.status }}</span>
                <span class="cpreview-rating">{{ item.rating }}</span>
              </div>
              <p class="cpreview-langs">
                <AppIcon name="i-lucide-languages" />
                <span v-if="loadingExtra">Загрузка…</span>
                <span v-else-if="audioLanguages.length">{{ audioLanguages.join(', ') }}</span>
                <span v-else class="cpreview-muted">Аудиодорожки не найдены</span>
              </p>
            </div>
          </div>

          <div v-if="item.description" class="cpreview-section">
            <span class="cpreview-label">Описание</span>
            <p class="cpreview-desc">{{ item.description }}</p>
          </div>

          <div class="cpreview-section">
            <span class="cpreview-label">Теги</span>
            <div v-if="visibleTags.length" class="tag-list">
              <span v-for="tag in visibleTags" :key="tag" class="table-tag">{{ tag }}</span>
              <NuxtLink v-if="hasMoreTags && item.detailRoute" class="tag-chip cpreview-more" :to="item.detailRoute">
                Подробнее…
              </NuxtLink>
            </div>
            <span v-else class="cpreview-muted">Тегов нет</span>
          </div>

          <div class="cpreview-section">
            <span class="cpreview-label">Последние комментарии</span>
            <div v-if="loadingExtra" class="cpreview-muted">Загрузка…</div>
            <div v-else-if="comments.length" class="cpreview-comments">
              <article v-for="(comment, index) in comments" :key="index" class="cpreview-comment">
                <span class="comment-avatar">{{ comment.author.slice(0, 2).toUpperCase() }}</span>
                <div class="cpreview-comment-body">
                  <strong>{{ comment.author }}</strong>
                  <small v-if="comment.time">{{ comment.time }}</small>
                  <p>{{ comment.body || 'Комментарий без текста' }}</p>
                </div>
              </article>
            </div>
            <span v-else class="cpreview-muted">Комментариев нет</span>
          </div>
        </div>

        <div class="panel-footer cpreview-footer">
          <NuxtLink v-if="item.detailRoute" class="button" :to="item.detailRoute">
            <AppIcon name="i-lucide-play" />
            Посмотреть видео
          </NuxtLink>
          <NuxtLink v-if="item.commentsPath" class="button secondary" :to="item.commentsPath">
            <AppIcon name="i-lucide-message-square-text" />
            Комментарии
          </NuxtLink>
          <NuxtLink v-if="item.statsRoute" class="button secondary" :to="item.statsRoute">
            <AppIcon name="i-lucide-bar-chart-3" />
            Статистика
          </NuxtLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpreview-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 54%);
  padding: 20px;
}

.cpreview-panel {
  width: min(720px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}

.cpreview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cpreview-title {
  margin: 0;
  font-size: 18px;
}

.cpreview-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.cpreview-top {
  display: flex;
  gap: 16px;
}

.cpreview-poster {
  width: 200px;
  aspect-ratio: 16 / 9;
  flex: 0 0 auto;
  border-radius: 10px;
  overflow: hidden;
  background: var(--faint, #1a1c22);
}

.cpreview-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.cpreview-name {
  margin: 0;
  font-size: 18px;
  line-height: 1.3;
}

.cpreview-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cpreview-rating {
  color: var(--muted);
  font-size: 13px;
}

.cpreview-langs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
}

.cpreview-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpreview-label {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cpreview-desc {
  margin: 0;
  line-height: 1.5;
}

.cpreview-more {
  border-style: dashed;
}

.cpreview-comments {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cpreview-comment {
  display: flex;
  gap: 10px;
}

.cpreview-comment-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cpreview-comment-body small {
  color: var(--muted);
  font-size: 12px;
}

.cpreview-comment-body p {
  margin: 2px 0 0;
  line-height: 1.45;
}

.cpreview-muted {
  color: var(--muted);
  font-size: 13px;
}

.cpreview-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 560px) {
  .cpreview-top {
    flex-direction: column;
  }

  .cpreview-poster {
    width: 100%;
  }
}
</style>
