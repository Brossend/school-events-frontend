import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
export default defineConfig({ root:fileURLToPath(new URL('./fe008',import.meta.url)),publicDir:fileURLToPath(new URL('../../public',import.meta.url)),plugins:[vue()],resolve:{alias:{'~':fileURLToPath(new URL('../../app',import.meta.url))}},server:{host:'localhost',port:3108,strictPort:true,fs:{allow:[fileURLToPath(new URL('../..',import.meta.url))]}} })
