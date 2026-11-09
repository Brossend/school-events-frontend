<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createSchoolController } from '~/utils/school-controller'
import { schoolCriticalChanges, schoolDate, schoolIdValid } from '~/utils/school'

const auth = useAuthStore(), targetId = ref(auth.tenant?.school_id ?? ''), targetInput = ref('')
const runtime = useRuntimeConfig()
const api = useSchoolProfileApi(() => targetId.value), controller = createSchoolController(api, () => targetId.value)
const { profile, draft, pending, loading, uncertain, needsReconcile, error, issues, notice, confirmation } = controller
const editable = computed(() => api.permissions().edit && !!profile.value)
const locked = computed(() => !editable.value || pending.value || loading.value || uncertain.value || needsReconcile.value)
const confirmOpen = computed({ get: () => !!confirmation.value, set: (open: boolean) => { if (!open) confirmation.value = null } })
const criticalLabels: Record<string, string> = { name: 'Полное наименование', short_name: 'Краткое наименование', city: 'Населённый пункт', inn: 'ИНН' }
const settings = [
  { key: 'address', label: 'Адрес', max: 255 }, { key: 'phone', label: 'Телефон', max: 50 },
  { key: 'email', label: 'Email организации', max: 255 }, { key: 'website', label: 'Сайт организации', max: 255 },
] as const
const roleLabel = computed(() => auth.systemRole === 'system_admin' ? 'Системный администратор' : auth.tenant?.role === 'school_admin' ? 'Администратор школы' : auth.tenant ? 'Педагог' : 'Нет школьного членства')
function openTarget() {
  if (auth.systemRole !== 'system_admin' || pending.value || loading.value || !schoolIdValid(targetInput.value.trim())) return
  controller.reset(); targetId.value = targetInput.value.trim(); void controller.load()
}
watch(() => JSON.stringify([auth.user?.id, auth.authenticated, auth.systemRole, auth.tenant?.school_id, auth.tenant?.role]), () => {
  controller.reset(); targetInput.value = ''; targetId.value = auth.tenant?.school_id ?? ''
  if (api.permissions().read) void controller.load()
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(controller.reset)
</script>

<template>
  <div class="school-page">
    <header class="school-profile-header page-heading">
      <div class="school-profile-heading"><h1>Профиль школы</h1><NuxtLink v-if="editable" :to="{ path: '/invitations', query: { school: targetId } }" class="ui-button ui-button--primary">Пригласить педагога</NuxtLink><p class="muted">Общие условия помогают адаптировать проекты к вашей школе.</p></div>
      <UiButton v-if="editable" :disabled="locked" :loading="pending" @click="controller.prepare"><img src="/icons/fe011/1-497-save.svg" width="17" height="17" alt="">Сохранить изменения</UiButton>
    </header>
    <div class="school-profile-info"><img src="/icons/fe011/1-497-info.svg" width="20" height="20" alt=""><div><strong>{{ runtime.public.apiOrigin === 'http://localhost:8001' ? 'Изолированный синтетический тестовый контур' : 'Реквизиты и настройки школы' }}</strong><p>Укажите условия вашей школы, чтобы учитывать их при подготовке мероприятий.</p></div></div>
    <form v-if="auth.systemRole === 'system_admin'" class="school-profile-target ui-card" @submit.prevent="openTarget">
      <UiField v-model="targetInput" label="ID существующей школы" placeholder="UUID школы" :disabled="pending || loading" hint="Системный доступ: сначала откройте и проверьте профиль конкретной организации." />
      <UiButton type="submit" variant="secondary" :disabled="pending || loading || !schoolIdValid(targetInput.trim())">Открыть профиль по ID</UiButton>
    </form>
    <UiAlert v-if="!auth.tenant && auth.systemRole !== 'system_admin'" tone="warning">Для просмотра профиля выберите школу с действительным членством в своём профиле.<NuxtLink to="/profile">Мой профиль</NuxtLink></UiAlert>
    <UiAlert v-if="profile && !editable">Профиль доступен для просмотра. Изменения может сохранять администратор этой школы или системный администратор.</UiAlert>
    <UiAlert v-if="error" tone="error">{{ error.message }}</UiAlert>
    <UiAlert v-if="notice">{{ notice }}</UiAlert>
    <UiAlert v-if="uncertain || needsReconcile" tone="warning">Ввод сохранён. Сверьте актуальный профиль с введёнными значениями. Повторной записи не было.<UiButton variant="secondary" :loading="loading" @click="controller.load(true)">Проверить состояние на сервере</UiButton></UiAlert>
    <details v-if="profile && (uncertain || needsReconcile || error || notice)" class="school-profile-server-values ui-card"><summary>Последние полученные данные сервера</summary><dl><div><dt>Полное наименование</dt><dd>{{ profile.name }}</dd></div><div><dt>Краткое наименование</dt><dd>{{ profile.short_name || 'Не указано' }}</dd></div><div><dt>Населённый пункт</dt><dd>{{ profile.city }}</dd></div><div><dt>ИНН</dt><dd>{{ profile.inn || 'Не указан' }}</dd></div><div v-for="field in settings" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ typeof profile.settings[field.key] === 'string' ? profile.settings[field.key] : 'Не указано' }}</dd></div><div><dt>Описание школы</dt><dd>{{ typeof profile.settings.description === 'string' ? profile.settings.description : 'Не указано' }}</dd></div></dl></details>
    <UiState v-if="loading" kind="loading" title="Загружаем профиль школы" />
    <UiButton v-if="error && !profile && !loading && api.permissions().read" variant="secondary" @click="controller.load()">Повторить загрузку</UiButton>
    <div v-if="profile && draft" class="school-profile-grid">
      <form id="school-profile-form" class="school-profile-form" novalidate @submit.prevent="controller.prepare">
        <UiCard class="school-profile-card">
          <h2>Основные сведения</h2>
          <UiField v-model="draft.name" label="Полное наименование школы" :disabled="locked" :error="issues.name" maxlength="255" required />
          <UiField v-model="draft.short_name" label="Краткое наименование" :disabled="locked" :error="issues.short_name" maxlength="100" />
          <div class="school-profile-fields">
            <UiField :model-value="profile.region_code" label="Код региона" disabled hint="Для изменения региона обратитесь к администратору системы." />
            <UiField v-model="draft.city" label="Населённый пункт" :disabled="locked" :error="issues.city" maxlength="100" required />
          </div>
          <UiField v-model="draft.inn" label="ИНН" :disabled="locked" :error="issues.inn" inputmode="numeric" maxlength="12" hint="10 или 12 цифр; необязательное поле." />
          <p v-if="auth.systemRole === 'system_admin'" class="muted">Служебный код школы: {{ profile.id }}</p>
        </UiCard>
        <UiCard class="school-profile-card">
          <h2>Контакты и настройки организации</h2>
          <div class="school-profile-fields"><UiField v-for="field in settings" :key="field.key" v-model="draft.settings[field.key]" :label="field.label" :disabled="locked" :error="issues[`settings.${field.key}`]" :maxlength="field.max" :type="field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'" /></div>
          <UiTextarea v-model="draft.settings.description" label="Описание школы" :disabled="locked" :error="issues['settings.description']" maxlength="1000" rows="4" />
          <UiAlert v-if="issues.settings" tone="error">{{ issues.settings }}</UiAlert>
        </UiCard>
        <UiCard class="school-profile-card school-profile-summary"><h2>Данные школы</h2><dl class="school-profile-statistics"><div class="school-profile-stat"><dt>Активные педагоги</dt><dd>{{ profile.active_teachers_count }}</dd></div><div class="school-profile-stat"><dt>Действующие традиции</dt><dd>{{ profile.traditions_count }}</dd></div><div><dt>Создана</dt><dd>{{ schoolDate(profile.created_at) }}</dd></div><div><dt>Обновлена</dt><dd>{{ schoolDate(profile.updated_at) }}</dd></div></dl></UiCard>
        <div v-if="editable" class="school-profile-actions actions"><UiButton type="submit" :disabled="locked" :loading="pending">Сохранить изменения</UiButton><UiButton variant="secondary" :disabled="pending || loading" @click="controller.useServerValues">Использовать данные сервера</UiButton></div>
      </form>
      <aside class="school-profile-details">
        <UiCard class="school-profile-card"><h2>{{ roleLabel }}</h2><p>{{ auth.user?.name }}</p><NuxtLink to="/profile">Мой профиль и членства</NuxtLink><p class="muted">Личные данные учеников для подготовки сценария не требуются.</p></UiCard>
        <UiCard class="school-profile-card"><h2>Как используются данные</h2><p class="muted">Профиль не подтверждает культурные факты и не заменяет проверку педагога.</p><p>Регион: {{ profile.region_code }}</p><NuxtLink v-if="auth.tenant?.school_id === profile.id" to="/traditions">Традиции школы</NuxtLink></UiCard>
      </aside>
    </div>
    <UiModal v-model="confirmOpen" title="Подтвердить изменение реквизитов школы?">
      <div v-if="confirmation && profile" class="school-profile-confirm"><p>{{ profile.name }}</p><dl><div v-for="key in schoolCriticalChanges(confirmation.body)" :key="key"><dt>{{ criticalLabels[key] }}</dt><dd>{{ confirmation.body[key as keyof typeof confirmation.body] ?? 'Не указано' }}</dd></div></dl><p>Проверьте выбранную организацию и новые значения перед сохранением.</p><div class="actions"><UiButton variant="secondary" @click="confirmOpen = false">Отмена</UiButton><UiButton :loading="pending" @click="controller.confirm">Подтвердить изменения</UiButton></div></div>
    </UiModal>
  </div>
</template>
