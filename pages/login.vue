<script setup lang="ts">
import type { ApiErrorInfo } from '~/types/api'

definePageMeta({
  layout: 'auth',
  public: true
})

const route = useRoute()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const otpCode = ref('')
const useOtp = ref(false)
const error = ref<ApiErrorInfo | null>(null)
const otpRequested = ref(false)

async function submitPassword() {
  error.value = null
  try {
    await auth.login({ email: email.value, password: password.value })
    await navigateTo(String(route.query.redirect || '/'))
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  }
}

async function requestOtp() {
  error.value = null
  try {
    await auth.requestOtp(email.value)
    otpRequested.value = true
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  }
}

async function verifyOtp() {
  error.value = null
  try {
    await auth.verifyOtp(email.value, otpCode.value)
    await navigateTo(String(route.query.redirect || '/'))
  } catch (requestError) {
    error.value = requestError as ApiErrorInfo
  }
}
</script>

<template>
  <section class="auth-card">
    <div class="brand" style="padding: 0; border: 0; margin-bottom: 22px;">
      <span class="brand-mark">A</span>
      <span>
        <p class="brand-title">Astir Admin</p>
        <p class="brand-subtitle">Вход для операторов</p>
      </span>
    </div>

    <ApiErrorAlert :error="error" />

    <form v-if="!useOtp" class="form-grid" style="margin-top: 14px;" @submit.prevent="submitPassword">
      <div class="field">
        <span class="field-label">Email</span>
        <input v-model="email" class="input" autocomplete="email" type="email" required>
      </div>
      <div class="field">
        <span class="field-label">Пароль</span>
        <input v-model="password" class="input" autocomplete="current-password" type="password" required>
      </div>
      <button class="button" type="submit" :disabled="auth.loading">
        <AppIcon name="i-lucide-log-in" />
        {{ auth.loading ? 'Вход...' : 'Войти' }}
      </button>
      <button class="button secondary" type="button" @click="useOtp = true">Войти по OTP</button>
    </form>

    <form v-else class="form-grid" style="margin-top: 14px;" @submit.prevent="verifyOtp">
      <div class="field">
        <span class="field-label">Email</span>
        <input v-model="email" class="input" autocomplete="email" type="email" required>
      </div>
      <button v-if="!otpRequested" class="button secondary" type="button" @click="requestOtp">Запросить OTP</button>
      <div v-else class="field">
        <span class="field-label">OTP код</span>
        <input v-model="otpCode" class="input" inputmode="numeric" required>
      </div>
      <button v-if="otpRequested" class="button" type="submit" :disabled="auth.loading">
        <AppIcon name="i-lucide-shield-check" />
        Подтвердить OTP
      </button>
      <button class="button secondary" type="button" @click="useOtp = false">Вернуться к паролю</button>
    </form>
  </section>
</template>
