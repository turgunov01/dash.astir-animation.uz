<script setup lang="ts">
import type { LocalizedText, LocaleCode } from '~/types/api'

const props = withDefaults(
  defineProps<{
    modelValue?: unknown
    label: string
    rows?: number
  }>(),
  {
    modelValue: () => ({ ru: '', uz: '', en: '' }),
    rows: 1
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: LocalizedText]
}>()

const activeLocale = ref<LocaleCode>('ru')
const locales: Array<{ code: LocaleCode; label: string }> = [
  { code: 'ru', label: 'RU' },
  { code: 'uz', label: 'UZ' },
  { code: 'en', label: 'EN' }
]

const currentValue = computed({
  get: () => normalizedValue.value[activeLocale.value] || '',
  set: (value: string) => {
    emit('update:modelValue', {
      ru: normalizedValue.value.ru || '',
      uz: normalizedValue.value.uz || '',
      en: normalizedValue.value.en || '',
      [activeLocale.value]: value
    })
  }
})

const normalizedValue = computed<LocalizedText>(() => {
  if (props.modelValue && typeof props.modelValue === 'object') return props.modelValue as LocalizedText
  if (typeof props.modelValue === 'string') return { ru: props.modelValue }
  return { ru: '', uz: '', en: '' }
})
</script>

<template>
  <div class="field">
    <span class="field-label">{{ label }}</span>
    <div class="locale-tabs">
      <button
        v-for="locale in locales"
        :key="locale.code"
        class="locale-tab"
        :class="{ active: activeLocale === locale.code }"
        type="button"
        @click="activeLocale = locale.code"
      >
        {{ locale.label }}
      </button>
    </div>
    <textarea v-if="rows > 1" v-model="currentValue" class="textarea" :rows="rows" />
    <input v-else v-model="currentValue" class="input" type="text">
  </div>
</template>
