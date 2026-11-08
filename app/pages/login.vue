<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })
useHead({ title: 'Вход · Школьные события' })
const auth = useAuthStore()
if (auth.authenticated && !auth.bootstrapError) await navigateTo('/profile')
</script>
<template><LoginForm /></template>
