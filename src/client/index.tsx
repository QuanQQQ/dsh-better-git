/**
 * Client half of dsh-better-git: registers a 'better-git' tab type with the
 * better-sidebar service (`ctx.betterSidebar.registerTab`). The tab renders
 * the multi-repository GitView.
 *
 * To replace the built-in git tab, disable it in the sidebar settings
 * (Settings → Side card → Git → off). The better-git tab then takes over.
 */
import type {} from 'dsh-better-sidebar/client/service'
import type { Context } from 'cordis'
import { GitView } from './GitView.js'

export const name = 'dsh-better-git-client'
export const inject = ['betterSidebar']

export function apply(ctx: Context): void {
  ctx.effect(() => {
    return ctx.betterSidebar.registerTab({
      id: 'better-git',
      title: 'Better Git',
      order: 20,
      single: true,
      component: ({ scope }) => <GitView scope={scope} />,
    })
  }, 'dsh-better-git: register better-git tab')
}

export default { name, inject, apply }
