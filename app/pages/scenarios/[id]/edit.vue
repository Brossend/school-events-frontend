<script setup lang="ts">
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Редактор сценария · Школьные события' })
const route = useRoute(), auth = useAuthStore()
const contextKey = computed(() => JSON.stringify([route.params.id, auth.user?.id, auth.tenant?.school_id]))
</script>
<template><ScenarioEditorWorkspace v-if="auth.tenant" :id="String(route.params.id)" :key="contextKey" /></template>
