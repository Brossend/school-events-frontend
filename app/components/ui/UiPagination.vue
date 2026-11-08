<script setup lang="ts">
import type { components } from '~/types/openapi'
defineProps<{ meta: components['schemas']['PaginationMeta']; disabled?: boolean }>()
defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav class="pagination" aria-label="Страницы событий">
    <UiButton variant="secondary" :disabled="disabled || meta.current_page <= 1" aria-label="Предыдущая страница" @click="$emit('change', meta.current_page - 1)">Назад</UiButton>
    <span role="status">Страница {{ meta.current_page }} из {{ Math.max(1, meta.last_page) }} · Всего {{ meta.total }}</span>
    <UiButton variant="secondary" :disabled="disabled || meta.current_page >= meta.last_page" aria-label="Следующая страница" @click="$emit('change', meta.current_page + 1)">Далее</UiButton>
  </nav>
</template>
