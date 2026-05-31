<script setup lang="ts">
const props = defineProps<{
  item?: Record<string, unknown> | null
}>()

const id = computed(() => getItemId(props.item))
const createdAt = computed(() => getObjectValue(props.item, 'createdAt') || getObjectValue(props.item, 'created_at'))
const updatedAt = computed(() => getObjectValue(props.item, 'updatedAt') || getObjectValue(props.item, 'updated_at'))
const rawJson = computed(() => JSON.stringify(props.item || {}, null, 2))
</script>

<template>
  <aside class="panel">
    <div class="panel-header">
      <div>
        <h2 style="margin: 0; font-size: 16px;">Метаданные</h2>
        <p style="margin: 5px 0 0; color: var(--muted); font-size: 13px;">ID и технические поля записи.</p>
      </div>
      <CopyButton :value="rawJson" label="Скопировать JSON" />
    </div>
    <div class="panel-body">
      <div class="meta-list">
        <div class="meta-row">
          <span>ID</span>
          <strong>{{ id || '—' }}</strong>
        </div>
        <div class="meta-row">
          <span>Created</span>
          <DateTimeCell :value="createdAt" />
        </div>
        <div class="meta-row">
          <span>Updated</span>
          <DateTimeCell :value="updatedAt" />
        </div>
      </div>
    </div>
  </aside>
</template>
