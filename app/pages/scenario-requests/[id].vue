<script setup lang="ts">
import { teacherText } from '~/utils/teacher-language'
import { ApiError } from '~/utils/api-error'
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Сохранённый запрос · Школьные события' })
const auth = useAuthStore(), api = useApi(), route = useRoute()
const { data, pending, error, refresh } = useSchoolResource(async signal => { const schoolId = auth.tenant!.school_id; const response = await api.request('get', '/scenario-requests/{id}', { params: { id: String(route.params.id) }, schoolId, signal, reportError: false }); if (response.data.school_id !== schoolId) throw new ApiError(403, 'SCHOOL_MISMATCH', 'Выберите школу этого запроса.'); return response.data }, () => [route.params.id, auth.user?.id])
</script>
<template><div class="constructor-page"><NuxtLink to="/constructor">← Конструктор</NuxtLink><h1>Сохранённый запрос</h1><UiCard><UiState v-if="pending" kind="loading" title="Загружаем запрос" /><UiState v-else-if="error" kind="error" title="Запрос недоступен" :description="teacherText(error.message)"><UiButton @click="refresh">Повторить чтение</UiButton></UiState><template v-else-if="data"><ScenarioRequestDetails :request="data" /><GenerationLaunchPanel :request="data" /><NuxtLink :to="{ path: '/comparisons', query: { request: data.id } }" class="ui-button ui-button--secondary">Создать A/B-сравнение этого запроса</NuxtLink></template></UiCard></div></template>
