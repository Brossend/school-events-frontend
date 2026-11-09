<script setup lang="ts">
import { ApiError } from '~/utils/api-error'
import type { components } from '~/types/openapi'
definePageMeta({})
useHead({ title: 'Пригласить педагога · Школьные события' })
const auth = useAuthStore(), api = useApi(), route = useRoute()
type Invitation = components['schemas']['SchoolInvitation']
const school = computed(() => auth.systemRole === 'system_admin' && typeof route.query.school === 'string' ? route.query.school : auth.tenant?.school_id ?? '')
const allowed = computed(() => auth.systemRole === 'system_admin' || auth.tenant?.role === 'school_admin')
const items = ref<Invitation[]>([]), email = ref(''), code = ref(''), message = ref(''), pending = ref(false), uncertain = ref(false), error = shallowRef<ApiError | null>(null), revokeTarget = shallowRef<Invitation | null>(null)
const page = ref(1), lastPage = ref(1)
let generation = 0
watch(() => `${auth.user?.id ?? ''}:${school.value}:${auth.systemRole}:${auth.tenant?.role ?? ''}`, () => { generation++; code.value = ''; email.value = ''; message.value = ''; error.value = null; pending.value = false; revokeTarget.value = null; items.value = []; page.value = 1; lastPage.value = 1; uncertain.value = false; void load() }, { immediate: true })
function status(item: Invitation) { return item.used_at ? 'Использовано' : item.revoked_at ? 'Отозвано' : new Date(item.expires_at).getTime() <= Date.now() ? 'Истекло' : 'Действует' }
async function load() {
  if (!allowed.value || !school.value) return
  const context = generation; pending.value = true; error.value = null
  try { const result = await api.request('get', '/schools/{schoolId}/invitations', { tenant: false, params: { schoolId: school.value }, query: { page: page.value }, reportError: false }); if (context === generation) { items.value = result.data.items; lastPage.value = result.data.last_page } }
  catch (cause) { if (context === generation) error.value = cause as ApiError }
  finally { if (context === generation) pending.value = false }
}
async function create() {
  if (pending.value || uncertain.value || !allowed.value || !school.value) return
  const context = generation; pending.value = true; error.value = null; code.value = ''; message.value = ''
  try { const result = await api.request('post', '/schools/{schoolId}/invitations', { tenant: false, params: { schoolId: school.value }, body: { email: email.value.trim() || null }, reportError: false }); if (context === generation) { code.value = result.data.code; email.value = ''; page.value = 1 } }
  catch (cause) { if (context === generation) { error.value = cause as ApiError; uncertain.value = !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 } }
  finally { if (context === generation) { const mutationError = error.value; pending.value = false; await load(); if (context === generation && mutationError) error.value = mutationError } }
}
async function revoke() {
  if (!revokeTarget.value || pending.value || !allowed.value || !school.value) return
  const target = revokeTarget.value, context = generation; pending.value = true; error.value = null
  try { await api.request('post', '/schools/{schoolId}/invitations/{invitationId}/revoke', { tenant: false, params: { schoolId: school.value, invitationId: target.id }, reportError: false }); if (context === generation) { revokeTarget.value = null; code.value = ''; message.value = 'Приглашение отозвано. Использовать код больше нельзя.' } }
  catch (cause) { if (context === generation) error.value = cause as ApiError }
  finally { if (context === generation) { const mutationError = error.value; pending.value = false; await load(); if (context === generation && mutationError) error.value = mutationError } }
}
async function copy() { const context = generation; try { await navigator.clipboard.writeText(code.value); if (context === generation) message.value = 'Код скопирован. Передайте его педагогу приватно.' } catch { if (context === generation) message.value = 'Выделите код и скопируйте его вручную.' } }
onBeforeUnmount(() => { generation++; code.value = '' })
</script>
<template><div class="invitations-page"><NuxtLink to="/school">← Профиль школы</NuxtLink><h1>Пригласить педагога</h1>
  <UiAlert v-if="!allowed" tone="warning">Создавать приглашения может администратор вашей школы.</UiAlert>
  <UiAlert v-else-if="!school" tone="warning">Сначала откройте профиль нужной школы. Администратор системы может указать школу в адресе страницы приглашений.</UiAlert>
  <template v-else><p><template v-if="school === auth.tenant?.school_id">{{ auth.tenant?.school_name }} · </template>Роль приглашённого: педагог. Приглашение действует 7 дней.</p><p>Письма автоматически не отправляются: передайте код адресату лично или через защищённый канал.</p>
    <form class="invitation-create" @submit.prevent="create"><UiField v-model="email" label="Почта педагога (необязательно)" type="email" :disabled="pending || uncertain" hint="Укажите почту, чтобы код мог использовать только её владелец." /><UiButton type="submit" :loading="pending" :disabled="uncertain">Создать приглашение</UiButton></form>
    <UiAlert v-if="error" tone="error">{{ error.message }}</UiAlert><UiAlert v-if="message" role="status">{{ message }}</UiAlert>
    <UiAlert v-if="uncertain" tone="warning">Ответ о создании не получен. Проверьте список перед новым приглашением: уже созданный код повторно не показывается. Ненужное приглашение можно отозвать.<UiButton variant="secondary" @click="uncertain = false">Список проверен</UiButton></UiAlert>
    <section v-if="code" class="ui-card invitation-code"><h2>Передайте код педагогу</h2><p>Код показан только сейчас. После закрытия страницы восстановить его нельзя.</p><code>{{ code }}</code><UiButton @click="copy">Скопировать код</UiButton><p>Регистрация: <NuxtLink to="/register">/register</NuxtLink>. Пароль педагог задаёт самостоятельно.</p></section>
    <h2>Приглашения школы</h2><UiButton variant="secondary" :disabled="pending" @click="load">Обновить список</UiButton>
    <p v-if="!items.length && !pending">Приглашений пока нет.</p><ul class="invitation-list"><li v-for="item in items" :key="item.id" class="ui-card"><strong>{{ item.email || 'Без привязки к почте' }}</strong><UiBadge>{{ status(item) }}</UiBadge><p>Действует до {{ new Date(item.expires_at).toLocaleDateString('ru-RU') }}</p><UiButton v-if="status(item) === 'Действует'" variant="secondary" :disabled="pending" @click="revokeTarget = item">Отозвать</UiButton></li></ul>
    <div class="actions"><UiButton variant="secondary" :disabled="pending || page <= 1" @click="page--; load()">Назад</UiButton><span>Страница {{ page }} из {{ lastPage }}</span><UiButton variant="secondary" :disabled="pending || page >= lastPage" @click="page++; load()">Далее</UiButton></div>
    <UiModal :model-value="!!revokeTarget" title="Отозвать приглашение?" @update:model-value="value => { if (!value && !pending) revokeTarget = null }"><p>Неиспользованный код перестанет действовать. Существующие аккаунты не изменятся.</p><div class="actions"><UiButton variant="secondary" :disabled="pending" @click="revokeTarget = null">Отмена</UiButton><UiButton :loading="pending" @click="revoke">Отозвать приглашение</UiButton></div></UiModal>
  </template></div></template>
