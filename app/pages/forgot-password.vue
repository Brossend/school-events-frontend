<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })
useHead({ title: 'Восстановление доступа · Школьные события' })
</script>
<template>
  <section class="auth-card recovery-card">
    <h1>Восстановление доступа</h1>
    <p class="auth-description">Вернём вас к школьным событиям</p>
    <UiAlert tone="warning">Автоматическое восстановление пароля пока недоступно. Обратитесь к администратору вашей школы для восстановления доступа.</UiAlert>
    <NuxtLink class="ui-button ui-button--primary" to="/login">Вернуться ко входу</NuxtLink>
  </section>
</template>
