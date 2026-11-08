<script setup lang="ts">
import { eventTypes, type CalendarState } from '~/utils/calendar'
defineProps<{ selected: CalendarState['type'] }>()
defineEmits<{ change: [type: CalendarState['type']] }>()
</script>
<template>
  <div class="event-types" role="group" aria-label="Тип события"><button v-for="option in eventTypes" :key="option.value" type="button" :class="['event-type', `event-type--${option.value || 'all'}`]" :aria-pressed="selected === option.value" @click="$emit('change', option.value)">{{ option.label }}</button></div>
</template>
