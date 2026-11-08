<script setup lang="ts">
definePageMeta({ access: { catalog: true } })
useHead({ title: 'Карточка события · Школьные события' })
const route = useRoute(), api = useApi(), auth = useAuthStore()
const { data, error, pending, refresh } = useProvenanceResource(signal => api.request('get', '/calendar-events/{id}', { params: { id: String(route.params.id) }, signal, reportError: false }), () => route.params.id)
const sourceId = ref<string | null>(null), inspectorOpen = ref(false)
function inspect(id: string) { sourceId.value = id; inspectorOpen.value = true }
watch(() => route.params.id, () => { inspectorOpen.value = false; sourceId.value = null })
</script>
<template><div class="provenance-page"><NuxtLink to="/calendar">← Календарь событий</NuxtLink><UiCard v-if="pending"><UiState kind="loading" title="Загружаем событие" /></UiCard><UiCard v-else-if="error"><UiState kind="error" title="Не удалось открыть событие" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState></UiCard><template v-else-if="data"><NuxtLink v-if="auth.tenant" :to="{ path: '/constructor', query: { school: auth.tenant.school_id, calendar_event_id: data.data.id } }" class="ui-button ui-button--primary">Создать мероприятие</NuxtLink><EventDetailContent :event="data.data" @inspect="inspect" /></template><SourceInspector v-model="inspectorOpen" :source-id="sourceId" /></div></template>
