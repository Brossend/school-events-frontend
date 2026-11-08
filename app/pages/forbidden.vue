<script setup lang="ts">
useHead({ title: 'Нет доступа · Школьные события' })
</script>
<template><UiCard><UiState kind="error" title="Недостаточно прав" description="Этот раздел недоступен для вашей роли." /><NuxtLink to="/profile" class="ui-button ui-button--secondary">Мой профиль</NuxtLink></UiCard></template>
