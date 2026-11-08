<script setup lang="ts">
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Просмотр сценария · Школьные события' })
const api = useGenerationApi(), route = useRoute(), auth = useAuthStore()
// Scope resource reads to identity; section navigation stays inside the result.
const resourceKey = computed(() => JSON.stringify([route.params.id, route.query.run, auth.user?.id]))
const { data, error, pending, refresh } = useSchoolResource(signal => api.scenario(String(route.params.id), auth.tenant!.school_id, signal, typeof route.query.run === 'string' ? route.query.run : undefined), () => resourceKey.value)
const sourceId = ref<string | null>(null), inspectorOpen = ref(false)
function inspect(id: string) { sourceId.value = id; inspectorOpen.value = true }
watch(() => [route.params.id, auth.user?.id, auth.tenant?.school_id], () => { sourceId.value = null; inspectorOpen.value = false })
</script>
<template><div class="generation-page scenario-reader"><div class="row"><NuxtLink to="/events">← Мои мероприятия</NuxtLink><NuxtLink v-if="data && ['teacher','school_admin'].includes(auth.tenant?.role ?? '')" :to="`/scenarios/${data.id}/edit`" class="ui-button ui-button--primary">Открыть редактор</NuxtLink><NuxtLink v-if="data" :to="`/scenario-requests/${data.scenario_request_id}`">Параметры запроса и генерация</NuxtLink><UiButton v-if="data" variant="secondary" @click="refresh">Перечитать сценарий</UiButton></div><UiCard v-if="pending"><UiState kind="loading" title="Загружаем сценарий и ревизию" /></UiCard><UiCard v-else-if="error"><UiState kind="error" title="Сценарий недоступен" :description="error.message"><UiButton @click="refresh">Повторить чтение</UiButton></UiState></UiCard><ScenarioResult v-else-if="data" :scenario="data" @inspect="inspect"><template v-if="data.revision" #actions><ExportPanel :key="`${auth.user?.id}:${auth.tenant?.school_id}:${data.revision.id}`" :auto-open="route.query.export==='1'" :scenario-id="data.id" :revision-id="data.revision.id" :version="data.revision.version_number" /></template></ScenarioResult><SourceInspector v-model="inspectorOpen" :source-id="sourceId" /></div></template>
