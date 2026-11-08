<script setup lang="ts">
definePageMeta({ access: { systemRoles: ['catalog_curator', 'system_admin'] } })
useHead({ title: 'Системный статус · Школьные события' })
</script>
<template>
  <SystemWorkspace />
</template>
