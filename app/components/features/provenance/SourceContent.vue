<script setup lang="ts">
import type { SourceDetail } from '~/types/provenance'
import { displayDate, reviewState, safeSourceUrl, sourceType, verificationState } from '~/utils/provenance'
defineProps<{ source: SourceDetail }>()
</script>
<template><div class="provenance-stack">
  <p class="provenance-eyebrow">{{ sourceType(source.source_type) }}</p><h2>{{ source.title }}</h2><ProvenanceStatus :state="reviewState(source.latest_review?.decision)" />
  <p class="muted">Решение об источнике не подтверждает автоматически каждое культурное утверждение.</p>
  <dl class="provenance-facts"><div><dt>Автор</dt><dd>{{ source.author || 'Не указан' }}</dd></div><div><dt>DOI / ISBN</dt><dd>{{ source.doi_or_isbn || 'Не указаны' }}</dd></div><div><dt>Дата проверки источника</dt><dd>{{ displayDate(source.verification_date) }}</dd></div><div v-if="source.verified_by"><dt>Проверил</dt><dd>{{ source.verified_by.name }}</dd></div></dl>
  <div><p class="muted">Ссылка на документ</p><a v-if="safeSourceUrl(source.url)" :href="safeSourceUrl(source.url)" target="_blank" rel="noopener noreferrer">{{ source.url }} ↗</a><p v-else>{{ source.url || 'Ссылка не указана' }}</p></div>
  <section v-if="source.latest_review" class="provenance-stack"><h3>Последнее решение</h3><p>{{ source.latest_review.comments }}</p><p class="muted">{{ source.latest_review.reviewer?.name ?? 'Рецензент не указан' }} · {{ displayDate(source.latest_review.reviewed_at) }}</p></section>
  <section class="provenance-stack"><h3>Связанные утверждения</h3><p v-if="!source.claims.length" class="muted">Утверждений, связанных с источником, пока нет.</p><article v-for="claim in source.claims" :key="claim.id" class="evidence-record"><NuxtLink :to="`/claims/${encodeURIComponent(claim.cultural_claim_id)}`">{{ claim.claim_text ?? 'Открыть утверждение' }}</NuxtLink><ProvenanceStatus :state="claim.citation_locator?.trim() && claim.citation_excerpt?.trim() ? verificationState(claim.verification_status) : { label: 'Недостаточно доказательств', tone: 'warning' }" /><p>{{ claim.citation_locator }}</p><details><summary>Цитата</summary><blockquote>{{ claim.citation_excerpt || 'Цитата отсутствует' }}</blockquote></details></article></section>
</div></template>
