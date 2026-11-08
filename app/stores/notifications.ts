import { defineStore } from 'pinia'

export const useNotificationsStore = defineStore('notifications', () => {
  const message = ref('')
  function clear() { message.value = '' }
  return { message, clear }
})
