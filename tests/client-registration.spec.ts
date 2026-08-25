import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../src/client/index.js'

test('registers one Better Git tab through the public Better Sidebar service', () => {
  let descriptor: Record<string, unknown> | undefined
  let disposed = false
  const context = {
    betterSidebar: {
      registerTab(value: Record<string, unknown>) {
        descriptor = value
        return () => { disposed = true }
      },
    },
    effect(callback: () => void | (() => void)) {
      const dispose = callback()
      if (typeof dispose === 'function') dispose()
    },
  }

  apply(context as never)

  assert.equal(descriptor?.id, 'better-git')
  assert.equal(descriptor?.title, 'Better Git')
  assert.equal(descriptor?.single, true)
  assert.equal(typeof descriptor?.component, 'function')
  assert.equal(disposed, true)
})
