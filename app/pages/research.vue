<script setup lang="ts">
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Исследования и сравнения · Школьные события' })
</script>
<template><section><h1>Исследования и сравнения</h1><p>Дополнительные инструменты для сравнения подходов и сбора обратной связи. Они не обязательны для подготовки сценария.</p><div class="research-grid"><UiCard><h2>Сравнить два сценария</h2><p>Посмотрите, как условия класса и проверенные источники влияют на материалы. Само сравнение не подтверждает педагогическое качество.</p><NuxtLink to="/comparisons" class="ui-button ui-button--primary">Открыть сравнения</NuxtLink></UiCard><UiCard><h2>Обратная связь и исследование</h2><p>Доступные вам анкеты и показатели. Отсутствие ответов не является результатом исследования.</p><NuxtLink to="/pilot" class="ui-button ui-button--secondary">Открыть исследование</NuxtLink></UiCard></div></section></template>
