<script setup lang="ts">
definePageMeta({ access: { tenant: true } })
const route = useRoute()
await navigateTo({ path: `/generation-runs/${encodeURIComponent(String(route.params.id))}`, query: route.query }, { replace: true, redirectCode: 301 })
</script>
<template><UiState kind="loading" title="Открываем состояние генерации" /></template>
