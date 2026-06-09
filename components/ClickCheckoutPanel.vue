<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

const api = useApi()

const tariffs = ref<Record<string, unknown>[]>([])
const tariffId = ref('')
const returnUrl = ref('')
const cardType = ref('')
const transactionId = ref('')
const loadingTariffs = ref(false)
const checkoutLoading = ref(false)
const statusLoading = ref(false)
const subscriptionLoading = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const checkoutResult = ref<unknown>(null)
const statusResult = ref<unknown>(null)
const subscriptionResult = ref<unknown>(null)

const selectedTariff = computed(() => tariffs.value.find((tariff) => String(getItemId(tariff)) === tariffId.value) || null)
const paymentUrl = computed(() => String(getResourceValue(checkoutResult.value, 'payment_url') || ''))
const checkoutTransactionId = computed(() => {
  const value =
    getResourceValue(checkoutResult.value, 'transaction.id') ??
    getResourceValue(checkoutResult.value, 'transaction_id') ??
    getResourceValue(checkoutResult.value, 'transactionId')

  return value === undefined || value === null ? '' : String(value)
})

onMounted(loadTariffs)

async function loadTariffs() {
  loadingTariffs.value = true
  error.value = null

  try {
    const response = await api.get('/v1/tariffs', { limit: 100 })
    tariffs.value = normalizeList(response, 'tariffs').items

    if (!tariffId.value && tariffs.value.length) {
      const premium = tariffs.value.find((tariff) => Boolean(getResourceValue(tariff, 'can_watch_premium')))
      tariffId.value = String(getItemId(premium || tariffs.value[0]) || '')
    }
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
    tariffs.value = []
  } finally {
    loadingTariffs.value = false
  }
}

async function createCheckout() {
  if (!tariffId.value) {
    error.value = { message: 'Выберите тариф.' }
    return
  }

  checkoutLoading.value = true
  error.value = null
  checkoutResult.value = null

  try {
    const body: Record<string, unknown> = {
      tariff_id: tariffId.value,
      return_url: returnUrl.value.trim() || undefined,
      card_type: cardType.value || undefined
    }

    checkoutResult.value = await api.post('/v1/billing/click/checkout', cleanBody(body))
    if (checkoutTransactionId.value) transactionId.value = checkoutTransactionId.value
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    checkoutLoading.value = false
  }
}

async function checkTransactionStatus() {
  const id = transactionId.value.trim()
  if (!id) {
    error.value = { message: 'Укажите Transaction ID.' }
    return
  }

  statusLoading.value = true
  error.value = null

  try {
    statusResult.value = await api.get(`/v1/billing/click/transactions/${encodeURIComponent(id)}`)
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    statusLoading.value = false
  }
}

async function loadCurrentSubscription() {
  subscriptionLoading.value = true
  error.value = null

  try {
    subscriptionResult.value = await api.get('/v1/billing/subscription/current')
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  } finally {
    subscriptionLoading.value = false
  }
}

function cleanBody(body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== ''))
}

function tariffLabel(tariff: Record<string, unknown>) {
  const id = getItemId(tariff)
  const title = pickLocalized(getResourceValue(tariff, 'title')) || String(getResourceValue(tariff, 'name') || id || 'Тариф')
  const price = priceLabel(tariff)
  return price ? `${title} · ${price}` : title
}

function priceLabel(tariff: Record<string, unknown> | null) {
  if (!tariff) return ''
  const price = getResourceValue(tariff, 'price')
  const currency = String(getResourceValue(tariff, 'currency') || '').trim()
  if (price === undefined || price === null || price === '') return currency
  return [String(price), currency].filter(Boolean).join(' ')
}

function resultText(value: unknown) {
  return value === undefined || value === null ? '' : JSON.stringify(value, null, 2)
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 18px;">Click checkout</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">
          Создает оплату через backend. Amount, prepare и complete не отправляются из админки.
        </p>
      </div>
      <button class="button secondary" type="button" :disabled="loadingTariffs" @click="loadTariffs">
        <AppIcon name="i-lucide-refresh-cw" />
        Тарифы
      </button>
    </div>

    <div class="panel-body">
      <ApiErrorAlert :error="error" />

      <form class="click-checkout-form" @submit.prevent="createCheckout">
        <label class="field">
          <span class="field-label">Тариф</span>
          <select v-model="tariffId" class="select" :disabled="loadingTariffs">
            <option value="">Выберите тариф</option>
            <option v-for="tariff in tariffs" :key="String(getItemId(tariff))" :value="String(getItemId(tariff))">
              {{ tariffLabel(tariff) }}
            </option>
          </select>
          <small v-if="selectedTariff" class="field-hint">
            Цена из backend: {{ priceLabel(selectedTariff) || '—' }}
          </small>
        </label>

        <label class="field">
          <span class="field-label">Return URL</span>
          <input v-model="returnUrl" class="input" type="text" placeholder="yourapp://payment-return">
        </label>

        <label class="field">
          <span class="field-label">Card type</span>
          <select v-model="cardType" class="select">
            <option value="">Не отправлять</option>
            <option value="uzcard">uzcard</option>
            <option value="humo">humo</option>
          </select>
        </label>

        <button class="button" type="submit" :disabled="checkoutLoading || !tariffId">
          <AppIcon :name="checkoutLoading ? 'i-lucide-loader-circle' : 'i-lucide-credit-card'" :spin="checkoutLoading" />
          Создать оплату
        </button>
      </form>

      <div v-if="checkoutResult" class="click-result-grid">
        <div class="click-result-row">
          <span>Payment URL</span>
          <div>
            <a v-if="paymentUrl" class="button secondary" :href="paymentUrl" target="_blank" rel="noreferrer">
              <AppIcon name="i-lucide-external-link" />
              Открыть Click
            </a>
            <span v-else>—</span>
          </div>
        </div>
        <div class="click-result-row">
          <span>Transaction ID</span>
          <div class="click-inline-actions">
            <strong>{{ checkoutTransactionId || '—' }}</strong>
            <CopyButton v-if="checkoutTransactionId" :value="checkoutTransactionId" label="Скопировать" />
          </div>
        </div>
        <pre class="code">{{ resultText(checkoutResult) }}</pre>
      </div>

      <div class="click-status-tools">
        <form class="click-status-form" @submit.prevent="checkTransactionStatus">
          <label class="field">
            <span class="field-label">Transaction ID</span>
            <input v-model="transactionId" class="input" type="text" placeholder="transaction-id">
          </label>
          <button class="button secondary" type="submit" :disabled="statusLoading || !transactionId.trim()">
            <AppIcon :name="statusLoading ? 'i-lucide-loader-circle' : 'i-lucide-search'" :spin="statusLoading" />
            Проверить статус
          </button>
        </form>

        <button class="button secondary" type="button" :disabled="subscriptionLoading" @click="loadCurrentSubscription">
          <AppIcon :name="subscriptionLoading ? 'i-lucide-loader-circle' : 'i-lucide-badge-check'" :spin="subscriptionLoading" />
          Текущая подписка
        </button>
      </div>

      <pre v-if="statusResult" class="code">{{ resultText(statusResult) }}</pre>
      <pre v-if="subscriptionResult" class="code">{{ resultText(subscriptionResult) }}</pre>
    </div>
  </div>
</template>
