/**
 * Pick-path inject semantics on SopCapsulesSurface (Replace / Append).
 */
import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SopCapsulesSurface } from '../src/client/surface.ts'

const SESSION = 'sess-1' as SessionId

describe('SopCapsulesSurface.injectCapsule', () => {
  it('Replace overwrites draft; Append joins with blank lines', () => {
    const surface = new SopCapsulesSurface(
      async () => ({ ok: true, value: { groups: [], adoptedOrphanIds: [] } }),
      async () => ({ ok: true, value: { id: 'g', displayName: 'G', capsules: [] } }),
      SESSION,
      {
        saveGroup: async () => ({ ok: true, value: undefined }),
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    surface.state.update(d => { d.injectMode = 'replace' })
    let draft = 'old'
    const close = vi.fn()
    surface.injectCapsule('body', () => draft, (text) => { draft = text }, close)
    expect(draft).toBe('body')
    expect(close).toHaveBeenCalledOnce()

    surface.state.update(d => { d.injectMode = 'append' })
    draft = 'keep'
    surface.injectCapsule('tail', () => draft, (text) => { draft = text }, close)
    expect(draft).toBe('keep\n\ntail')
  })

  it('writes the draft after preparation settles, including when preparation rejects', async () => {
    const surface = new SopCapsulesSurface(
      async () => ({ ok: true, value: { groups: [], adoptedOrphanIds: [] } }),
      async () => ({ ok: true, value: { id: 'g', displayName: 'G', capsules: [] } }),
      SESSION,
      {
        saveGroup: async () => ({ ok: true, value: undefined }),
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    let draft = 'old'
    const close = vi.fn()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    surface.injectCapsule('body', () => draft, (text) => { draft = text }, close, () => gate)
    expect(draft).toBe('old')
    expect(close).not.toHaveBeenCalled()
    release()
    await gate
    await Promise.resolve()
    expect(draft).toBe('body')
    expect(close).toHaveBeenCalledOnce()

    draft = 'old'
    close.mockClear()
    surface.injectCapsule(
      'next',
      () => draft,
      (text) => { draft = text },
      close,
      () => Promise.reject(new Error('catalog down')),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(draft).toBe('next')
    expect(close).toHaveBeenCalledOnce()
  })
})
