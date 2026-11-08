<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template><main class="error-page"><h1>{{ error.statusCode === 404 ? 'Страница не найдена' : 'Не удалось открыть страницу' }}</h1><p>Вернитесь в рабочее пространство и попробуйте ещё раз.</p><UiButton @click="clearError({ redirect: '/' })">На главную</UiButton></main></template>
