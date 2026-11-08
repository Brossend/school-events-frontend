<script setup lang="ts">
import { computed, useId } from 'vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ id?: string; label: string; type?: string; error?: string; hint?: string; disabled?: boolean }>(), { id: undefined, type: 'text', error: undefined, hint: undefined })
const model = defineModel<string>({ default: '' })
const generatedId = useId()
const id = computed(() => props.id ?? generatedId)
</script>

<template>
  <div class="ui-field">
    <label :for="id">{{ label }}</label>
    <div class="ui-field__control">
      <input :id="id" v-model="model" v-bind="$attrs" :type="type" :disabled="disabled" :class="{ invalid: error }" :aria-invalid="!!error" :aria-describedby="error || hint ? `${id}-help` : undefined">
      <div v-if="$slots.action" class="ui-field__action"><slot name="action" /></div>
    </div>
    <p v-if="error || hint" :id="`${id}-help`" :class="['ui-field__help', { 'text-danger': error }]">{{ error || hint }}</p>
  </div>
</template>
