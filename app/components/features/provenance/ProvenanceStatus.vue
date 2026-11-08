<script setup lang="ts">
defineProps<{ state: { label: string; tone: 'success' | 'warning' | 'neutral' } }>()
</script>
<template><UiBadge :tone="state.tone">{{ state.label }}</UiBadge></template>
