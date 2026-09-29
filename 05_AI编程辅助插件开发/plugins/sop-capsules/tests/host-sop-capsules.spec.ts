/**
 * Host `sopCapsules` Remote: fixture workspace library IO, session-scoped roots,
 * orphan group registration, and `sop-capsules/no-workspace`.
 */

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../packages/storage/storage-domain/tests/helpers/memory-backend.ts'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import SopCapsulesService from '../src/index.ts'
import type { SopCapsuleGroup, SopLibrarySummary } from '../src/types.ts'

const contexts: Context[] = []
const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const root of tempRoots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function bootHarness(workspaceRoot: string): Promise<{
  ctx: Context
  sessionWithWorkspace: SessionId
  sessionWithoutWorkspace: SessionId
}> {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)

  const persisted: SessionHeader[] = []
  ctx.provide('sessionPersistence', {
    list: async () => persisted.map(header => ({
      header,
      revision: SessionPersistenceRevision(`rev-${header.id}`),
    })),
    stat: async (id: SessionId) => {
      const header = persisted.find(entry => entry.id === id)
      return header === undefined ? undefined : { header, revision: SessionPersistenceRevision(`rev-${id}`) }
    },
    open: () => { throw new Error('event bodies must not be opened') },
  } as never)

  await ctx.plugin(SessionStore)
  await ctx.plugin(WorkspaceRegistry)
  await ctx.plugin(SopCapsulesService)

  const sessionWithWorkspace = SessionId('session-with-workspace')
  const sessionWithoutWorkspace = SessionId('session-without-workspace')
  ctx.sessions.create(sessionWithWorkspace, { meta: { cwd: workspaceRoot } })
  ctx.sessions.create(sessionWithoutWorkspace, { meta: { cwd: workspaceRoot } })

  const workspace = await ctx.workspaceRegistry.create(workspaceRoot)
  await workspace.attachSession(sessionWithWorkspace)

  return { ctx, sessionWithWorkspace, sessionWithoutWorkspace }
}

function libraryDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.dsh', 'sop-capsules')
}

async function expectNoWorkspace(operation: Promise<unknown>): Promise<void> {
  try {
    await operation
  } catch (error: unknown) {
    expect(remoteErrorOf(error)).toMatchObject({ code: 'sop-capsules/no-workspace' })
    return
  }
  throw new Error('expected sop-capsules/no-workspace')
}

describe('Host sopCapsules REAL composition', () => {
  it('reads and writes manifest and group yaml for a session-bound workspace root', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'dsh-sop-capsules-io-'))
    tempRoots.push(workspaceRoot)
    const { ctx, sessionWithWorkspace } = await bootHarness(workspaceRoot)

    const group: SopCapsuleGroup = {
      id: 'onboarding',
      displayName: 'Onboarding',
      capsules: [
        { id: 'intro', title: 'Intro', body: 'Hello SOP' },
      ],
    }

    await ctx.sopCapsules.saveGroup(sessionWithWorkspace, group, new AbortController().signal)

    const loaded = await ctx.sopCapsules.getGroup(sessionWithWorkspace, 'onboarding', new AbortController().signal)
    expect(loaded).toEqual(group)

    const summary = await ctx.sopCapsules.listLibrary(sessionWithWorkspace, new AbortController().signal)
    expect(summary.groups).toEqual([{ id: 'onboarding', displayName: 'Onboarding' } satisfies SopLibrarySummary['groups'][number]])

    await ctx.sopCapsules.reorderGroups(sessionWithWorkspace, ['onboarding'], new AbortController().signal)
    const manifestRaw = await readFile(join(libraryDir(workspaceRoot), 'manifest.yaml'), 'utf8')
    expect(manifestRaw).toContain('onboarding')

    await ctx.sopCapsules.deleteGroup(sessionWithWorkspace, 'onboarding', new AbortController().signal)
    const groupFiles = await readdir(join(libraryDir(workspaceRoot), 'groups'))
    expect(groupFiles).toEqual([])
  })

  it('returns sop-capsules/no-workspace when the session has no workspace entity', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'dsh-sop-capsules-nows-'))
    tempRoots.push(workspaceRoot)
    const { ctx, sessionWithoutWorkspace } = await bootHarness(workspaceRoot)

    const signal = new AbortController().signal
    await expectNoWorkspace(ctx.sopCapsules.listLibrary(sessionWithoutWorkspace, signal))
    await expectNoWorkspace(ctx.sopCapsules.getGroup(sessionWithoutWorkspace, 'any', signal))
    await expectNoWorkspace(ctx.sopCapsules.saveGroup(sessionWithoutWorkspace, {
      id: 'any', displayName: 'Any', capsules: [],
    }, signal))
    await expectNoWorkspace(ctx.sopCapsules.deleteGroup(sessionWithoutWorkspace, 'any', signal))
    await expectNoWorkspace(ctx.sopCapsules.reorderGroups(sessionWithoutWorkspace, [], signal))
  })

  it('resolves the library root from sessionId against the bound workspace path', async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), 'dsh-sop-capsules-a-'))
    const secondRoot = await mkdtemp(join(tmpdir(), 'dsh-sop-capsules-b-'))
    tempRoots.push(firstRoot, secondRoot)

    const pool = new MemoryMediaPool()
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Storage)
    ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
    const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
    ctx.storage.mount('domain', facility)
    ctx.provide('storageDomain', facility)
    ctx.provide('sessionPersistence', {
      list: async () => [],
      stat: async () => undefined,
      open: () => { throw new Error('unexpected open') },
    } as never)
    await ctx.plugin(SessionStore)
    await ctx.plugin(WorkspaceRegistry)
    await ctx.plugin(SopCapsulesService)

    const sessionA = SessionId('session-a')
    const sessionB = SessionId('session-b')
    ctx.sessions.create(sessionA, { meta: { cwd: firstRoot } })
    ctx.sessions.create(sessionB, { meta: { cwd: secondRoot } })
    const wsA = await ctx.workspaceRegistry.create(firstRoot)
    const wsB = await ctx.workspaceRegistry.create(secondRoot)
    await wsA.attachSession(sessionA)
    await wsB.attachSession(sessionB)

    await ctx.sopCapsules.saveGroup(sessionA, {
      id: 'alpha', displayName: 'Alpha', capsules: [{ id: 'c1', title: 'T', body: 'B' }],
    }, new AbortController().signal)
    await ctx.sopCapsules.saveGroup(sessionB, {
      id: 'beta', displayName: 'Beta', capsules: [{ id: 'c2', title: 'T2', body: 'B2' }],
    }, new AbortController().signal)

    const listA = await ctx.sopCapsules.listLibrary(sessionA, new AbortController().signal)
    const listB = await ctx.sopCapsules.listLibrary(sessionB, new AbortController().signal)
    expect(listA.groups.map(row => row.id)).toEqual(['alpha'])
    expect(listB.groups.map(row => row.id)).toEqual(['beta'])
    expect(await readFile(join(libraryDir(firstRoot), 'groups', 'alpha.yaml'), 'utf8')).toContain('Alpha')
    expect(await readFile(join(libraryDir(secondRoot), 'groups', 'beta.yaml'), 'utf8')).toContain('Beta')
  })

  it('appends orphan group yaml files to manifest on listLibrary', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'dsh-sop-capsules-orphan-'))
    tempRoots.push(workspaceRoot)
    const { ctx, sessionWithWorkspace } = await bootHarness(workspaceRoot)

    const lib = libraryDir(workspaceRoot)
    await mkdir(join(lib, 'groups'), { recursive: true })
    await writeFile(join(lib, 'manifest.yaml'), 'schemaVersion: 1\ngroups: []\n')
    await writeFile(join(lib, 'groups', 'orphan.yaml'), [
      'displayName: Orphan group',
      'capsules:',
      '  - id: o1',
      '    title: Orphan',
      '    body: From disk',
      '',
    ].join('\n'))

    const summary = await ctx.sopCapsules.listLibrary(sessionWithWorkspace, new AbortController().signal)
    expect(summary.groups).toEqual([{ id: 'orphan', displayName: 'Orphan group' }])
    expect(summary.adoptedOrphanIds).toEqual(['orphan'])

    const again = await ctx.sopCapsules.listLibrary(sessionWithWorkspace, new AbortController().signal)
    expect(again.adoptedOrphanIds).toEqual([])

    const manifestRaw = await readFile(join(lib, 'manifest.yaml'), 'utf8')
    expect(manifestRaw).toContain('orphan')
  })
})
