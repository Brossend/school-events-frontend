<script setup lang="ts">
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Главная · Школьные события' })
const auth = useAuthStore()
const api = useApi()
const { data, pending, error, refresh } = useSchoolResource(async signal => parseDashboard(await api.request('get', '/dashboard/summary', { signal, reportError: false })))
</script>
<template>
  <div>
    <UiCard v-if="pending"><UiState kind="loading" title="Загружаем события школы" /></UiCard>
    <UiCard v-else-if="error"><UiState kind="error" title="Не удалось загрузить главную" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState></UiCard>
    <DashboardContent v-else-if="data" :dashboard="data" :name="auth.user?.name ?? ''" />
  </div>
</template>
