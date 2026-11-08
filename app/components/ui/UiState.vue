<script setup lang="ts">
defineProps<{ kind: 'loading' | 'empty' | 'error' | 'pending'; title: string; description?: string }>()
</script>
<template>
  <div class="ui-state" :role="kind === 'error' ? 'alert' : 'status'" :aria-busy="kind === 'loading' || undefined">
    <span v-if="kind === 'loading'" class="spinner" aria-hidden="true" />
    <h2>{{ title }}</h2><p v-if="description">{{ description }}</p><slot />
  </div>
</template>
