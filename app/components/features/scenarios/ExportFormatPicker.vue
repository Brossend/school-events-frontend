<script setup lang="ts">
import { exportFormats } from '~/types/exports'
import type { ExportFormat } from '~/types/exports'
import { formatInfo } from '~/utils/export-data'
defineProps<{ modelValue: ExportFormat; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: ExportFormat] }>()
</script>
<template><fieldset class="export-formats" :disabled="disabled"><legend>Выберите формат документа</legend><label v-for="format in exportFormats" :key="format" class="export-format" :class="{'export-format--selected':modelValue===format}"><input type="radio" name="export-format" :value="format" :checked="modelValue===format" @change="$emit('update:modelValue',format)"><span><strong>{{ formatInfo[format].title }}</strong><span>{{ formatInfo[format].purpose }}</span></span></label></fieldset></template>
