// @vitest-environment jsdom
/**
 * sop-capsules-panel manage path: group/capsule CRUD, drag reorder,
 * confirm dialogs, and RemoteError edit retention (Issue #20).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { SopCapsulesPanel } from '../src/client/SopCapsulesPanel.tsx'
import type { SopCapsule } from '../src/types.ts'
import type { SopCapsulesSessionView } from '../src/client/surface.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SESSION = 'sess-1' as SessionId
const WORKSPACE = 'ws-1' as WorkspaceId
const t = makeTranslate(zh)

const CAPSULES: readonly SopCapsule[] = [
  { id: 'c1', title: '每日站会', body: '站会 SOP 正文' },
  { id: 'c2', title: '代码评审', body: '评审 SOP 正文' },
]

function mountPanel(options: {
  view?: Partial<SopCapsulesSessionView>
  setPanelMode?: (mode: 'pick' | 'manage') => void
  setSearchQuery?: (query: string) => void
  selectGroup?: (groupId: string) => void
  beginNewGroup?: () => void
  beginRenameGroup?: (groupId: string) => void
  beginNewCapsule?: () => void
  beginEditCapsule?: (capsuleId: string) => void
  setEditorDisplayName?: (value: string) => void
  setEditorTitle?: (value: string) => void
  setEditorBody?: (value: string) => void
  commitEditor?: () => void
  cancelEditor?: () => void
  requestDeleteGroup?: (groupId: string) => void
  requestDeleteCapsule?: (capsuleId: string) => void
  cancelConfirm?: () => void
  confirmMutation?: () => void
  reorderGroups?: (groupIds: readonly string[]) => void
  reorderCapsules?: (capsuleIds: readonly string[]) => void
  exportSelectedGroup?: () => Promise<{ readonly filename: string; readonly body: string } | null>
  prepareImport?: (filename: string, raw: string) => Promise<void>
  dismissOrphanBanner?: () => void
} = {}) {
  const store = createSnapshotStore<SopCapsulesSessionView>({
    libraryStatus: 'ready',
    panelOpen: true,
    panelMode: 'manage',
    groups: [
      { id: 'onboarding', displayName: '入门' },
      { id: 'review', displayName: '评审' },
    ],
    listError: null,
    selectedGroupId: 'onboarding',
    groupStatus: 'ready',
    capsules: CAPSULES,
    groupError: null,
    searchQuery: '',
    injectMode: 'replace',
    injecting: false,
    editor: { kind: 'none' },
    confirm: null,
    mutationStatus: 'idle',
    mutationError: null,
    orphanBanner: false,
    ...options.view,
  })
  const setPanelMode = vi.fn(options.setPanelMode ?? (() => {}))
  const setSearchQuery = vi.fn(options.setSearchQuery ?? (() => {}))
  const selectGroup = vi.fn(options.selectGroup ?? (() => {}))
  const beginNewGroup = vi.fn(options.beginNewGroup ?? (() => {}))
  const beginRenameGroup = vi.fn(options.beginRenameGroup ?? (() => {}))
  const beginNewCapsule = vi.fn(options.beginNewCapsule ?? (() => {}))
  const beginEditCapsule = vi.fn(options.beginEditCapsule ?? (() => {}))
  const setEditorDisplayName = vi.fn(options.setEditorDisplayName ?? (() => {}))
  const setEditorTitle = vi.fn(options.setEditorTitle ?? (() => {}))
  const setEditorBody = vi.fn(options.setEditorBody ?? (() => {}))
  const commitEditor = vi.fn(options.commitEditor ?? (() => {}))
  const cancelEditor = vi.fn(options.cancelEditor ?? (() => {}))
  const requestDeleteGroup = vi.fn(options.requestDeleteGroup ?? (() => {}))
  const requestDeleteCapsule = vi.fn(options.requestDeleteCapsule ?? (() => {}))
  const cancelConfirm = vi.fn(options.cancelConfirm ?? (() => {}))
  const confirmMutation = vi.fn(options.confirmMutation ?? (() => {}))
  const reorderGroups = vi.fn(options.reorderGroups ?? (() => {}))
  const reorderCapsules = vi.fn(options.reorderCapsules ?? (() => {}))
  const exportSelectedGroup = vi.fn(options.exportSelectedGroup ?? (async () => null))
  const prepareImport = vi.fn(options.prepareImport ?? (async () => {}))
  const dismissOrphanBanner = vi.fn(options.dismissOrphanBanner ?? (() => {}))
  const useSopCapsules = bindSnapshotSelector(store)
  const ws = {
    items: [{ workspaceId: WORKSPACE, title: 'Proj', path: '/proj', sessionIds: [SESSION] }],
    archivedSessionIds: [],
    state: 'idle' as const,
    phase: 'ready' as const,
    error: null,
  }
  const useWorkspaces = (<T,>(select: (state: typeof ws) => T): T => select(ws)) as never
  const useSessions = (() => { throw new Error('unused') }) as never

  const props = {
    sessionId: SESSION,
    useWorkspaces,
    useSessions,
    useSopCapsules,
    closePanel: vi.fn(),
    readDraft: vi.fn(() => ''),
    writeDraft: vi.fn(),
    selectGroup,
    setSearchQuery,
    setInjectMode: vi.fn(),
    injectCapsule: vi.fn(),
    setPanelMode,
    ensureLibrary: vi.fn(),
    dismissListError: vi.fn(),
    retryGroupLoad: vi.fn(),
    beginNewGroup,
    beginRenameGroup,
    beginNewCapsule,
    beginEditCapsule,
    setEditorDisplayName,
    setEditorTitle,
    setEditorBody,
    commitEditor,
    cancelEditor,
    requestDeleteGroup,
    requestDeleteCapsule,
    cancelConfirm,
    confirmMutation,
    reorderGroups,
    reorderCapsules,
    exportSelectedGroup,
    prepareImport,
    dismissOrphanBanner,
    t,
  } as unknown as Parameters<typeof SopCapsulesPanel>[0]

  return {
    ...render(<SopCapsulesPanel {...props} />),
    store,
    setPanelMode,
    setSearchQuery,
    beginNewGroup,
    beginRenameGroup,
    beginNewCapsule,
    beginEditCapsule,
    setEditorDisplayName,
    setEditorTitle,
    setEditorBody,
    commitEditor,
    requestDeleteGroup,
    requestDeleteCapsule,
    cancelConfirm,
    confirmMutation,
    reorderGroups,
    reorderCapsules,
    exportSelectedGroup,
    prepareImport,
    dismissOrphanBanner,
  }
}

describe('SopCapsulesPanel manage default', () => {
  it('shows manage layout with new-group, capsule rows, edit/delete, and toolbar (US-8)', () => {
    mountPanel()
    expect(screen.getByRole('tab', { name: zh['panel.mode.manage'] }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: zh['panel.manage.newGroup'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['panel.manage.newCapsule'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['panel.manage.exportGroup'] })).toBeTruthy()
    expect(screen.getByText('每日站会')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: zh['panel.manage.editCapsule'] }).length).toBe(2)
    expect(screen.getAllByRole('button', { name: zh['panel.manage.deleteCapsule'] }).length).toBe(2)
  })

  it('keeps the selected group and search query when switching pick and manage (US-9)', () => {
    const ui = mountPanel({
      view: { panelMode: 'pick', searchQuery: '站会', selectedGroupId: 'review' },
    })
    ui.setPanelMode.mockImplementation((mode: 'pick' | 'manage') => {
      ui.store.update(d => { d.panelMode = mode })
    })
    fireEvent.click(screen.getByRole('tab', { name: zh['panel.mode.manage'] }))
    expect(ui.setPanelMode).toHaveBeenCalledWith('manage')
    expect((screen.getByRole('searchbox', { name: zh['panel.search.aria'] }) as HTMLInputElement).value).toBe('站会')
    expect(screen.getByRole('button', { name: '评审' }).getAttribute('aria-current')).toBe('true')
  })
})

describe('SopCapsulesPanel manage group CRUD', () => {
  it('creates, renames displayName, and requests delete for a group (US-10)', () => {
    const ui = mountPanel()
    ui.beginNewGroup.mockImplementation(() => {
      ui.store.update(d => { d.editor = { kind: 'group-new', displayName: '' } })
    })
    fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.newGroup'] }))
    expect(ui.beginNewGroup).toHaveBeenCalledOnce()
    const name = screen.getByRole('textbox', { name: zh['panel.manage.displayName'] })
    fireEvent.change(name, { target: { value: '发布' } })
    expect(ui.setEditorDisplayName).toHaveBeenCalledWith('发布')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.save'] }))
    expect(ui.commitEditor).toHaveBeenCalledOnce()

    fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.renameGroup'] })[0]!)
    expect(ui.beginRenameGroup).toHaveBeenCalledWith('onboarding')
    fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.deleteGroup'] })[0]!)
    expect(ui.requestDeleteGroup).toHaveBeenCalledWith('onboarding')
  })
})

describe('SopCapsulesPanel manage capsule CRUD', () => {
  it('creates, edits title and body, and requests delete for a capsule (US-12)', () => {
    const ui = mountPanel()
    ui.beginNewCapsule.mockImplementation(() => {
      ui.store.update(d => { d.editor = { kind: 'capsule-new', title: '', body: '' } })
    })
    ui.beginEditCapsule.mockImplementation((capsuleId: string) => {
      const row = CAPSULES.find(item => item.id === capsuleId)!
      ui.store.update(d => { d.editor = { kind: 'capsule-edit', capsuleId, title: row.title, body: row.body } })
    })
    const scroller = document.querySelector('[class*="contentScroll"]')
    if (scroller instanceof HTMLElement) scroller.scrollTop = 80
    fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.newCapsule'] }))
    expect(scroller instanceof HTMLElement ? scroller.scrollTop : 0).toBe(0)
    const created = screen.getByRole('textbox', { name: zh['panel.manage.capsuleTitle'] }).closest('form')
    expect(created?.closest('[class*="manageCapsuleItem"]')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: zh['panel.manage.capsuleTitle'] }), { target: { value: '新标题' } })
    fireEvent.change(screen.getByRole('textbox', { name: zh['panel.manage.capsuleBody'] }), { target: { value: '新正文' } })
    expect(ui.setEditorTitle).toHaveBeenCalledWith('新标题')
    expect(ui.setEditorBody).toHaveBeenCalledWith('新正文')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.save'] }))
    expect(ui.commitEditor).toHaveBeenCalledOnce()

    fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.editCapsule'] })[0]!)
    expect(ui.beginEditCapsule).toHaveBeenCalledWith('c1')
    const edited = screen.getByRole('textbox', { name: zh['panel.manage.capsuleTitle'] }).closest('form')
    expect(edited?.closest('[class*="manageCapsuleItem"]')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.deleteCapsule'] })[0]!)
    expect(ui.requestDeleteCapsule).toHaveBeenCalledWith('c1')
  })
})

function transfer() {
  const data: Record<string, string> = {}
  return {
    setData: (type: string, value: string) => { data[type] = value },
    getData: (type: string) => data[type] ?? '',
    effectAllowed: 'move' as const,
    dropEffect: 'move' as const,
  }
}

describe('SopCapsulesPanel manage reorder', () => {
  it('reorders groups by dropping one row onto another (US-11)', () => {
    const ui = mountPanel()
    const dt = transfer()
    const source = screen.getAllByLabelText(zh['panel.manage.drag.group'])[0]!
    const target = screen.getByRole('button', { name: '评审' }).parentElement!
    fireEvent.dragStart(source, { dataTransfer: dt })
    fireEvent.dragOver(target, { dataTransfer: dt })
    fireEvent.drop(target, { dataTransfer: dt })
    expect(ui.reorderGroups).toHaveBeenCalledWith(['review', 'onboarding'])
  })

  it('reorders capsules by dropping one row onto another (US-13)', () => {
    const ui = mountPanel()
    const dt = transfer()
    const rows = document.querySelectorAll('.manageCapsuleRow, [class*="manageCapsuleRow"]')
    expect(rows.length).toBe(2)
    fireEvent.dragStart(rows[0]!, { dataTransfer: dt })
    fireEvent.drop(rows[1]!, { dataTransfer: dt })
    expect(ui.reorderCapsules).toHaveBeenCalledWith(['c2', 'c1'])
  })
})

describe('SopCapsulesPanel manage export', () => {
  it('exports the selected group from the manage toolbar (US-14)', () => {
    const ui = mountPanel()
    fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.exportGroup'] }))
    expect(ui.exportSelectedGroup).toHaveBeenCalledOnce()
  })
})

function domRect(top: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    right: 200,
    top,
    bottom,
    width: 200,
    height: bottom - top,
    toJSON() { return {} },
  } as DOMRect
}

/**
 * Stub geometry for one scroller and any `[data-sop-reveal]` node inside it.
 * @param scroller - group list or capsule list.
 * @param scrollerBottom - visible bottom of the scroller.
 * @param revealBottom - bottom of the open editor or confirm.
 * @param scrollHeight - content height before extra padding.
 */
function stubRevealGeometry(
  scroller: HTMLElement,
  scrollerBottom: number,
  revealBottom: number,
  scrollHeight: number,
): () => void {
  const scrollerHeight = scrollerBottom
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: scrollerHeight })
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    get() {
      return scrollHeight + (Number.parseFloat(this.style.paddingBottom) || 0)
    },
  })
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this === scroller) return domRect(0, scrollerBottom)
    if (this.hasAttribute('data-sop-reveal')) return domRect(scrollerBottom - 20, revealBottom)
    return original.call(this)
  }
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original
  }
}

describe('SopCapsulesPanel reveal edit and delete', () => {
  it('scrolls the group list until a delete confirm under the row is fully visible', () => {
    const ui = mountPanel()
    ui.requestDeleteGroup.mockImplementation((groupId: string) => {
      ui.store.update(d => { d.confirm = { kind: 'delete-group', groupId } })
    })
    const scroller = document.querySelector('[class*="groupList"]')
    expect(scroller).toBeInstanceOf(HTMLElement)
    const restore = stubRevealGeometry(scroller as HTMLElement, 100, 178, 100)
    try {
      fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.deleteGroup'] })[0]!)
      expect((scroller as HTMLElement).scrollTop).toBe(86)
      expect((scroller as HTMLElement).style.paddingBottom).toBe('86px')
    } finally {
      restore()
    }
  })

  it('scrolls the capsule list until an edit form under the row is fully visible', () => {
    const ui = mountPanel()
    ui.beginEditCapsule.mockImplementation((capsuleId: string) => {
      const row = CAPSULES.find(item => item.id === capsuleId)!
      ui.store.update(d => { d.editor = { kind: 'capsule-edit', capsuleId, title: row.title, body: row.body } })
    })
    const scroller = document.querySelector('[class*="contentScroll"]')
    expect(scroller).toBeInstanceOf(HTMLElement)
    const restore = stubRevealGeometry(scroller as HTMLElement, 160, 200, 400)
    try {
      fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.editCapsule'] })[0]!)
      expect((scroller as HTMLElement).scrollTop).toBe(48)
      expect((scroller as HTMLElement).style.paddingBottom).toBe('')
    } finally {
      restore()
    }
  })

  it('leaves the list in place when the delete confirm already fits', () => {
    const ui = mountPanel()
    ui.requestDeleteCapsule.mockImplementation((capsuleId: string) => {
      ui.store.update(d => { d.confirm = { kind: 'delete-capsule', capsuleId } })
    })
    const scroller = document.querySelector('[class*="contentScroll"]')
    expect(scroller).toBeInstanceOf(HTMLElement)
    const restore = stubRevealGeometry(scroller as HTMLElement, 200, 180, 400)
    try {
      fireEvent.click(screen.getAllByRole('button', { name: zh['panel.manage.deleteCapsule'] })[0]!)
      expect((scroller as HTMLElement).scrollTop).toBe(0)
      expect((scroller as HTMLElement).style.paddingBottom).toBe('')
    } finally {
      restore()
    }
  })
})

describe('SopCapsulesPanel manage states', () => {
  it('shows skeleton while the selected group is loading', () => {
    mountPanel({ view: { groupStatus: 'loading', capsules: [] } })
    expect(document.querySelector('[data-sop-capsules-skeleton="true"]')).toBeTruthy()
  })

  it('shows manage empty-state copy that guides creating a capsule', () => {
    mountPanel({ view: { capsules: [], groupStatus: 'ready' } })
    expect(screen.getByText(zh['panel.empty.manage'])).toBeTruthy()
  })

  it('keeps editor fields after a save RemoteError (US-17)', () => {
    mountPanel({
      view: {
        editor: { kind: 'capsule-edit', capsuleId: 'c1', title: '未保存标题', body: '未保存正文' },
        mutationError: zh['panel.error.remote'],
      },
    })
    expect(screen.getByRole('alert').textContent).toContain(zh['panel.error.remote'])
    expect((screen.getByRole('textbox', { name: zh['panel.manage.capsuleTitle'] }) as HTMLInputElement).value).toBe('未保存标题')
    expect((screen.getByRole('textbox', { name: zh['panel.manage.capsuleBody'] }) as HTMLTextAreaElement).value).toBe('未保存正文')
  })

  it('asks for confirmation before delete and disables the primary action while submitting', () => {
    mountPanel({
      view: {
        confirm: { kind: 'delete-capsule', capsuleId: 'c1' },
        mutationStatus: 'submitting',
      },
    })
    expect(screen.getByRole('dialog', { name: zh['panel.manage.confirm.deleteCapsule.title'] })).toBeTruthy()
    const action = screen.getByRole('button', { name: zh['panel.manage.submitting'] })
    expect(action.hasAttribute('disabled')).toBe(true)
    expect(action.getAttribute('aria-busy')).toBe('true')
  })
})

describe('SopCapsulesPanel import-confirm', () => {
  it('shows import summary with group-id, write count, and delete count and can cancel (US-15)', () => {
    const ui = mountPanel({
      view: {
        confirm: {
          kind: 'import-group',
          group: {
            id: 'onboarding',
            displayName: '入门改',
            capsules: [{ id: 'c1', title: '每日站会', body: '新正文' }],
          },
          deleteCount: 1,
        },
      },
    })
    const dialog = screen.getByRole('dialog', { name: zh['panel.manage.confirm.import.title'] })
    expect(dialog.textContent).toContain('onboarding')
    expect(dialog.textContent).toContain('1')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.cancel'] }))
    expect(ui.cancelConfirm).toHaveBeenCalledOnce()
  })

  it('reads the chosen yaml file and opens import confirm (US-15)', async () => {
    const ui = mountPanel()
    const input = screen.getByLabelText(zh['panel.manage.importGroup']) as HTMLInputElement
    const file = new File(['displayName: 发布\ncapsules: []\n'], 'release.yaml', { type: 'text/yaml' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => {
      expect(ui.prepareImport).toHaveBeenCalledWith('release.yaml', 'displayName: 发布\ncapsules: []\n')
    })
  })

  it('disables the import confirm action while submitting (import-submitting)', () => {
    mountPanel({
      view: {
        confirm: {
          kind: 'import-group',
          group: { id: 'g-new', displayName: '新组', capsules: [] },
          deleteCount: 0,
        },
        mutationStatus: 'submitting',
      },
    })
    const action = screen.getByRole('button', { name: zh['panel.manage.submitting'] })
    expect(action.hasAttribute('disabled')).toBe(true)
    expect(action.getAttribute('aria-busy')).toBe('true')
  })

  it('keeps the import confirm and shows an error banner after Remote failure (US-17)', () => {
    mountPanel({
      view: {
        confirm: {
          kind: 'import-group',
          group: { id: 'g1', displayName: '入门改', capsules: [{ id: 'c1', title: '新', body: '新正文' }] },
          deleteCount: 0,
        },
        mutationError: zh['panel.error.remote'],
      },
    })
    expect(screen.getByRole('alert').textContent).toContain(zh['panel.error.remote'])
    expect(screen.getByRole('dialog', { name: zh['panel.manage.confirm.import.title'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['panel.manage.confirm.import.action'] }).hasAttribute('disabled')).toBe(false)
  })
})

describe('SopCapsulesPanel orphan-banner', () => {
  it('shows a dismissible informational banner after Host adopts orphan groups (US-16)', () => {
    const ui = mountPanel({
      view: {
        groups: [
          { id: 'onboarding', displayName: '入门' },
          { id: 'orphan', displayName: 'Orphan group' },
        ],
        orphanBanner: true,
      },
    })
    expect(screen.getByText(zh['panel.banner.orphan'])).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Orphan group' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh['panel.banner.orphan.dismiss'] }))
    expect(ui.dismissOrphanBanner).toHaveBeenCalledOnce()
  })
})
