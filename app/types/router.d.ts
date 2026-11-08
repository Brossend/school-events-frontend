import type { AccessRule } from '../utils/access'

declare module '#app' {
  interface PageMeta {
    public?: boolean
    access?: AccessRule
  }
}
export {}
