<script setup lang="ts">
import { useId } from 'vue'
defineOptions({ inheritAttrs: false })
defineProps<{ label: string; options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string }>()
const model = defineModel<string>({ default: '' })
const id = useId()
</script>
<template>
  <div class="ui-field">
    <label :for="id">{{ label }}</label>
    <select :id="id" v-model="model" v-bind="$attrs" :disabled="disabled">
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </div>
</template>
