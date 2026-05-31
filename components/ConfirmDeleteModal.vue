<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title?: string
  message?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      style="position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgb(15 23 42 / 54%); padding: 20px;"
      @click.self="emit('update:modelValue', false)"
    >
      <div class="panel" style="width: min(440px, 100%);">
        <div class="panel-header">
          <h2 style="margin: 0; font-size: 18px;">{{ title || 'Подтвердите удаление' }}</h2>
        </div>
        <div class="panel-body">
          <p style="margin: 0; color: var(--muted); line-height: 1.5;">
            {{ message || 'Это действие нельзя отменить.' }}
          </p>
        </div>
        <div class="panel-footer" style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="button secondary" type="button" @click="emit('update:modelValue', false)">Отмена</button>
          <button class="button danger" type="button" :disabled="loading" @click="emit('confirm')">
            {{ loading ? 'Удаление...' : 'Удалить' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
