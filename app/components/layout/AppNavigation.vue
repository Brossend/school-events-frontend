<script setup lang="ts">
const route = useRoute()
const auth = useAuthStore()
const fe010 = computed(() => route.path.startsWith('/comparisons') || route.path.startsWith('/pilot'))
const fe011 = computed(() => ['/school','/catalog','/system'].some(path => route.path === path || route.path.startsWith(path + '/')))
const fe011Icon = (icon: string, mobile: boolean) => `/icons/fe011/${route.path.startsWith('/catalog') ? mobile ? '88-1111' : '88-650' : mobile ? '42-537' : '1-497'}-${({ calendar: 'calendar-days' } as Record<string,string>)[icon] ?? icon}.svg`
const fe010Icon = (icon: string, mobile: boolean) => `/icons/fe010/${route.path.startsWith('/comparisons') ? mobile ? '100-1384' : '100-1014' : mobile ? '105-2185' : '105-1403'}-${({ calendar: 'calendar-days' } as Record<string,string>)[icon] ?? icon}.svg`
const items = computed(() => [
  { to: '/', label: 'Главная', icon: 'house' },
  { to: '/calendar', label: 'Календарь', icon: 'calendar' },
  { to: '/events', label: 'Мои мероприятия', icon: 'files' },
  { to: '/school', label: 'Профиль школы', icon: 'school' },
  { to: '/traditions', label: 'Традиции школы', icon: 'school' },
  { to: '/comparisons', label: 'A/B-сравнения', icon: 'files' },
  { to: '/pilot', label: 'Пилотное исследование', icon: 'school' },
  ...(['catalog_curator','system_admin'].includes(auth.systemRole) ? [{ to: '/catalog', label: 'Каталог и верификация', icon: 'files' }, { to: '/system', label: 'Системный статус', icon: 'school' }] : []),
])
</script>
<template>
  <nav aria-label="Основные разделы" class="app-nav">
    <NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="app-nav__link" :class="{ 'is-active': item.to === '/' ? route.path === '/' : route.path === item.to || route.path.startsWith(`${item.to}/`) }" :aria-current="(item.to === '/' ? route.path === '/' : route.path === item.to || route.path.startsWith(`${item.to}/`)) ? 'page' : undefined">
      <template v-if="fe011"><img class="fe011-nav-desktop" :src="fe011Icon(item.icon, false)" alt=""><img class="fe011-nav-mobile" :src="fe011Icon(item.icon, true)" alt=""></template><template v-else-if="fe010"><img class="fe010-nav-desktop" :src="fe010Icon(item.icon, false)" alt=""><img class="fe010-nav-mobile" :src="fe010Icon(item.icon, true)" alt=""></template><img v-else :src="`/icons/${item.icon}.svg`" alt="" width="20" height="20"><span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
