<script setup lang="ts">
import type { Evidence } from '~/types/provenance'
import { displayDate, evidenceState } from '~/utils/provenance'
defineProps<{ evidence: Evidence }>()
</script>
<template><article class="evidence-record" :class="{ 'evidence-record--detached': evidence.is_detached }">
  <ProvenanceStatus :state="evidenceState(evidence)" />
  <NuxtLink :to="`/sources/${encodeURIComponent(evidence.event_source_id)}`">{{ evidence.source?.title ?? 'Открыть первоисточник' }}</NuxtLink>
  <p class="muted">Локатор: {{ evidence.citation_locator || 'Не указан' }}</p>
  <details><summary>Цитата и сведения о проверке</summary><div class="provenance-stack">
    <blockquote v-if="evidence.citation_excerpt">{{ evidence.citation_excerpt }}</blockquote><p v-else>Цитата отсутствует. Доказательства недостаточно.</p>
    <p>Действующий статус: {{ evidenceState(evidence).label }}</p>
    <p v-if="evidence.verification_status !== evidence.effective_status">Сохранённый статус: {{ evidence.verification_status }}. Он не заменяет действующую оценку сервера.</p>
    <p v-if="evidence.verified_by">Проверил: {{ evidence.verified_by.name }} · {{ displayDate(evidence.verified_at) }}</p>
    <p v-if="evidence.applicable_academic_year">Учебный год: {{ evidence.applicable_academic_year }}</p><p v-if="evidence.notes">Примечание: {{ evidence.notes }}</p>
    <UiAlert v-if="evidence.is_detached" tone="warning">Отозвано {{ displayDate(evidence.detached_at) }}. {{ evidence.detachment_reason || 'Причина не указана.' }} Это свидетельство не подтверждает утверждение.</UiAlert>
  </div></details>
</article></template>
