<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean; type?: 'button' | 'submit' | 'reset' }>(), { variant: 'primary', type: 'button' })
</script>

<template>
  <button :type="type" :class="['ui-button', `ui-button--${variant}`]" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
    <span v-if="loading" class="sr-only"> — загрузка</span>
  </button>
</template>
