<script setup lang="ts">
const props = defineProps<{ title: string }>()
const open = defineModel<boolean>({ default: false })
const dialog = useTemplateRef('dialog')
const titleId = useId()
let previousFocus: HTMLElement | null = null
watch(open, async value => {
  await nextTick()
  if (value) {
    previousFocus = document.activeElement as HTMLElement | null
    dialog.value?.showModal()
  } else {
    dialog.value?.close()
    previousFocus?.focus()
  }
}, { immediate: true })
onBeforeUnmount(() => { dialog.value?.close(); previousFocus?.focus() })
</script>
<template>
  <dialog ref="dialog" class="ui-modal" :aria-labelledby="titleId" @cancel.prevent="open = false" @click="event => { if (event.target === dialog) open = false }">
    <div class="row"><h2 :id="titleId">{{ props.title }}</h2><button class="text-button" aria-label="Закрыть диалог" @click="open = false">Закрыть</button></div>
    <slot />
  </dialog>
</template>
