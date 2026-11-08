<script setup lang="ts">
import type { ClaimDetail } from '~/types/provenance'
import { auditAction, displayDate } from '~/utils/provenance'
defineProps<{ claim: ClaimDetail }>()
</script>
<template><div class="provenance-stack"><p class="provenance-eyebrow">{{ claim.culture_name }}</p><h1>{{ claim.claim_text }}</h1><p v-if="claim.provenance_notes">{{ claim.provenance_notes }}</p><UiAlert>Статус проверяется для каждого свидетельства. Одобрение источника само по себе не подтверждает утверждение.</UiAlert>
  <section class="provenance-stack"><h2>Доказательства</h2><UiAlert v-if="!claim.evidence_records.length" tone="warning">Доказательств нет. Утверждение не подтверждено.</UiAlert><EvidenceRecord v-for="record in claim.evidence_records" :key="record.id" :evidence="record" /></section>
  <details><summary>История изменений доказательств</summary><ol v-if="claim.evidence_audit_events.length" class="provenance-history"><li v-for="event in claim.evidence_audit_events" :key="event.id"><strong>{{ auditAction(event.action) }}</strong><p>{{ event.actor?.name ?? 'Автор не указан' }} · {{ displayDate(event.created_at) }}</p><p v-if="event.reason">{{ event.reason }}</p><p v-if="event.previous_verification_status || event.new_verification_status">{{ event.previous_verification_status ?? 'Не указан' }} → {{ event.new_verification_status ?? 'Не указан' }}</p><p v-if="event.citation_locator">{{ event.citation_locator }}</p><blockquote v-if="event.citation_excerpt">{{ event.citation_excerpt }}</blockquote></li></ol><p v-else>История изменений пуста.</p></details>
</div></template>
