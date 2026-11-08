<script setup lang="ts">
import { parseSource } from '~/utils/provenance'
const props = defineProps<{ sourceId: string | null }>()
const open = defineModel<boolean>({ default: false })
const api = useApi()
const { data, error, pending, refresh } = useProvenanceResource(async signal => parseSource(await api.request('get', '/event-sources/{id}', { params: { id: props.sourceId! }, signal, reportError: false })), () => props.sourceId, () => open.value && !!props.sourceId)
</script>
<template><UiModal v-model="open" title="Источник события" class="source-inspector"><UiState v-if="pending" kind="loading" title="Загружаем первоисточник" /><UiState v-else-if="error" kind="error" title="Не удалось открыть источник" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState><template v-else-if="data"><SourceContent :source="data" /><NuxtLink :to="`/sources/${encodeURIComponent(data.id)}`" @click="open = false">Карточка источника и история рецензий →</NuxtLink></template></UiModal></template>
