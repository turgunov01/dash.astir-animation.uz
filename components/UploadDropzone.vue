<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: null,
    default: null
  },
  accept: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: 'Выберите файл'
  }
})

const emit = defineEmits<{
  'update:modelValue': [value: File | null]
}>()

const file = computed(() =>
  typeof File !== 'undefined' && props.modelValue instanceof File ? props.modelValue : null
)

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:modelValue', input.files?.[0] || null)
}
</script>

<template>
  <label class="panel" style="display: block; cursor: pointer;">
    <input :accept="accept" style="display: none;" type="file" @change="onChange">
    <div class="panel-body" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <div>
        <strong>{{ file?.name || label }}</strong>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">
          {{ file ? `${Math.round(file.size / 1024)} KB` : 'Файл будет отправлен как multipart/form-data.' }}
        </p>
      </div>
      <span class="badge info">
        <AppIcon name="i-lucide-upload" />
        Upload
      </span>
    </div>
  </label>
</template>
