<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { createLatestResource } from '~/utils/latest-resource'
import { parseSystemStatus } from '~/utils/system-status'
import { canReviewSources } from '~/utils/provenance'
const auth = useAuthStore(), api = useApi(), config = useRuntimeConfig()
const context = () => JSON.stringify([auth.user?.id, auth.authenticated, auth.systemRole, auth.tenant?.school_id])
const resource = createLatestResource(async signal => parseSystemStatus(await api.request('get', '/system/status', { tenant: false, signal, reportError: false })), context)
const { data, pending, error } = resource
watch(context, () => { resource.reset(); if (auth.authenticated && canReviewSources(auth.systemRole)) void resource.refresh() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(resource.reset)
</script>
<template>
 <div class="fe011 system-workspace"><header class="fe011-heading"><p class="fe011-eyebrow">ИНФОРМАЦИЯ О ПЛАТФОРМЕ</p><h1>Системный статус</h1><p>Текущее состояние и системная роль из существующего API.</p></header>
  <UiAlert v-if="config.public.apiOrigin === 'http://localhost:8001'" tone="warning">Изолированный синтетический тестовый контур localhost:8001.</UiAlert>
  <UiCard class="fe011-panel fe011-form"><UiState v-if="pending" kind="loading" title="Проверяем статус" /><UiState v-else-if="error" kind="error" title="Не удалось проверить статус" :description="error.message" /><dl v-else-if="data" class="fe011-details"><div><dt>Состояние платформы</dt><dd><UiBadge :tone="data.system_status === 'operational' ? 'success' : 'neutral'">{{ data.system_status === 'operational' ? 'Работает · operational' : data.system_status }}</UiBadge></dd></div><div><dt>Системная роль</dt><dd>{{ data.system_role === 'system_admin' ? 'Системный администратор' : 'Куратор каталога' }}</dd></div></dl><UiButton variant="secondary" :loading="pending" @click="resource.refresh">Обновить статус</UiButton></UiCard>
  <UiAlert>Системная роль не является школьным членством. Этот ответ не содержит данных о нагрузке, очередях, пользователях или инфраструктуре.</UiAlert><nav class="fe011-toolbar" aria-label="Системные разделы"><NuxtLink to="/catalog">Каталог и верификация</NuxtLink><NuxtLink to="/profile">Мой профиль и членства</NuxtLink><NuxtLink v-if="auth.systemRole === 'system_admin' || auth.tenant" to="/school">Профиль школы</NuxtLink></nav>
 </div>
</template>
