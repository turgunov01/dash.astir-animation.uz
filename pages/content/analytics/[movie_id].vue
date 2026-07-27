<script setup lang="ts">
definePageMeta({ roles: ['admin', 'super_admin'] })

const route = useRoute()
const api = useApi()

const movieId = computed(() => String(route.params.movie_id || ''))

const DONUT_CIRCUMFERENCE = 2 * Math.PI * 52

function unwrap(response: unknown): Record<string, unknown> {
  const record = response as Record<string, unknown> | undefined
  const data = record?.data as Record<string, unknown> | undefined
  return data ?? record ?? {}
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function fmtInt(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
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

const { data, pending, error } = await useAsyncData(`analytics-${movieId.value}`, async () => {
  const id = movieId.value
  const [detailResult, statsResult, commentsResult, seriesResult] = await Promise.allSettled([
    api.get(`/v1/content/movies/${encodeURIComponent(id)}`),
    api.get(`/api/statistics/${encodeURIComponent(id)}`),
    api.get(`/api/v1/content/${encodeURIComponent(id)}/comments`),
    api.get(`/api/statistics/${encodeURIComponent(id)}/timeseries`, { days: 30 })
  ])

  const detail = detailResult.status === 'fulfilled' ? unwrap(detailResult.value) : {}
  const stats = statsResult.status === 'fulfilled' ? unwrap(statsResult.value) : {}
  const comments = commentsResult.status === 'fulfilled'
    ? normalizeList(commentsResult.value, 'comments').items
    : []
  const timeseries = seriesResult.status === 'fulfilled' ? unwrap(seriesResult.value) : {}

  return { detail, stats, comments, timeseries }
})

const detail = computed(() => data.value?.detail ?? {})
const stats = computed(() => data.value?.stats ?? {})
const comments = computed(() => data.value?.comments ?? [])

const title = computed(() => pickLocalized(getObjectValue(detail.value, 'title')) || String(getObjectValue(detail.value, 'name') || 'Контент'))
const views = computed(() => num(getResourceValue(stats.value, 'views') ?? getObjectValue(detail.value, 'views_count')))
const likes = computed(() => num(getResourceValue(stats.value, 'likes')))
const dislikes = computed(() => num(getResourceValue(stats.value, 'dislikes')))
const commentsCount = computed(() => comments.value.length)
const durationSec = computed(() => num(getObjectValue(detail.value, 'duration_sec') ?? getObjectValue(detail.value, 'durationSeconds')))

const reactionsTotal = computed(() => likes.value + dislikes.value)
const likeRatio = computed(() => (reactionsTotal.value > 0 ? likes.value / reactionsTotal.value : 0))
const likeRatioText = computed(() => (reactionsTotal.value > 0 ? `${Math.round(likeRatio.value * 100)}%` : '—'))
const donutOffset = computed(() => DONUT_CIRCUMFERENCE * (1 - likeRatio.value))
const engagementRate = computed(() => (views.value > 0 ? ((likes.value + dislikes.value + commentsCount.value) / views.value) * 100 : null))

const kpis = computed(() => [
  { title: 'Просмотры', value: fmtInt(views.value), icon: 'i-lucide-eye' },
  { title: 'Лайки', value: fmtInt(likes.value), icon: 'i-lucide-thumbs-up', tone: 'success' },
  { title: 'Дизлайки', value: fmtInt(dislikes.value), icon: 'i-lucide-thumbs-down', tone: 'danger' },
  { title: 'Комментарии', value: fmtInt(commentsCount.value), icon: 'i-lucide-message-square' },
  { title: 'Рейтинг лайков', value: likeRatioText.value, icon: 'i-lucide-heart', tone: 'success' },
  { title: 'Вовлечённость', value: engagementRate.value === null ? '—' : `${engagementRate.value.toFixed(1)}%`, icon: 'i-lucide-activity' }
])

const engagementBars = computed(() => {
  const items = [
    { label: 'Лайки', value: likes.value, cls: 'bar-success' },
    { label: 'Дизлайки', value: dislikes.value, cls: 'bar-danger' },
    { label: 'Комментарии', value: commentsCount.value, cls: 'bar-primary' }
  ]
  const max = Math.max(...items.map((item) => item.value), 1)
  return items.map((item) => ({ ...item, pct: Math.round((item.value / max) * 100) }))
})

const recentComments = computed(() => {
  return [...comments.value]
    .map((comment) => ({
      author: commentAuthor(comment),
      body: String(getResourceValue(comment, 'body') ?? getResourceValue(comment, 'text') ?? '').trim(),
      time: formatDateTime(getResourceValue(comment, 'createdAt') ?? getResourceValue(comment, 'created_at')),
      ts: commentTs(comment)
    }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5)
})

const isPublished = computed(() => Boolean(getObjectValue(detail.value, 'published')))
const isPremium = computed(() => Boolean(getObjectValue(detail.value, 'is_premium')))
const ageRating = computed(() => {
  const value = String(getObjectValue(detail.value, 'age_rating') ?? getObjectValue(detail.value, 'age') ?? '').trim()
  return value ? (value.endsWith('+') ? value : `${value}+`) : ''
})
const year = computed(() => {
  const value = num(getObjectValue(detail.value, 'year'))
  return value > 0 ? String(value) : ''
})

// --- daily views chart (hand-rolled SVG) ---
const CHART_W = 640
const CHART_H = 220
const PAD_L = 40
const PAD_R = 14
const PAD_T = 14
const PAD_B = 28

const viewsByDay = computed(() => {
  const raw = getResourceValue(data.value?.timeseries ?? {}, 'views_by_day')
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
})
const hasSeries = computed(() => viewsByDay.value.length > 0)
const chartMax = computed(() => Math.max(1, ...viewsByDay.value.flatMap((d) => [num(d.views), num(d.viewers)])))
const totalViewsPeriod = computed(() => viewsByDay.value.reduce((sum, d) => sum + num(d.views), 0))

function pointX(index: number, count: number): number {
  const innerW = CHART_W - PAD_L - PAD_R
  return count <= 1 ? PAD_L + innerW / 2 : PAD_L + (index / (count - 1)) * innerW
}
function pointY(value: number): number {
  const innerH = CHART_H - PAD_T - PAD_B
  return PAD_T + innerH - (value / chartMax.value) * innerH
}
function linePath(key: string): string {
  const rows = viewsByDay.value
  if (!rows.length) return ''
  return rows
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${pointX(i, rows.length).toFixed(1)},${pointY(num(d[key])).toFixed(1)}`)
    .join(' ')
}
const viewsPath = computed(() => linePath('views'))
const viewersPath = computed(() => linePath('viewers'))
const areaPath = computed(() => {
  const rows = viewsByDay.value
  if (!rows.length) return ''
  const base = CHART_H - PAD_B
  return `${viewsPath.value} L${pointX(rows.length - 1, rows.length).toFixed(1)},${base} L${pointX(0, rows.length).toFixed(1)},${base} Z`
})
const firstDay = computed(() => String(viewsByDay.value[0]?.day || ''))
const lastDay = computed(() => String(viewsByDay.value[viewsByDay.value.length - 1]?.day || ''))

// --- audience retention curve ---
const retentionData = computed(() => {
  const raw = getResourceValue(data.value?.timeseries ?? {}, 'retention_buckets')
  const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
  const counts = new Array(10).fill(0)
  for (const row of rows) {
    const bucket = num(row.bucket)
    if (bucket >= 1 && bucket <= 10) counts[bucket - 1] += num(row.viewers)
  }
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (total === 0) return [] as Array<{ pct: number; retention: number }>
  return counts.map((_, index) => {
    const reached = counts.slice(index).reduce((sum, value) => sum + value, 0)
    return { pct: index * 10, retention: Math.round((reached / total) * 100) }
  })
})
const hasRetention = computed(() => retentionData.value.length > 0)

function retentionX(index: number): number {
  const innerW = CHART_W - PAD_L - PAD_R
  return PAD_L + (index / 9) * innerW
}
function retentionY(pct: number): number {
  const innerH = CHART_H - PAD_T - PAD_B
  return PAD_T + innerH - (pct / 100) * innerH
}
const retentionPath = computed(() => {
  const points = retentionData.value
  if (!points.length) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${retentionX(i).toFixed(1)},${retentionY(p.retention).toFixed(1)}`)
    .join(' ')
})
const retentionArea = computed(() => {
  const points = retentionData.value
  if (!points.length) return ''
  const base = CHART_H - PAD_B
  return `${retentionPath.value} L${retentionX(points.length - 1).toFixed(1)},${base} L${retentionX(0).toFixed(1)},${base} Z`
})

// --- reactions & comments per day ---
const activityByDay = computed(() => {
  const ts = data.value?.timeseries ?? {}
  const reactions = getResourceValue(ts, 'reactions_by_day')
  const commentsSeries = getResourceValue(ts, 'comments_by_day')
  const map = new Map<string, { likes: number; dislikes: number; comments: number }>()
  const ensure = (day: string) => {
    let entry = map.get(day)
    if (!entry) {
      entry = { likes: 0, dislikes: 0, comments: 0 }
      map.set(day, entry)
    }
    return entry
  }

  if (Array.isArray(reactions)) {
    for (const row of reactions as Record<string, unknown>[]) {
      const day = String(getResourceValue(row, 'day') || '')
      if (!day) continue
      const entry = ensure(day)
      entry.likes += num(row.likes)
      entry.dislikes += num(row.dislikes)
    }
  }
  if (Array.isArray(commentsSeries)) {
    for (const row of commentsSeries as Record<string, unknown>[]) {
      const day = String(getResourceValue(row, 'day') || '')
      if (!day) continue
      ensure(day).comments += num(row.comments)
    }
  }

  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, value]) => ({ day, ...value }))
})
const hasActivity = computed(() => activityByDay.value.length > 0)
const activityMax = computed(() => Math.max(1, ...activityByDay.value.flatMap((d) => [d.likes, d.dislikes, d.comments])))

function activityX(index: number, count: number): number {
  const innerW = CHART_W - PAD_L - PAD_R
  return count <= 1 ? PAD_L + innerW / 2 : PAD_L + (index / (count - 1)) * innerW
}
function activityY(value: number): number {
  const innerH = CHART_H - PAD_T - PAD_B
  return PAD_T + innerH - (value / activityMax.value) * innerH
}
function activityPath(key: 'likes' | 'dislikes' | 'comments'): string {
  const rows = activityByDay.value
  if (!rows.length) return ''
  return rows
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${activityX(i, rows.length).toFixed(1)},${activityY(d[key]).toFixed(1)}`)
    .join(' ')
}
const likesPath = computed(() => activityPath('likes'))
const dislikesPath = computed(() => activityPath('dislikes'))
const commentsPath = computed(() => activityPath('comments'))
</script>

<template>
  <section class="analytics-page">
    <div class="page-header">
      <div>
        <NuxtLink class="button secondary small-action analytics-back" to="/content/movies">
          <AppIcon name="i-lucide-chevron-left" />
          К каталогу
        </NuxtLink>
        <h1 class="page-title">Аналитика · {{ title }}</h1>
        <div class="analytics-meta">
          <span class="badge" :class="isPublished ? 'info' : 'neutral'">{{ isPublished ? 'Опубликовано' : 'Черновик' }}</span>
          <span v-if="isPremium" class="badge warning">Premium</span>
          <span v-if="ageRating" class="badge neutral">{{ ageRating }}</span>
          <span v-if="year" class="badge neutral">{{ year }}</span>
          <span class="badge neutral">⏱ {{ fmtDuration(durationSec) }}</span>
          <span class="analytics-id">ID: {{ movieId }}</span>
        </div>
      </div>
      <NuxtLink class="button secondary" :to="`/content/movies/${movieId}`">
        <AppIcon name="i-lucide-pencil" />
        Редактировать
      </NuxtLink>
    </div>

    <ApiErrorAlert v-if="error" :error="String(error)" />
    <div v-if="pending" class="loading-state">Загрузка статистики...</div>

    <template v-else>
      <div class="analytics-kpis">
        <MetricCard
          v-for="kpi in kpis"
          :key="kpi.title"
          :title="kpi.title"
          :value="kpi.value"
          :icon="kpi.icon"
          :tone="kpi.tone"
        />
      </div>

      <div class="analytics-grid">
        <div class="panel">
          <div class="panel-header">
            <h2 class="analytics-chart-title">Реакции</h2>
          </div>
          <div class="panel-body analytics-reactions">
            <svg class="donut" viewBox="0 0 120 120" role="img" :aria-label="`Рейтинг лайков ${likeRatioText}`">
              <circle class="donut-track" cx="60" cy="60" r="52" />
              <circle
                class="donut-value"
                cx="60"
                cy="60"
                r="52"
                :stroke-dasharray="DONUT_CIRCUMFERENCE"
                :stroke-dashoffset="donutOffset"
                transform="rotate(-90 60 60)"
              />
              <text class="donut-text" x="60" y="58">{{ likeRatioText }}</text>
              <text class="donut-sub" x="60" y="76">лайков</text>
            </svg>
            <div class="reactions-legend">
              <div class="legend-row">
                <span class="legend-dot dot-success" />
                <span>Лайки</span>
                <strong>{{ fmtInt(likes) }}</strong>
              </div>
              <div class="legend-row">
                <span class="legend-dot dot-danger" />
                <span>Дизлайки</span>
                <strong>{{ fmtInt(dislikes) }}</strong>
              </div>
              <div class="legend-row">
                <span class="legend-dot dot-muted" />
                <span>Всего реакций</span>
                <strong>{{ fmtInt(reactionsTotal) }}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h2 class="analytics-chart-title">Вовлечённость</h2>
          </div>
          <div class="panel-body analytics-bars">
            <div v-for="bar in engagementBars" :key="bar.label" class="bar-row">
              <span class="bar-label">{{ bar.label }}</span>
              <div class="bar-track">
                <span class="bar-fill" :class="bar.cls" :style="{ width: `${bar.pct}%` }" />
              </div>
              <strong class="bar-value">{{ fmtInt(bar.value) }}</strong>
            </div>
            <p class="bars-note">
              Вовлечённость = (лайки + дизлайки + комментарии) / просмотры =
              <strong>{{ engagementRate === null ? '—' : `${engagementRate.toFixed(1)}%` }}</strong>
            </p>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="analytics-chart-title">Последние комментарии</h2>
          <span class="badge neutral">{{ commentsCount }}</span>
        </div>
        <div class="panel-body">
          <div v-if="recentComments.length" class="analytics-comments">
            <article v-for="(comment, index) in recentComments" :key="index" class="analytics-comment">
              <span class="comment-avatar">{{ comment.author.slice(0, 2).toUpperCase() }}</span>
              <div class="analytics-comment-body">
                <strong>{{ comment.author }}</strong>
                <small v-if="comment.time">{{ comment.time }}</small>
                <p>{{ comment.body || 'Комментарий без текста' }}</p>
              </div>
            </article>
          </div>
          <p v-else class="analytics-muted">Комментариев пока нет.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="analytics-chart-title">Просмотры по дням</h2>
          <span class="badge neutral">30 дней · {{ fmtInt(totalViewsPeriod) }}</span>
        </div>
        <div class="panel-body">
          <div v-if="hasSeries">
            <svg class="line-chart" :viewBox="`0 0 ${CHART_W} ${CHART_H}`" role="img" aria-label="Просмотры по дням">
              <line class="chart-axis" :x1="PAD_L" :y1="CHART_H - PAD_B" :x2="CHART_W - PAD_R" :y2="CHART_H - PAD_B" />
              <path class="chart-area" :d="areaPath" />
              <path class="chart-line chart-views" :d="viewsPath" />
              <path class="chart-line chart-viewers" :d="viewersPath" />
            </svg>
            <div class="chart-x">
              <span>{{ firstDay }}</span>
              <span>{{ lastDay }}</span>
            </div>
            <div class="chart-legend">
              <span><i class="legend-dot dot-success" /> Просмотры</span>
              <span><i class="legend-dot dot-primary" /> Уник. зрители</span>
              <span class="chart-max">макс/день: {{ fmtInt(chartMax) }}</span>
            </div>
          </div>
          <p v-else class="analytics-muted">
            Нет событий просмотра за 30 дней. Данные появятся, когда бэкенд с endpoint'ом
            <code>/api/statistics/{id}/timeseries</code> будет задеплоен и начнут накапливаться просмотры.
          </p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="analytics-chart-title">Реакции и комментарии по дням</h2>
          <span class="badge neutral">30 дней</span>
        </div>
        <div class="panel-body">
          <div v-if="hasActivity">
            <svg class="line-chart" :viewBox="`0 0 ${CHART_W} ${CHART_H}`" role="img" aria-label="Реакции и комментарии по дням">
              <line class="chart-axis" :x1="PAD_L" :y1="CHART_H - PAD_B" :x2="CHART_W - PAD_R" :y2="CHART_H - PAD_B" />
              <path class="chart-line chart-views" :d="likesPath" />
              <path class="chart-line chart-danger-line" :d="dislikesPath" />
              <path class="chart-line chart-comments" :d="commentsPath" />
            </svg>
            <div class="chart-legend">
              <span><i class="legend-dot dot-success" /> Лайки</span>
              <span><i class="legend-dot dot-danger" /> Дизлайки</span>
              <span><i class="legend-dot dot-primary" /> Комментарии</span>
              <span class="chart-max">макс/день: {{ fmtInt(activityMax) }}</span>
            </div>
          </div>
          <p v-else class="analytics-muted">Нет реакций и комментариев за период (появится после деплоя бэкенда).</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2 class="analytics-chart-title">Удержание аудитории</h2>
          <span class="badge neutral">% досмотра</span>
        </div>
        <div class="panel-body">
          <div v-if="hasRetention">
            <svg class="line-chart" :viewBox="`0 0 ${CHART_W} ${CHART_H}`" role="img" aria-label="Удержание аудитории">
              <line class="chart-axis" :x1="PAD_L" :y1="CHART_H - PAD_B" :x2="CHART_W - PAD_R" :y2="CHART_H - PAD_B" />
              <path class="chart-area chart-area-retention" :d="retentionArea" />
              <path class="chart-line chart-retention" :d="retentionPath" />
            </svg>
            <div class="chart-x">
              <span>Начало</span>
              <span>Середина</span>
              <span>Конец</span>
            </div>
            <p class="bars-note">Доля зрителей, досмотревших до отметки видео (по последней сохранённой позиции просмотра).</p>
          </div>
          <p v-else class="analytics-muted">
            Недостаточно данных о просмотре (нужны <code>watch_progress</code> и длительность контента) —
            появится после деплоя бэкенда и накопления просмотров.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.analytics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analytics-back {
  margin-bottom: 8px;
}

.analytics-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.analytics-id {
  color: var(--muted);
  font-size: 12px;
}

.analytics-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.analytics-chart-title {
  margin: 0;
  font-size: 16px;
}

.analytics-reactions {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.donut {
  width: 150px;
  height: 150px;
  flex: 0 0 auto;
}

.donut-track {
  fill: none;
  stroke: var(--surface-soft);
  stroke-width: 14;
}

.donut-value {
  fill: none;
  stroke: var(--primary, #10b981);
  stroke-width: 14;
  stroke-linecap: round;
  transition: stroke-dashoffset 500ms ease;
}

.donut-text {
  fill: var(--text, currentColor);
  font-size: 22px;
  font-weight: 700;
  text-anchor: middle;
}

.donut-sub {
  fill: var(--muted);
  font-size: 10px;
  text-anchor: middle;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.reactions-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-row strong {
  margin-left: auto;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-success { background: var(--primary, #10b981); }
.dot-danger { background: #dc2626; }
.dot-muted { background: var(--muted, #888); }

.analytics-bars {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bar-row {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  align-items: center;
  gap: 12px;
}

.bar-label {
  color: var(--muted);
  font-size: 13px;
}

.bar-track {
  height: 10px;
  border-radius: 999px;
  background: var(--surface-soft);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 500ms ease;
}

.bar-success { background: var(--primary, #10b981); }
.bar-danger { background: #dc2626; }
.bar-primary { background: #3b82f6; }

.bars-note {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.analytics-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analytics-comment {
  display: flex;
  gap: 10px;
}

.analytics-comment-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.analytics-comment-body small {
  color: var(--muted);
  font-size: 12px;
}

.analytics-comment-body p {
  margin: 2px 0 0;
  line-height: 1.45;
}

.analytics-muted {
  color: var(--muted);
  margin: 0;
}

.analytics-soon .panel-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--muted);
}

.analytics-soon code {
  background: var(--surface-soft);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}

.analytics-soon p {
  margin: 4px 0 0;
  line-height: 1.5;
}

.line-chart {
  width: 100%;
  height: auto;
  display: block;
}

.chart-axis {
  stroke: var(--border, #26282c);
  stroke-width: 1;
}

.chart-area {
  fill: color-mix(in srgb, var(--primary, #10b981) 13%, transparent);
  stroke: none;
}

.chart-line {
  fill: none;
  stroke-width: 2;
}

.chart-views {
  stroke: var(--primary, #10b981);
}

.chart-viewers {
  stroke: #3b82f6;
  stroke-dasharray: 5 3;
}

.chart-x {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--muted);
  font-size: 13px;
  margin-top: 8px;
}

.chart-legend .chart-max {
  margin-left: auto;
}

.chart-legend .legend-dot {
  display: inline-block;
  margin-right: 4px;
  vertical-align: middle;
}

.dot-primary {
  background: #3b82f6;
}

.chart-retention {
  stroke: #f59e0b;
}

.chart-area-retention {
  fill: color-mix(in srgb, #f59e0b 13%, transparent);
}

.chart-danger-line {
  stroke: #dc2626;
}

.chart-comments {
  stroke: #3b82f6;
  stroke-dasharray: 5 3;
}
</style>
