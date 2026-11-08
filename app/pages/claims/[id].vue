<script setup lang="ts">
import { canReviewSources, parseClaim } from '~/utils/provenance'
definePageMeta({ access: { catalog: true } })
useHead({ title: 'Культурное утверждение · Школьные события' })
const route = useRoute(), api = useApi(), auth = useAuthStore()
const { data, error, pending, refresh } = useProvenanceResource(async signal => parseClaim(await api.request('get', '/cultural-claims/{id}', { params: { id: String(route.params.id) }, signal, reportError: false })), () => route.params.id)
</script>
<template><div class="provenance-page"><NuxtLink :to="data ? `/calendar/${encodeURIComponent(data.calendar_event_id)}` : '/calendar'">← К событию</NuxtLink><UiCard v-if="pending"><UiState kind="loading" title="Загружаем утверждение" /></UiCard><UiCard v-else-if="error"><UiState kind="error" title="Утверждение недоступно" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState></UiCard><UiCard v-else-if="data"><ClaimContent :claim="data" /><NuxtLink v-if="canReviewSources(auth.systemRole)" :to="{ path: '/catalog', query: { claim: data.id } }">Управление доказательствами →</NuxtLink><UiButton variant="secondary" @click="refresh">Обновить доказательства</UiButton></UiCard></div></template>
