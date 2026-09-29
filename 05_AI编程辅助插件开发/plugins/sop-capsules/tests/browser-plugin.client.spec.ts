/**
 * sop-capsules browser half: header utility + overlay slot placeholders, locale
 * registration, and fiber teardown (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { stubSettingsScope, TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type {} from '@nangeagi/dsh-sop-capsules/remote'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { en, NS, zh } from '../src/client/locales.ts'

const Empty = () => null

/** Slot ledger reader: entry ids currently registered in the session-header utilities. */
function headerEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots
    .entries('conversation.session.header.utilities')
    .map(entry => entry.options.id)
}

/** Slot ledger reader: entry ids currently registered in the input overlay list. */
function overlayEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots
    .entries('conversation.input.overlay')
    .map(entry => entry.options.id)
}

/** Boot the browser half over a real slot tree that declares header utilities and the overlay list. */
async function bench(): Promise<{
  ctx: Context
  fiber: ReturnType<Context['plugin']>
  mount: ReturnType<typeof vi.spyOn>
}> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
      'conversation.input.overlay': { kind: 'list', scope: 'session' },
    },
  } as never, Empty)
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  ctx.provide('sessions', { scope: () => undefined, scopeOf: () => undefined } as never)
  ctx.provide('conversation', {
    input: { for: () => ({ state: { getSnapshot: () => ({ draft: '' }) }, setDraft: () => {} }) },
  } as never)
  const remote = new TestRemote(ctx, {
    sopCapsules: {
      listLibrary: async () => ({ ok: true, value: { groups: [], adoptedOrphanIds: [] } }),
    },
    commands: { list: async () => ({ ok: true, value: [] }) },
    skills: { list: async () => ({ ok: true, value: { skills: [] } }) },
  })
  const mount = vi.spyOn(remote, '$mount').mockResolvedValue(async () => {})
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  ctx.locale.setLocale('zh')
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, mount }
}

describe('sop-capsules browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'sessions', 'conversation'])
  })

  it('mounts the generated sopCapsules Remote contribution before UI register', async () => {
    const { mount } = await bench()
    expect(mount).toHaveBeenCalledOnce()
    expect(mount.mock.calls[0]?.[0]).toMatchObject({ package: '@nangeagi/dsh-sop-capsules' })
  })

  it('registers header utility and overlay placeholders, and fiber teardown removes them (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(headerEntryIds(ctx)).toContain('sop-capsules')
    expect(overlayEntryIds(ctx)).toContain('sop-capsules-panel')
    await fiber.dispose()
    expect(headerEntryIds(ctx)).not.toContain('sop-capsules')
    expect(overlayEntryIds(ctx)).not.toContain('sop-capsules-panel')
  })

  it('registers both dictionaries under its namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('header.aria')).toBe(zh['header.aria'])
    ctx.locale.setLocale('en')
    expect(translate('header.aria')).toBe(en['header.aria'])

    await fiber.dispose()
    expect(translate('header.aria')).not.toBe(en['header.aria'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('sop-capsules node half', () => {
  it('contributes Host Remote behavior via default export', async () => {
    const host = await import('../src/index.ts')
    expect(typeof host.default).toBe('function')
  })
})
