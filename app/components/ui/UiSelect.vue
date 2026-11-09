<script setup lang="ts">
import { useId } from 'vue'
defineOptions({ inheritAttrs: false })
defineProps<{ label: string; options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string; error?: string }>()
const model = defineModel<string>({ default: '' })
const id = useId()
</script>
<template>
  <div class="ui-field">
    <label :for="id">{{ label }}</label>
    <select :id="id" v-model="model" v-bind="$attrs" :disabled="disabled" :aria-invalid="!!error" :aria-describedby="error ? id + '-help' : undefined">
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <p v-if="error" :id="id + '-help'" class="ui-field__help text-danger">{{ error }}</p>
  </div>
</template>
