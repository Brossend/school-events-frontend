<script setup lang="ts">
import type { TraditionInput } from '~/types/traditions'
import { readTraditionFilter } from '~/utils/traditions'
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Традиции школы · Школьные события' })
const auth = useAuthStore(), route = useRoute(), router = useRouter(), service = useTraditionsApi()
const filter = computed(() => readTraditionFilter(route.query.is_archived))
const { data, error, pending, refresh } = useSchoolResource(signal => service.list(auth.tenant!.school_id, filter.value, signal), () => filter.value)
const mutation = useTraditionMutation(), createOpen = ref(false)
watch(() => auth.tenant?.school_id, () => { createOpen.value = false })
function setFilter(event: Event) { void router.replace({ query: { ...route.query, is_archived: (event.target as HTMLSelectElement).value } }) }
async function create(input: TraditionInput) {
  const schoolId = auth.tenant?.school_id
  if (!schoolId) return
  const result = await mutation.run(async signal => { const id = await service.create(schoolId, input, signal); signal.throwIfAborted(); await refresh(); return id })
  if (result.ok) { createOpen.value = false; await navigateTo(`/traditions/${encodeURIComponent(result.data)}`) }
}
</script>
<template><div class="traditions-page"><header class="tradition-heading"><p class="muted">{{ auth.tenant?.school_name }}</p><div class="row"><h1>Традиции школы</h1><UiButton :disabled="mutation.pending.value" @click="mutation.reset(); createOpen = true">Создать традицию</UiButton></div><p class="muted">Собственные концепции школы и история ежегодных версий.</p></header><div class="tradition-filter ui-field"><label for="tradition-archive-filter">Показывать традиции</label><select id="tradition-archive-filter" :value="filter" @change="setFilter"><option value="false">Активные</option><option value="true">Архивные</option><option value="all">Все традиции</option></select></div><UiAlert v-if="mutation.pending.value">Сохраняем традицию. Не отправляйте форму повторно.</UiAlert><UiCard v-if="pending"><UiState kind="loading" title="Загружаем традиции" /></UiCard><UiCard v-else-if="error"><UiState kind="error" title="Не удалось загрузить традиции" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState></UiCard><TraditionList v-else-if="data?.length" :traditions="data" /><UiCard v-else-if="data"><UiState kind="empty" :title="filter === 'true' ? 'В архиве пока нет традиций' : 'Традиции не найдены'" description="Создайте традицию или измените фильтр списка." /></UiCard><UiModal v-model="createOpen" title="Новая традиция школы" class="tradition-modal"><TraditionMetadataForm v-if="createOpen" :pending="mutation.pending.value" :error="mutation.error.value" @submit="create" @cancel="createOpen = false" /></UiModal></div></template>
