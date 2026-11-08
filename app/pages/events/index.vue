<script setup lang="ts">
import { createRegistryController } from '~/utils/registry-controller'
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Мои мероприятия · Школьные события' })
const auth=useAuthStore(),context=()=>({user:auth.user?.id??'',school:auth.tenant?.school_id??'',role:auth.tenant?.role??'',authenticated:auth.authenticated})
const identity=computed(()=>JSON.stringify(context())),ctrl=createRegistryController(useRegistryApi(),context,{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)})
const {query,page,listError,loading,dialog,busy}=ctrl
const mutations=computed(()=>auth.authenticated&&!!auth.tenant&&['teacher','school_admin'].includes(auth.tenant.role))
watch(identity,()=>{ctrl.reset();if(auth.authenticated&&auth.tenant)void ctrl.refresh()},{immediate:true,flush:'sync'})
onBeforeUnmount(ctrl.reset)
</script>
<template><RegistryWorkspace :key="identity" :query="query" :page="page" :error="listError" :loading="loading" :dialog="dialog" :busy="busy" :mutations="mutations" @change="ctrl.setQuery" @refresh="ctrl.refresh" @action="ctrl.prepare" @close="ctrl.close" @confirm="ctrl.confirm" @reconcile="ctrl.reconcile" @prepare-again="ctrl.prepareAgain" /></template>
