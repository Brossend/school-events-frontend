<script setup lang="ts">
defineProps<{ caption: string; columns: string[] }>()
</script>
<template>
  <div class="table-scroll" role="region" :aria-label="caption" tabindex="0">
    <table><caption class="sr-only">{{ caption }}</caption><thead><tr><th v-for="column in columns" :key="column" scope="col">{{ column }}</th></tr></thead><tbody><slot /></tbody></table>
  </div>
</template>
