<script setup lang="ts">
import type { SourceReference } from '~/types/provenance'
import { safeSourceUrl } from '~/utils/provenance'
defineProps<{ sources: SourceReference[] }>()
defineEmits<{ inspect: [id: string] }>()
</script>
<template><section class="provenance-stack"><h2>Первоисточники</h2><UiAlert v-if="!sources.length" tone="warning">Первоисточники не указаны. Нельзя считать сведения подтверждёнными без доказательств.</UiAlert><article v-for="source in sources" :key="source.id" class="provenance-source"><h3><NuxtLink :to="`/sources/${encodeURIComponent(source.id)}`">{{ source.title }}</NuxtLink></h3><a v-if="safeSourceUrl(source.url)" :href="safeSourceUrl(source.url)" target="_blank" rel="noopener noreferrer">{{ source.url }} ↗</a><p v-else class="muted">{{ source.url || 'Ссылка на документ не указана' }}</p><button class="text-button" type="button" @click="$emit('inspect', source.id)">Источник и достоверность</button></article></section></template>
