<script setup lang="ts">
import type { Review } from '~/types/provenance'
import { displayDate, reviewState } from '~/utils/provenance'
defineProps<{ reviews: Review[] }>()
</script>
<template><section class="provenance-stack"><h2>История экспертных решений</h2><p v-if="!reviews.length" class="muted">Рецензий пока нет.</p><ol v-else class="provenance-history"><li v-for="review in reviews" :key="review.id"><ProvenanceStatus :state="reviewState(review.decision)" /><p>{{ review.comments }}</p><p class="muted">{{ review.reviewer?.name ?? 'Рецензент не указан' }} · {{ displayDate(review.reviewed_at) }}</p></li></ol></section></template>
