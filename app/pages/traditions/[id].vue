<script setup lang="ts">
import type { AnnualInput, TraditionInput } from '~/types/traditions'
import { traditionPermissions } from '~/utils/traditions'
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Школьная традиция · Школьные события' })
const route = useRoute(), auth = useAuthStore(), service = useTraditionsApi()
const { data, error, pending, refresh } = useSchoolResource(signal => service.detail(String(route.params.id), auth.tenant!.school_id, signal), () => route.params.id)
const mutation = useTraditionMutation(() => String(route.params.id))
const editOpen = ref(false), annualOpen = ref(false), archiveOpen = ref(false), saved = ref('')
const permissions = computed(() => data.value ? traditionPermissions(data.value, auth.tenant?.school_id, auth.user?.id, auth.tenant?.role, auth.systemRole) : { edit: false, version: false })
watch(() => [auth.tenant?.school_id, route.params.id], () => { editOpen.value = false; annualOpen.value = false; archiveOpen.value = false; saved.value = '' }, { flush: 'sync' })
function open(kind: 'edit' | 'annual' | 'archive') { mutation.reset(); saved.value = ''; if (kind === 'edit' && permissions.value.edit) editOpen.value = true; if (kind === 'annual' && permissions.value.version) annualOpen.value = true; if (kind === 'archive' && permissions.value.edit) archiveOpen.value = true }
async function save(kind: 'edit' | 'annual' | 'archive', input?: TraditionInput | AnnualInput) {
  const tradition = data.value, schoolId = auth.tenant?.school_id
  if (!tradition || !schoolId || tradition.school_id !== schoolId || (kind === 'annual' ? !permissions.value.version : !permissions.value.edit)) return
  const result = await mutation.run(async signal => {
    if (kind === 'edit' && input && 'title' in input) await service.update(tradition.id, schoolId, input, signal)
    else if (kind === 'annual' && input && 'academic_year' in input) await service.annual(tradition.id, schoolId, input, signal)
    else if (kind === 'archive') await service.archive(tradition.id, schoolId, signal)
    else throw new Error('Проверьте заполнение формы.')
    signal.throwIfAborted(); await refresh()
  })
  if (result.ok) { editOpen.value = false; annualOpen.value = false; archiveOpen.value = false; saved.value = kind === 'archive' ? 'Традиция архивирована. Она доступна через фильтр «Архивные».' : kind === 'annual' ? 'Ежегодная версия сохранена.' : 'Сведения традиции сохранены.' }
}
</script>
<template><div class="traditions-page"><NuxtLink to="/traditions">← Традиции школы</NuxtLink><UiAlert v-if="saved">{{ saved }}</UiAlert><UiAlert v-if="mutation.pending.value">Сохраняем изменения. Дождитесь ответа сервера.</UiAlert><UiCard v-if="pending"><UiState kind="loading" title="Загружаем традицию" /></UiCard><UiCard v-else-if="error"><UiState kind="error" title="Традиция недоступна" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState></UiCard><TraditionDetailContent v-else-if="data" :tradition="data" :school-name="auth.tenant?.school_name ?? ''" :can-edit="permissions.edit" :can-version="permissions.version" :pending="mutation.pending.value" @edit="open('edit')" @annual="open('annual')" @archive="open('archive')" /><template v-if="data"><UiModal v-model="editOpen" title="Редактировать сведения" class="tradition-modal"><TraditionMetadataForm v-if="editOpen" :initial="data" editing :pending="mutation.pending.value" :error="mutation.error.value" @submit="save('edit', $event)" @cancel="editOpen = false" /></UiModal><UiModal v-model="annualOpen" title="Новая версия мероприятия" class="tradition-modal"><AnnualVersionForm v-if="annualOpen" :tradition="data" :pending="mutation.pending.value" :error="mutation.error.value" @submit="save('annual', $event)" @cancel="annualOpen = false" /></UiModal><UiModal v-model="archiveOpen" title="Архивировать традицию?" class="tradition-modal"><p>«{{ data.title }}» останется в истории школы. Вы сможете найти её через фильтр «Архивные». Восстановление сервером не предусмотрено.</p><UiAlert v-if="mutation.error.value" tone="error">{{ mutation.error.value.message }}</UiAlert><div class="actions"><UiButton variant="secondary" :disabled="mutation.pending.value" @click="archiveOpen = false">Отмена</UiButton><UiButton variant="danger" :loading="mutation.pending.value" @click="save('archive')">Подтвердить архивацию</UiButton></div></UiModal></template></div></template>
