/**
 * Manage-path save/delete on SopCapsulesSurface: RemoteError keeps editor fields.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SopCapsulesSurface } from '../src/client/surface.ts'

const SESSION = 'sess-1' as SessionId

function remoteError(message: string) {
  return { ok: false as const, error: { code: 'gateway/internal-error', message, details: {} } }
}

describe('SopCapsulesSurface manage mutations', () => {
  it('keeps editor fields when saveGroup returns RemoteError (US-17)', async () => {
    const surface = new SopCapsulesSurface(
      async () => ({ ok: true, value: { groups: [{ id: 'g1', displayName: '入门' }], adoptedOrphanIds: [] } }),
      async () => ({
        ok: true,
        value: { id: 'g1', displayName: '入门', capsules: [{ id: 'c1', title: '旧', body: '旧正文' }] },
      }),
      SESSION,
      {
        saveGroup: async () => remoteError('save failed'),
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    surface.state.update(d => {
      d.selectedGroupId = 'g1'
      d.capsules = [{ id: 'c1', title: '旧', body: '旧正文' }]
      d.groups = [{ id: 'g1', displayName: '入门' }]
    })
    surface.beginEditCapsule('c1')
    surface.setEditorTitle('未保存标题')
    surface.setEditorBody('未保存正文')
    surface.commitEditor()
    await vi.waitFor(() => {
      expect(surface.state.getSnapshot().mutationStatus).toBe('idle')
    })
    const snap = surface.state.getSnapshot()
    expect(snap.mutationError).toBe('save failed')
    expect(snap.editor).toEqual({
      kind: 'capsule-edit',
      capsuleId: 'c1',
      title: '未保存标题',
      body: '未保存正文',
    })
  })

  it('exports the selected group as isomorphic groups yaml (US-14)', async () => {
    const group = {
      id: 'g1',
      displayName: '入门',
      capsules: [{ id: 'c1', title: '每日站会', body: '站会 SOP 正文' }],
    }
    const surface = new SopCapsulesSurface(
      async () => ({ ok: true, value: { groups: [{ id: 'g1', displayName: '入门' }], adoptedOrphanIds: [] } }),
      async () => ({ ok: true, value: group }),
      SESSION,
      {
        saveGroup: async () => ({ ok: true, value: undefined }),
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    surface.state.update(d => { d.selectedGroupId = 'g1' })
    const exported = await surface.exportSelectedGroup()
    expect(exported?.filename).toBe('g1.yaml')
    const { parse } = await import('yaml')
    expect(parse(exported!.body)).toEqual({
      displayName: '入门',
      capsules: [{ id: 'c1', title: '每日站会', body: '站会 SOP 正文' }],
    })
  })

  it('replaces or creates a group after import confirm (US-15)', async () => {
    const saveGroup = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const existing = {
      id: 'g1',
      displayName: '入门',
      capsules: [
        { id: 'c1', title: '旧', body: '旧正文' },
        { id: 'c2', title: '将删', body: 'gone' },
      ],
    }
    const surface = new SopCapsulesSurface(
      async () => ({ ok: true, value: { groups: [{ id: 'g1', displayName: '入门' }], adoptedOrphanIds: [] } }),
      async () => ({ ok: true, value: existing }),
      SESSION,
      {
        saveGroup,
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    surface.state.update(d => {
      d.groups = [{ id: 'g1', displayName: '入门' }]
      d.selectedGroupId = 'g1'
      d.capsules = existing.capsules
    })
    const { stringifyGroupYaml } = await import('../src/group-yaml.ts')
    await surface.prepareImport(
      'g1.yaml',
      stringifyGroupYaml({
        displayName: '入门改',
        capsules: [{ id: 'c1', title: '新', body: '新正文' }],
      }),
    )
    expect(surface.state.getSnapshot().confirm).toEqual({
      kind: 'import-group',
      group: {
        id: 'g1',
        displayName: '入门改',
        capsules: [{ id: 'c1', title: '新', body: '新正文' }],
      },
      deleteCount: 1,
    })
    surface.confirmMutation()
    await vi.waitFor(() => {
      expect(saveGroup).toHaveBeenCalledWith(SESSION, {
        id: 'g1',
        displayName: '入门改',
        capsules: [{ id: 'c1', title: '新', body: '新正文' }],
      })
    })
  })

  it('keeps the import confirm after saveGroup RemoteError so the user can retry (US-17)', async () => {
    let fail = true
    const imported = {
      id: 'g1',
      displayName: '入门改',
      capsules: [{ id: 'c1', title: '新', body: '新正文' }],
    }
    const saveGroup = vi.fn(async () => (
      fail ? remoteError('save failed') : { ok: true as const, value: undefined }
    ))
    const surface = new SopCapsulesSurface(
      async () => ({ ok: true, value: { groups: [{ id: 'g1', displayName: '入门' }], adoptedOrphanIds: [] } }),
      async () => ({
        ok: true,
        value: { id: 'g1', displayName: '入门', capsules: [{ id: 'c1', title: '旧', body: '旧正文' }] },
      }),
      SESSION,
      {
        saveGroup,
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    surface.state.update(d => {
      d.groups = [{ id: 'g1', displayName: '入门' }]
      d.selectedGroupId = 'g1'
    })
    const { stringifyGroupYaml } = await import('../src/group-yaml.ts')
    await surface.prepareImport('g1.yaml', stringifyGroupYaml(imported))
    surface.confirmMutation()
    await vi.waitFor(() => {
      expect(surface.state.getSnapshot().mutationStatus).toBe('idle')
    })
    const afterFail = surface.state.getSnapshot()
    expect(afterFail.mutationError).toBe('save failed')
    expect(afterFail.confirm).toMatchObject({ kind: 'import-group', group: imported })
    fail = false
    surface.confirmMutation()
    await vi.waitFor(() => {
      expect(surface.state.getSnapshot().confirm).toBeNull()
    })
    expect(saveGroup).toHaveBeenCalledTimes(2)
  })

  it('shows adopted orphan groups after listLibrary (US-16)', async () => {
    const surface = new SopCapsulesSurface(
      async () => ({
        ok: true,
        value: {
          groups: [{ id: 'orphan', displayName: 'Orphan group' }],
          adoptedOrphanIds: ['orphan'],
        },
      }),
      async () => ({
        ok: true,
        value: { id: 'orphan', displayName: 'Orphan group', capsules: [] },
      }),
      SESSION,
      {
        saveGroup: async () => ({ ok: true, value: undefined }),
        deleteGroup: async () => ({ ok: true, value: undefined }),
        reorderGroups: async () => ({ ok: true, value: undefined }),
      },
    )
    surface.ensureLibrary()
    await vi.waitFor(() => {
      expect(surface.state.getSnapshot().libraryStatus).toBe('ready')
    })
    const snap = surface.state.getSnapshot()
    expect(snap.groups.map(row => row.id)).toEqual(['orphan'])
    expect(snap.orphanBanner).toBe(true)
    surface.dismissOrphanBanner()
    expect(surface.state.getSnapshot().orphanBanner).toBe(false)
  })
})
