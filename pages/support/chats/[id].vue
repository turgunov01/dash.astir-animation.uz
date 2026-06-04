<script setup lang="ts">
definePageMeta({ roles: ['admin', 'super_admin'] })
const route = useRoute()
</script>

<template>
  <SupportChatInbox :initial-chat-id="String(route.params.id)" />
</template>
