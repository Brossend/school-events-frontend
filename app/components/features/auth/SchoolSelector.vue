<script setup lang="ts">
const auth = useAuthStore()
const selected = ref(auth.tenant?.school_id ?? '')
const error = ref('')
watch(() => auth.tenant?.school_id, id => { selected.value = id ?? '' })
async function select() {
  error.value = ''
  try { await auth.selectSchool(selected.value) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось выбрать школу.' }
}
</script>
<template>
  <UiCard>
    <h2>Активная школа</h2>
    <p class="muted">Выберите школу, с которой хотите работать.</p>
    <form v-if="auth.schools.length" class="stack" @submit.prevent="select">
      <UiSelect v-model="selected" label="Школа" :options="auth.schools.map(s => ({ value: s.school_id, label: s.name }))" placeholder="Выберите школу" required :disabled="auth.busy" />
      <UiAlert v-if="error" tone="error">{{ error }}</UiAlert>
      <UiButton :disabled="!selected || selected === auth.tenant?.school_id" :loading="auth.busy" type="submit">Применить</UiButton>
      <p v-if="auth.tenant" role="status">Выбрана: {{ auth.tenant.school_name }}</p>
    </form>
    <UiState v-else kind="empty" title="Нет членства в школе" :description="auth.systemRole === 'none' ? 'Обратитесь к администратору школы, чтобы получить доступ.' : 'Ваш системный доступ не требует выбора школы.'" />
  </UiCard>
</template>
