<script setup lang="ts">
import { computed, useId } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ id?: string; label: string; error?: string; hint?: string; disabled?: boolean }>()
const model = defineModel<string>({ default: '' }), generatedId = useId()
const id = computed(() => props.id ?? generatedId)
</script>
<template><div class="ui-field ui-textarea"><label :for="id">{{ label }}</label><textarea :id="id" v-model="model" v-bind="$attrs" :disabled="disabled" :aria-invalid="!!error" :aria-describedby="error || hint ? `${id}-help` : undefined" /><p v-if="error || hint" :id="`${id}-help`" :class="['ui-field__help', { 'text-danger': error }]">{{ error || hint }}</p></div></template>
