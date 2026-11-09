<script setup lang="ts">
import { ApiError } from '~/utils/api-error'
definePageMeta({ layout: 'auth', public: true })
useHead({ title: 'Регистрация по приглашению · Школьные события' })
const api = useApi()
const form = reactive({ invitation_code: '', name: '', email: '', password: '', password_confirmation: '' })
const busy = ref(false), success = ref(false), error = shallowRef<ApiError | null>(null)
async function submit() {
  if (busy.value || success.value) return
  error.value = null
  if (form.password !== form.password_confirmation) { error.value = new ApiError(422, 'PASSWORD_CONFIRMATION', 'Пароли не совпадают.', [{ field: 'password_confirmation', message: 'Повторите тот же пароль.' }]); return }
  busy.value = true
  try {
    await api.request('post', '/auth/register', { tenant: false, reportError: false, body: { ...form, invitation_code: form.invitation_code.trim(), email: form.email.trim() } })
    success.value = true; form.invitation_code = ''; form.password = ''; form.password_confirmation = ''
  } catch (cause) { error.value = cause instanceof ApiError ? cause : new ApiError(0, 'NETWORK', 'Не удалось подтвердить регистрацию. Попробуйте войти или уточните статус приглашения у администратора.') }
  finally { busy.value = false }
}
</script>
<template>
  <section class="auth-card register-card"><h1>Присоединиться к школе</h1><p>Администратор школы передаст вам одноразовый код. Приглашение действует 7 дней и открывает доступ педагога.</p>
    <UiAlert v-if="success" tone="info"><strong>Вы зарегистрированы</strong><p>Войдите с указанной почтой и паролем. Школа уже добавлена в ваш профиль.</p><NuxtLink to="/login" class="ui-button ui-button--primary">Перейти ко входу</NuxtLink></UiAlert>
    <form v-else method="post" :aria-busy="busy" @submit.prevent="submit">
      <UiField v-model="form.invitation_code" label="Код приглашения" name="invitation_code" autocomplete="off" required :disabled="busy" :error="error?.field('invitation_code')" hint="Скопируйте код полностью. Не размещайте его в открытом доступе." />
      <UiField v-model="form.name" label="Ваше имя" name="name" autocomplete="name" maxlength="255" required :disabled="busy" :error="error?.field('name')" />
      <UiField v-model="form.email" label="Рабочая почта" name="email" type="email" autocomplete="username" required :disabled="busy" :error="error?.field('email')" hint="Если приглашение выдано на конкретную почту, используйте именно её." />
      <UiField v-model="form.password" label="Пароль" name="password" type="password" autocomplete="new-password" minlength="12" required :disabled="busy" :error="error?.field('password')" hint="Не менее 12 символов: строчные и заглавные буквы, цифры." />
      <UiField v-model="form.password_confirmation" label="Повторите пароль" name="password_confirmation" type="password" autocomplete="new-password" required :disabled="busy" :error="error?.field('password_confirmation')" />
      <UiAlert v-if="error" tone="error" role="alert">{{ error.message }}</UiAlert>
      <UiButton type="submit" :loading="busy">Зарегистрироваться</UiButton>
    </form><p><NuxtLink to="/login">Уже зарегистрированы? Войти</NuxtLink></p>
  </section>
</template>
