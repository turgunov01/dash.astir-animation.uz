<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const props = withDefaults(
  defineProps<{
    initialChatId?: string | number
  }>(),
  {
    initialChatId: ''
  }
)

const api = useApi()

const chats = ref<Record<string, unknown>[]>([])
const selectedChatId = ref('')
const selectedChatDetail = ref<Record<string, unknown> | null>(null)
const messages = ref<Record<string, unknown>[]>([])
const search = ref('')
const replyText = ref('')
const loadingChats = ref(false)
const loadingMessages = ref(false)
const sending = ref(false)
const markingRead = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const messagesPane = ref<HTMLElement | null>(null)

const filteredChats = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return chats.value

  return chats.value.filter((chat) => {
    const haystack = [
      chatTitle(chat),
      chatSubtitle(chat),
      lastMessagePreview(chat),
      String(getItemId(chat) || '')
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  })
})

const selectedChat = computed(() => {
  return (
    selectedChatDetail.value ||
    chats.value.find((chat) => String(getItemId(chat)) === selectedChatId.value) ||
    null
  )
})

onMounted(async () => {
  await loadChats()

  const preferredId = String(props.initialChatId || '')
  if (preferredId) {
    await selectChat(preferredId)
    return
  }

  const firstChatId = chats.value.map((chat) => String(getItemId(chat) || '')).find(Boolean)
  if (firstChatId) await selectChat(firstChatId)
})

watch(
  () => props.initialChatId,
  async (id) => {
    const nextId = String(id || '')
    if (nextId && nextId !== selectedChatId.value) await selectChat(nextId)
  }
)

async function loadChats() {
  loadingChats.value = true
  error.value = null

  try {
    const response = await api.get('/api/v1/admin/support/chats', { limit: 100 })
    chats.value = normalizeList(response, 'chats').items
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    chats.value = []
  } finally {
    loadingChats.value = false
  }
}

async function selectChat(chatId: string | number) {
  const id = String(chatId || '')
  if (!id) return

  selectedChatId.value = id
  await loadSelectedChat(id)
}

async function loadSelectedChat(chatId = selectedChatId.value) {
  if (!chatId) return

  loadingMessages.value = true
  error.value = null

  try {
    const [detailResponse, messagesResponse] = await Promise.all([
      api.get(`/api/v1/admin/support/chats/${encodeURIComponent(chatId)}`).catch(() => null),
      api.get(`/api/v1/admin/support/chats/${encodeURIComponent(chatId)}/messages`)
    ])

    selectedChatDetail.value = detailResponse
      ? unwrapPayload<Record<string, unknown>>(detailResponse, 'chat')
      : chats.value.find((chat) => String(getItemId(chat)) === chatId) || null
    messages.value = sortMessagesByTime(normalizeList(messagesResponse, 'messages').items)
    await scrollMessagesToBottom()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    messages.value = []
  } finally {
    loadingMessages.value = false
  }
}

async function refreshCurrentChat() {
  await loadChats()
  if (selectedChatId.value) await loadSelectedChat()
}

async function sendMessage() {
  const message = replyText.value.trim()
  if (!message || !selectedChatId.value || sending.value) return

  sending.value = true
  error.value = null

  try {
    const body = new FormData()
    body.append('body', message)

    await api.post(`/api/v1/admin/support/chats/${encodeURIComponent(selectedChatId.value)}/messages`, body)
    replyText.value = ''
    await refreshCurrentChat()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    sending.value = false
  }
}

async function markCurrentChatRead() {
  if (!selectedChatId.value || markingRead.value) return

  markingRead.value = true
  error.value = null

  try {
    await api.post(`/api/v1/admin/support/chats/${encodeURIComponent(selectedChatId.value)}/read`)
    await refreshCurrentChat()
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    markingRead.value = false
  }
}

async function scrollMessagesToBottom() {
  await nextTick()
  if (!messagesPane.value) return
  messagesPane.value.scrollTop = messagesPane.value.scrollHeight
}

function chatTitle(chat: Record<string, unknown> | null | undefined): string {
  if (!chat) return 'Без имени'

  const userName = userDisplayName(getResourceValue(chat, 'user'))
  if (userName) return userName

  return firstText([
    getResourceValue(chat, 'parent.name'),
    getResourceValue(chat, 'name'),
    getResourceValue(chat, 'user.email'),
    getResourceValue(chat, 'user.phone'),
    getResourceValue(chat, 'parent.email'),
    getResourceValue(chat, 'email'),
    getResourceValue(chat, 'user_id'),
    getResourceValue(chat, 'userId')
  ]) || 'Без имени'
}

function chatSubtitle(chat: Record<string, unknown> | null | undefined): string {
  if (!chat) return ''

  return firstText([
    getResourceValue(chat, 'user.email'),
    getResourceValue(chat, 'user.phone'),
    getResourceValue(chat, 'parent.email'),
    getResourceValue(chat, 'email'),
    getResourceValue(chat, 'status')
  ])
}

function userDisplayName(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

  const user = value as Record<string, unknown>
  const fullName = [
    firstText([getResourceValue(user, 'name'), getResourceValue(user, 'first_name'), getResourceValue(user, 'firstName')]),
    firstText([getResourceValue(user, 'last_name'), getResourceValue(user, 'lastName'), getResourceValue(user, 'surname')])
  ].filter(Boolean).join(' ').trim()

  return fullName || firstText([
    getResourceValue(user, 'email'),
    getResourceValue(user, 'phone'),
    getResourceValue(user, 'id')
  ])
}

function lastMessagePreview(chat: Record<string, unknown>): string {
  const value =
    getResourceValue(chat, 'last_message_preview') ??
    getResourceValue(chat, 'lastMessagePreview') ??
    getResourceValue(chat, 'lastMessage') ??
    getResourceValue(chat, 'last_message') ??
    getResourceValue(chat, 'lastMessageText') ??
    getResourceValue(chat, 'last_message_text')

  if (value && typeof value === 'object') return messageText(value as Record<string, unknown>)
  return firstText([value]) || 'Нет сообщений'
}

function unreadCount(chat: Record<string, unknown> | null | undefined): number {
  if (!chat) return 0

  const count = Number(
    getResourceValue(chat, 'unreadCount') ??
      getResourceValue(chat, 'unread_count') ??
      getResourceValue(chat, 'admin_unread_count') ??
      getResourceValue(chat, 'adminUnreadCount') ??
      getResourceValue(chat, 'unreadMessages') ??
      0
  )

  return Number.isFinite(count) ? count : 0
}

function chatStatus(chat: Record<string, unknown> | null | undefined): string {
  const status = String(getResourceValue(chat, 'status') || '').toLowerCase()
  if (['open', 'active', 'new'].includes(status)) return 'в сети'
  if (['pending', 'waiting'].includes(status)) return 'ожидает ответа'
  if (['closed', 'resolved'].includes(status)) return 'закрыт'
  return chatSubtitle(chat) || 'чат поддержки'
}

function chatTime(chat: Record<string, unknown>): string {
  return formatShortTime(
    getResourceValue(chat, 'lastMessage.createdAt') ??
      getResourceValue(chat, 'last_message.created_at') ??
      getResourceValue(chat, 'last_message_at') ??
      getResourceValue(chat, 'lastMessageAt') ??
      getResourceValue(chat, 'updatedAt') ??
      getResourceValue(chat, 'createdAt')
  )
}

function messageText(message: Record<string, unknown>): string {
  return firstText([
    getResourceValue(message, 'body'),
    getResourceValue(message, 'message'),
    getResourceValue(message, 'text'),
    getResourceValue(message, 'content'),
    message
  ]) || 'Сообщение без текста'
}

function messageAttachment(message: Record<string, unknown>): string {
  return firstText([
    getResourceValue(message, 'attachmentPath'),
    getResourceValue(message, 'attachment_path'),
    getResourceValue(message, 'attachment_url'),
    getResourceValue(message, 'attachmentUrl'),
    getResourceValue(message, 'attachment.url'),
    getResourceValue(message, 'file.url'),
    getResourceValue(message, 'url')
  ])
}

function messageAuthor(message: Record<string, unknown>): string {
  if (isOutgoingMessage(message)) return 'Админ'

  return firstText([
    getResourceValue(message, 'user.name'),
    getResourceValue(message, 'author.name'),
    getResourceValue(message, 'sender.name'),
    getResourceValue(message, 'user.email')
  ]) || chatTitle(selectedChat.value)
}

function messageTime(message: Record<string, unknown>): string {
  return formatShortTime(messageTimestampValue(message))
}

function sortMessagesByTime(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items
    .map((message, index) => ({ message, index, time: messageTimestamp(message) }))
    .sort((left, right) => {
      if (left.time === right.time) return left.index - right.index
      if (left.time === undefined) return 1
      if (right.time === undefined) return -1
      return left.time - right.time
    })
    .map((entry) => entry.message)
}

function messageTimestamp(message: Record<string, unknown>): number | undefined {
  const value = messageTimestampValue(message)
  if (!value) return undefined

  const time = new Date(String(value)).getTime()
  return Number.isNaN(time) ? undefined : time
}

function messageTimestampValue(message: Record<string, unknown>): unknown {
  return (
    getResourceValue(message, 'created_at') ??
    getResourceValue(message, 'createdAt') ??
    getResourceValue(message, 'sent_at') ??
    getResourceValue(message, 'sentAt') ??
    getResourceValue(message, 'timestamp') ??
    getResourceValue(message, 'updated_at') ??
    getResourceValue(message, 'updatedAt')
  )
}

function isOutgoingMessage(message: Record<string, unknown>): boolean {
  const direct =
    getResourceValue(message, 'fromAdmin') ??
    getResourceValue(message, 'from_admin') ??
    getResourceValue(message, 'isAdmin') ??
    getResourceValue(message, 'is_admin') ??
    getResourceValue(message, 'outgoing')

  if (direct !== undefined && direct !== null && direct !== '') return normalizeBoolean(direct)

  const sender = String(
    getResourceValue(message, 'senderRole') ??
      getResourceValue(message, 'sender_role') ??
      getResourceValue(message, 'sender.type') ??
      getResourceValue(message, 'author.role') ??
      getResourceValue(message, 'role') ??
      getResourceValue(message, 'direction') ??
      ''
  ).toLowerCase()

  return ['admin', 'support', 'operator', 'manager', 'out', 'outgoing'].includes(sender)
}

function avatarInitials(value: string): string {
  const normalized = value.replace(/@.*/, '').trim()
  const parts = normalized.split(/\s+/).filter(Boolean)

  if (!parts.length) return 'Ч'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    const text = extractTextValue(value)
    if (text) return text
  }

  return ''
}

function extractTextValue(value: unknown, seen = new WeakSet<object>()): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (!value || typeof value !== 'object') return ''

  const record = value as Record<string, unknown>
  if (seen.has(record)) return ''
  seen.add(record)

  for (const key of [
    'body',
    'message',
    'text',
    'content',
    'value',
    'caption',
    'description',
    'title',
    'name',
    'preview',
    'last_message_preview',
    'lastMessagePreview',
    'ru',
    'uz',
    'en'
  ]) {
    const text = extractTextValue(getObjectValue(record, key), seen)
    if (text) return text
  }

  for (const key of ['data', 'payload', 'metadata', 'message', 'content', 'item', 'record']) {
    const text = extractTextValue(getObjectValue(record, key), seen)
    if (text) return text
  }

  return ''
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  return ['true', '1', 'yes', 'admin', 'out', 'outgoing'].includes(String(value).toLowerCase())
}

function formatShortTime(value: unknown): string {
  if (!value) return ''

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit'
  }).format(date)
}
</script>

<template>
  <section class="telegram-page">
    <ApiErrorAlert :error="error" />

    <div class="telegram-inbox">
      <aside class="telegram-sidebar-panel">
        <div class="telegram-sidebar-head">
          <h1>Чаты</h1>
          <button class="telegram-icon-button" type="button" title="Обновить" :disabled="loadingChats" @click="refreshCurrentChat">
            <AppIcon name="i-lucide-refresh-cw" :spin="loadingChats" />
          </button>
        </div>

        <label class="telegram-search">
          <AppIcon name="i-lucide-search" />
          <input v-model="search" type="search" placeholder="Поиск">
        </label>

        <div class="telegram-chat-list">
          <div v-if="loadingChats" class="telegram-list-state">Загрузка чатов...</div>
          <div v-else-if="!filteredChats.length" class="telegram-list-state">Нет чатов</div>

          <button
            v-for="chat in filteredChats"
            v-else
            :key="String(getItemId(chat) || JSON.stringify(chat))"
            class="telegram-chat-item"
            :class="{ active: String(getItemId(chat)) === selectedChatId }"
            type="button"
            @click="selectChat(String(getItemId(chat) || ''))"
          >
            <span class="telegram-avatar">{{ avatarInitials(chatTitle(chat)) }}</span>
            <span class="telegram-chat-summary">
              <span class="telegram-chat-topline">
                <strong>{{ chatTitle(chat) }}</strong>
                <time>{{ chatTime(chat) }}</time>
              </span>
              <span class="telegram-chat-bottomline">
                <span>{{ lastMessagePreview(chat) }}</span>
                <b v-if="unreadCount(chat)">{{ unreadCount(chat) }}</b>
              </span>
            </span>
          </button>
        </div>
      </aside>

      <main class="telegram-conversation">
        <div v-if="!selectedChat" class="telegram-empty-chat">
          <AppIcon name="i-lucide-message-circle" />
          <span>Выберите чат</span>
        </div>

        <template v-else>
          <header class="telegram-chat-header">
            <div class="telegram-chat-identity">
              <span class="telegram-avatar large">{{ avatarInitials(chatTitle(selectedChat)) }}</span>
              <div>
                <h2>{{ chatTitle(selectedChat) }}</h2>
                <p>{{ chatStatus(selectedChat) }}</p>
              </div>
            </div>

            <div class="telegram-chat-actions">
              <button class="telegram-icon-button" type="button" title="Прочитано" :disabled="markingRead" @click="markCurrentChatRead">
                <AppIcon name="i-lucide-check-check" />
              </button>
              <button class="telegram-icon-button" type="button" title="Обновить" :disabled="loadingMessages" @click="refreshCurrentChat">
                <AppIcon name="i-lucide-refresh-cw" :spin="loadingMessages" />
              </button>
            </div>
          </header>

          <div ref="messagesPane" class="telegram-message-list">
            <div v-if="loadingMessages" class="telegram-message-state">Загрузка сообщений...</div>
            <div v-else-if="!messages.length" class="telegram-message-state">Сообщений пока нет</div>

            <div
              v-for="message in messages"
              v-else
              :key="String(getItemId(message) || JSON.stringify(message))"
              class="telegram-message-row"
              :class="{ outgoing: isOutgoingMessage(message), incoming: !isOutgoingMessage(message) }"
            >
              <article class="telegram-bubble">
                <strong v-if="!isOutgoingMessage(message)" class="telegram-message-author">{{ messageAuthor(message) }}</strong>
                <p>{{ messageText(message) }}</p>
                <a v-if="messageAttachment(message)" :href="messageAttachment(message)" target="_blank" rel="noreferrer">
                  <AppIcon name="i-lucide-paperclip" />
                  Вложение
                </a>
                <time>{{ messageTime(message) }}</time>
              </article>
            </div>
          </div>

          <form class="telegram-composer" @submit.prevent="sendMessage">
            <textarea
              v-model="replyText"
              rows="1"
              placeholder="Сообщение"
              :disabled="sending"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <button class="telegram-send-button" type="submit" title="Отправить" :disabled="sending || !replyText.trim()">
              <AppIcon name="i-lucide-send-horizontal" />
            </button>
          </form>
        </template>
      </main>
    </div>
  </section>
</template>
