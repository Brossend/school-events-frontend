<script setup lang="ts">
definePageMeta({})
useHead({ title: 'Мой профиль · Школьные события' })
const auth = useAuthStore()
const roleLabels = { none: 'Пользователь школы', catalog_curator: 'Куратор каталога', system_admin: 'Системный администратор', teacher: 'Педагог', school_admin: 'Администратор школы' }
</script>
<template>
  <div>
  <div class="page-heading"><div><h1>Мой профиль</h1><p class="muted">Учётная запись и доступные школы</p></div></div>
  <UiAlert v-if="auth.bootstrapError" tone="error">{{ auth.bootstrapError }}</UiAlert>
  <div class="profile-grid">
    <UiCard><h2>{{ auth.user?.name }}</h2><dl class="profile-details"><div><dt>Рабочая почта</dt><dd>{{ auth.user?.email }}</dd></div><div><dt>Роль в системе</dt><dd>{{ roleLabels[auth.systemRole] }}</dd></div><div v-if="auth.tenant"><dt>Роль в школе</dt><dd>{{ roleLabels[auth.tenant.role] }}</dd></div></dl><UiButton variant="secondary" :loading="auth.busy" @click="auth.initialize(true)">Обновить профиль</UiButton></UiCard>
    <SchoolSelector />
  </div>
  <nav class="profile-links" aria-label="Дополнительные разделы">
    <NuxtLink v-if="auth.tenant || auth.systemRole === 'system_admin'" to="/school">Реквизиты и настройки школы</NuxtLink>
    <NuxtLink v-if="auth.tenant" to="/traditions">Традиции школы</NuxtLink>
    <NuxtLink v-if="auth.tenant" to="/constructor">Конструктор сценариев</NuxtLink>
    <NuxtLink v-if="auth.tenant" to="/pilot">Пилотное исследование</NuxtLink>
    <NuxtLink v-if="auth.systemRole !== 'none'" to="/system">Системный статус</NuxtLink>
    <NuxtLink v-if="auth.systemRole !== 'none'" to="/catalog">Каталог и верификация</NuxtLink>
  </nav>
  </div>
</template>
