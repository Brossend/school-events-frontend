import { defineStore } from 'pinia'
import type { LoginInput, SessionProfile, Tenant } from '~/types/auth'
import { ApiError } from '~/utils/api-error'
import { parseSessionProfile } from '~/utils/session'

export const useAuthStore = defineStore('auth', () => {
  const nuxtApp = useNuxtApp()
  const profile = ref<SessionProfile | null>(null)
  const tenant = ref<Tenant | null>(null)
  const initialized = ref(false)
  const busy = ref(false)
  const bootstrapError = ref('')
  const user = computed(() => profile.value?.user)
  const schools = computed(() => profile.value?.schools ?? [])
  const authenticated = computed(() => !!user.value)
  const systemRole = computed(() => user.value?.system_role ?? 'none')
  const needsSchool = computed(() => authenticated.value && schools.value.length > 0 && !tenant.value)
  let initialization: Promise<void> | undefined
  let schoolSelection = 0

  function clear() { schoolSelection++; profile.value = null; tenant.value = null; bootstrapError.value = ''; busy.value = false }

  async function selectSchool(id: string) {
    if (!schools.value.some(s => s.school_id === id)) throw new Error('Школа недоступна в вашем профиле.')
    const selection = ++schoolSelection
    busy.value = true
    try {
      const result = await nuxtApp.$api.request('get', '/tenant/current', { schoolId: id })
      if (selection === schoolSelection) tenant.value = result.data
      // School-specific caches live in page/component scope and remount on tenant change.
    } finally { if (selection === schoolSelection) busy.value = false }
  }

  async function applyProfile(payload: unknown) {
    const previousSchool = tenant.value?.school_id
    profile.value = parseSessionProfile(payload)
    tenant.value = null
    const selected = schools.value.find(s => s.school_id === previousSchool) ?? schools.value.find(s => s.is_default) ?? (schools.value.length === 1 ? schools.value[0] : undefined)
    if (selected) await selectSchool(selected.school_id)
  }

  async function initialize(force = false) {
    if (initialized.value && !force) return
    if (initialization) return initialization
    initialization = (async () => {
      bootstrapError.value = ''
      try { await applyProfile(await nuxtApp.$api.request('get', '/auth/me', { tenant: false })) }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) clear()
        else bootstrapError.value = error instanceof Error ? error.message : 'Не удалось загрузить профиль.'
      } finally { initialized.value = true }
    })().finally(() => { initialization = undefined })
    return initialization
  }

  async function login(input: LoginInput) {
    busy.value = true
    bootstrapError.value = ''
    try {
      const result = await nuxtApp.$api.request('post', '/auth/login', { body: input, tenant: false })
      await applyProfile(result)
      initialized.value = true
    } finally { busy.value = false }
  }

  async function logout() {
    busy.value = true
    try {
      await nuxtApp.$api.request('post', '/auth/logout', { tenant: false })
      clear()
      await navigateTo('/login')
    } finally { busy.value = false }
  }
  return { profile, user, schools, tenant, initialized, busy, bootstrapError, authenticated, systemRole, needsSchool, clear, initialize, login, logout, selectSchool }
})
