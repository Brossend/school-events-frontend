<script setup lang="ts">
const auth = useAuthStore()
const notices = useNotificationsStore()
const initials = computed(() => auth.user?.name.split(/\s+/).slice(0, 2).map(s => s[0]).join('') ?? '')
const logoutError = ref('')
const logoutOpen = ref(false)
async function logout() {
  logoutError.value = ''
  try { await auth.logout(); logoutOpen.value = false }
  catch (error) { logoutError.value = error instanceof Error ? error.message : 'Не удалось выйти.' }
}
</script>
<template>
  <div class="app-layout">
    <a class="skip-link" href="#main">Перейти к содержимому</a>
    <aside class="app-sidebar">
      <NuxtLink to="/" class="app-brand">Школьные<br>события</NuxtLink>
      <div class="partner-mark partner-mark--small">Сбер × УрФУ</div>
      <AppNavigation />
      <div class="pilot-card"><strong>Пилотный регион</strong><p>Свердловская область</p><p class="muted">Пилотная версия</p></div>
      <div class="sidebar-help"><p>Как работать с ИИ</p><p>Проект всегда проверяет педагог</p></div>
    </aside>
    <div class="app-workspace">
      <header class="app-header">
        <span>{{ auth.systemRole !== 'none' ? 'Рабочее пространство эксперта' : 'Рабочее пространство педагога' }}</span>
        <div class="app-user"><NuxtLink to="/profile"><span class="user-name">{{ auth.user?.name }}</span><span class="avatar">{{ initials }}</span></NuxtLink><button class="text-button" :disabled="auth.busy" @click="logoutOpen = true">Выйти</button></div>
      </header>
      <div class="compact-nav"><AppNavigation /></div>
      <main id="main" class="app-content">
        <UiAlert v-if="notices.message" tone="error"><div class="row"><span>{{ notices.message }}</span><button class="text-button" @click="notices.clear">Закрыть</button></div></UiAlert>
        <div :key="auth.tenant?.school_id ?? 'system'"><slot /></div>
      </main>
      <footer class="app-footer">Школьные события · Сбер × УрФУ · Проект всегда проверяет педагог</footer>
    </div>
    <UiModal v-model="logoutOpen" title="Завершить сеанс?">
      <p>Вы сможете продолжить работу после повторного входа.</p>
      <UiAlert v-if="logoutError" tone="error">{{ logoutError }}</UiAlert>
      <div class="actions"><UiButton variant="secondary" @click="logoutOpen = false">Остаться</UiButton><UiButton :loading="auth.busy" @click="logout">Выйти</UiButton></div>
    </UiModal>
  </div>
</template>
