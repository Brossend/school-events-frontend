<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'error' | 'warning' }>(), { tone: 'info' })
</script>
<template>
  <div :class="['ui-alert', `ui-alert--${tone}`]" :role="tone === 'error' ? 'alert' : 'status'"><slot /></div>
</template>
