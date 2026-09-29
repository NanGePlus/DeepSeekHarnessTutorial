/**
 * Generated `./remote` artifacts expose the `sopCapsules` namespace for Client
 * merge and TestRemote scripting.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@nangeagi/dsh-sop-capsules/remote'

const pluginRoot = join(import.meta.dirname, '..')

describe('sop-capsules typert remote client artifacts', () => {
  it('build emits typert host and remote-client files', () => {
    execSync('pnpm run build', { cwd: pluginRoot, stdio: 'pipe' })
    expect(existsSync(join(pluginRoot, 'lib/typert.host.js'))).toBe(true)
    expect(existsSync(join(pluginRoot, 'lib/typert.remote-client.d.ts'))).toBe(true)
    const dts = readFileSync(join(pluginRoot, 'lib/typert.remote-client.d.ts'), 'utf8')
    expect(dts).toContain('sopCapsules')
    expect(dts).toContain('listLibrary')
  })

  it('TestRemote can script sopCapsules.listLibrary with generated typing', async () => {
    execSync('pnpm run build', { cwd: pluginRoot, stdio: 'pipe' })
    const ctx = new Context()
    const sessionId = 'sess-1' as SessionId
    let called = false
    new TestRemote(ctx, {
      sopCapsules: {
        listLibrary: async (id: SessionId) => {
          called = id === sessionId
          return { groups: [], adoptedOrphanIds: [] }
        },
      },
    })
    await ctx.remote.sopCapsules.listLibrary(sessionId, new AbortController().signal)
    expect(called).toBe(true)
  })
})
