<script setup lang="ts">
import { ApiError } from '~/utils/api-error'
import { safeReturnTo } from '~/utils/session'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const route = useRoute()
const email = ref('')
const password = ref('')
const visible = ref(false)
const error = ref<ApiError | null>(null)
const message = ref('')
const showDemo = ref(false)
async function submit() {
  if (auth.busy) return
  error.value = null
  message.value = ''
  try {
    await auth.login({ email: email.value.trim(), password: password.value })
    notifications.clear()
    password.value = ''
    await navigateTo(auth.needsSchool ? '/profile' : safeReturnTo(route.query.redirect, auth.tenant ? '/' : '/profile'))
  } catch (cause) {
    if (cause instanceof ApiError) error.value = cause
    else message.value = cause instanceof Error ? cause.message : 'Не удалось войти.'
  }
}
</script>

<template>
  <section class="auth-card login-card" aria-labelledby="login-title">
    <p class="login-kicker desktop-only">ВХОД ДЛЯ ПЕДАГОГА</p>
    <h1 id="login-title"><span class="desktop-only">С возвращением</span><span class="compact-only">Вход в систему</span></h1>
    <p class="auth-description"><span class="desktop-only">Войдите, чтобы открыть свои мероприятия и продолжить работу.</span><span class="compact-only">Ваши мероприятия и сценарии будут доступны после входа.</span></p>
    <form :aria-busy="auth.busy" @submit.prevent="submit">
      <div class="login-fields">
        <UiField v-model="email" label="Рабочая почта" type="email" name="email" autocomplete="username" placeholder="name@school.ru" required :disabled="auth.busy" :error="error?.field('email')" />
        <UiField v-model="password" label="Пароль" :type="visible ? 'text' : 'password'" name="password" autocomplete="current-password" placeholder="Введите пароль" required :disabled="auth.busy" :error="error?.field('password')">
          <template #action><button type="button" class="text-button password-toggle" :aria-pressed="visible" :disabled="auth.busy" @click="visible = !visible">{{ visible ? 'Скрыть' : 'Показать' }}</button></template>
        </UiField>
      </div>
      <div class="login-options">
        <label class="remember" title="Сервер пока поддерживает только обычную сессию"><input type="checkbox" disabled aria-describedby="session-note">Запомнить меня</label>
        <NuxtLink to="/forgot-password" class="text-button">Забыли пароль?</NuxtLink>
      </div>
      <div class="login-feedback" aria-live="polite">
        <p id="session-note" class="session-note">{{ error || message ? '' : 'Длительный вход пока недоступен.' }}</p>
        <UiAlert v-if="error || message" tone="error">{{ error?.message || message }}</UiAlert>
      </div>
      <UiButton class="auth-submit" type="submit" :loading="auth.busy">Войти</UiButton>
    </form>
    <div class="auth-divider"><span>или</span></div>
    <UiButton variant="secondary" class="auth-demo" @click="showDemo = true">Войти в деморежим</UiButton>
    <p class="auth-demo-note">Без регистрации. Для знакомства с сервисом и тестирования MVP.</p>
    <UiModal v-model="showDemo" title="Деморежим пока недоступен">
      <p>В текущей версии сервера демовход не предусмотрен. Для работы войдите с учётной записью, выданной вашей школой.</p>
      <UiButton @click="showDemo = false">Понятно</UiButton>
    </UiModal>
  </section>
</template>
