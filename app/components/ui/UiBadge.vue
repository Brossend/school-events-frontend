<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'success' | 'neutral' | 'warning' }>(), { tone: 'neutral' })
</script>
<template><span :class="['ui-badge', `ui-badge--${tone}`]"><slot /></span></template>
