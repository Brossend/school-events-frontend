<script setup lang="ts">
defineProps<{ title: string; stage: string; description: string }>()
</script>
<template>
  <div class="page-heading"><h1>{{ title }}</h1><UiBadge>{{ stage }}</UiBadge></div>
  <UiCard><UiState kind="pending" title="Раздел ещё не реализован" :description="description" /><NuxtLink to="/profile" class="text-button">Открыть профиль и выбрать школу →</NuxtLink></UiCard>
</template>
