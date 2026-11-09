<script setup lang="ts">
const route = useRoute(), auth = useAuthStore()
const items = computed(() => [
  { to: '/', label: 'Главная', icon: 'house' },
  { to: '/calendar', label: 'Календарь событий', icon: 'calendar' },
  { to: '/constructor', label: 'Создать мероприятие', icon: 'files' },
  { to: '/events', label: 'Мои сценарии', icon: 'files' },
  { to: '/traditions', label: 'Традиции школы', icon: 'school' },
  { to: '/research', label: 'Исследования и сравнения', icon: 'files' },
  { to: '/school', label: 'Профиль школы', icon: 'school' },
  ...(['catalog_curator', 'system_admin'].includes(auth.systemRole) ? [{ to: '/catalog', label: 'Каталог и проверка источников', icon: 'files' }, { to: '/system', label: 'Диагностика', icon: 'school' }] : []),
])
function active(path: string) { return path === '/' ? route.path === '/' : path === '/research' ? ['/research', '/comparisons', '/pilot'].some(p => route.path === p || route.path.startsWith(p + '/')) : route.path === path || route.path.startsWith(path + '/') }
</script>
<template><nav aria-label="Основные разделы" class="app-nav"><NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="app-nav__link" :class="{ 'is-active': active(item.to) }" :aria-current="active(item.to) ? 'page' : undefined"><img :src="`/icons/${item.icon}.svg`" alt="" width="20" height="20"><span>{{ item.label }}</span></NuxtLink></nav></template>
