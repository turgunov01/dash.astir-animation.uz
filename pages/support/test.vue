<script setup lang="ts">
import type { EndpointToolDefinition } from '~/types/api'

definePageMeta({ roles: ['admin', 'super_admin', 'parent'] })

const tools: EndpointToolDefinition[] = [
  { title: 'Current user chat', endpoint: '/api/v1/support/chat', method: 'GET' },
  { title: 'Current user messages', endpoint: '/api/v1/support/chat/messages', method: 'GET' },
  {
    title: 'Send support message',
    endpoint: '/api/v1/support/chat/messages',
    method: 'POST',
    description: 'Отправка текста и изображения как multipart/form-data.',
    fields: [
      { key: 'body', label: 'Сообщение', type: 'textarea' },
      { key: 'file', label: 'Изображение', type: 'file', accept: 'image/*', placeholder: 'Выберите изображение' }
    ]
  },
  { title: 'Mark current chat read', endpoint: '/api/v1/support/chat/read', method: 'POST' }
]
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">Current-user support test</h1>
        <p class="page-description">Проверка пользовательского support chat flow рядом с админским inbox.</p>
      </div>
    </div>

    <div class="grid grid-2">
      <EndpointTool v-for="tool in tools" :key="tool.title" :tool="tool" />
    </div>
  </section>
</template>
