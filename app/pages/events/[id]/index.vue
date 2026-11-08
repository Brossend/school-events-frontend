<script setup lang="ts">
definePageMeta({ access: { tenant: true } })
const route=useRoute()
await navigateTo({path:`/scenarios/${encodeURIComponent(String(route.params.id))}`},{replace:true})
</script>
<template><UiState kind="loading" title="Открываем сценарий" /></template>
