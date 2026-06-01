<script setup lang="ts">
import type { UploadTask } from '~/stores/uploadQueue'

const uploadQueue = useUploadQueueStore()
const expanded = ref(false)
const responseOpen = ref<Record<string, boolean>>({})

const visibleTasks = computed(() => uploadQueue.tasks.slice(0, 5))
const activeCount = computed(() => uploadQueue.activeTasks.length)
const latestTask = computed(() => uploadQueue.tasks[0])

watch(
  () => activeCount.value,
  (count) => {
    if (count > 0) expanded.value = true
  }
)

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!uploadQueue.hasActiveTasks) return
  event.preventDefault()
  event.returnValue = ''
}

function statusLabel(task: UploadTask): string {
  const labels: Record<UploadTask['status'], string> = {
    queued: 'Ожидание',
    uploading: 'Загрузка',
    processing: 'Обработка',
    success: 'Готово',
    error: 'Ошибка',
    cancelled: 'Отменено'
  }
  return labels[task.status]
}

function statusIcon(task: UploadTask): string {
  const icons: Record<UploadTask['status'], string> = {
    queued: 'i-lucide-clock-3',
    uploading: 'i-lucide-loader-circle',
    processing: 'i-lucide-cpu',
    success: 'i-lucide-check-circle-2',
    error: 'i-lucide-circle-alert',
    cancelled: 'i-lucide-circle-x'
  }
  return icons[task.status]
}

function taskDetail(task: UploadTask): string {
  if (task.status === 'error') return task.error || 'Ошибка загрузки'
  if (task.status === 'cancelled') return 'Задача остановлена'
  if (task.status === 'success') return `API вернул ${task.responseStatus || '2xx'}`
  if (task.status === 'processing') return 'Файл отправлен, backend обрабатывает ответ'

  const parts = [formatBytes(task.uploadedBytes), '/', formatBytes(task.totalBytes)]
  if (task.etaSeconds !== undefined) parts.push(`, осталось ${formatDuration(task.etaSeconds)}`)
  else parts.push(', время считается после первых данных')
  return parts.join(' ')
}

function formatBytes(value: number): string {
  if (!value) return '0 Б'
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'меньше минуты'
  const rounded = Math.ceil(seconds)
  if (rounded < 60) return `${rounded} сек`
  const minutes = Math.floor(rounded / 60)
  const restSeconds = rounded % 60
  if (minutes < 60) return restSeconds ? `${minutes} мин ${restSeconds} сек` : `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} ч ${restMinutes} мин` : `${hours} ч`
}

function hasResponse(task: UploadTask): boolean {
  return task.response !== undefined
}

function responseText(task: UploadTask): string {
  if (task.response === undefined) return 'Ответ пустой'
  if (typeof task.response === 'string') return task.response || 'Ответ пустой'
  return JSON.stringify(task.response, null, 2)
}
</script>

<template>
  <div v-if="visibleTasks.length" class="upload-queue">
    <button class="upload-queue-toggle" type="button" @click="expanded = !expanded">
      <span class="upload-queue-toggle-main">
        <AppIcon :name="latestTask ? statusIcon(latestTask) : 'i-lucide-upload'" :spin="latestTask?.status === 'uploading'" />
        <span>
          <strong>{{ activeCount ? `Загрузки: ${activeCount}` : 'Загрузки' }}</strong>
          <small v-if="latestTask">{{ latestTask.label }}</small>
        </span>
      </span>
      <AppIcon :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" />
    </button>

    <div v-if="expanded" class="upload-queue-panel">
      <div class="upload-queue-header">
        <span>Фоновые загрузки</span>
        <button class="button secondary" type="button" @click="uploadQueue.clearFinished">
          <AppIcon name="i-lucide-eraser" />
          Очистить
        </button>
      </div>

      <div class="upload-task-list">
        <div v-for="task in visibleTasks" :key="task.id" class="upload-task">
          <div class="upload-task-top">
            <span class="upload-task-title">
              <AppIcon :name="statusIcon(task)" :spin="task.status === 'uploading'" />
              {{ task.label }}
            </span>
            <span class="badge" :class="task.status === 'error' ? 'danger' : task.status === 'success' ? 'success' : 'info'">
              {{ statusLabel(task) }}
            </span>
          </div>

          <div class="upload-progress" aria-hidden="true">
            <span :style="{ width: `${task.progress}%` }" />
          </div>

          <div class="upload-task-meta">
            <span>{{ task.progress }}%</span>
            <span>{{ taskDetail(task) }}</span>
          </div>

          <div class="upload-task-actions">
            <NuxtLink v-if="task.resultRoute" class="button secondary" :to="task.resultRoute">
              <AppIcon name="i-lucide-eye" />
              Открыть запись
            </NuxtLink>
            <button
              v-if="hasResponse(task)"
              class="button secondary"
              type="button"
              @click="responseOpen[task.id] = !responseOpen[task.id]"
            >
              <AppIcon name="i-lucide-braces" />
              Ответ API
            </button>
            <button
              v-if="['queued', 'uploading', 'processing'].includes(task.status)"
              class="button secondary"
              type="button"
              @click="uploadQueue.cancel(task.id)"
            >
              <AppIcon name="i-lucide-x" />
              Отменить
            </button>
            <button v-else class="button secondary" type="button" @click="uploadQueue.dismiss(task.id)">
              <AppIcon name="i-lucide-check" />
              Скрыть
            </button>
          </div>

          <pre v-if="responseOpen[task.id]" class="upload-task-response">{{ responseText(task) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
