// @vitest-environment jsdom
/**
 * sop-capsules-panel pick path: grouped capsule list, search, Replace/Append,
 * draft injection, overlay close, and Remote error surfaces (Issue #19).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { SopCapsulesPanel } from '../src/client/SopCapsulesPanel.tsx'
import type { SopCapsule, SopCapsuleGroup } from '../src/types.ts'
import type { SopCapsulesSessionView } from '../src/client/surface.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SESSION = 'sess-1' as SessionId
const WORKSPACE = 'ws-1' as WorkspaceId
const t = makeTranslate(zh)

const GROUP_A: SopCapsuleGroup = {
  id: 'onboarding',
  displayName: '入门',
  capsules: [
    { id: 'c1', title: '每日站会', body: '站会 SOP 正文' },
    { id: 'c2', title: '代码评审', body: '评审 SOP 正文' },
  ],
}

function mountPanel(options: {
  view?: Partial<SopCapsulesSessionView>
  writeDraft?: (text: string) => void
  readDraft?: () => string
  closePanel?: () => void
  selectGroup?: (groupId: string) => void
  setSearchQuery?: (query: string) => void
  setInjectMode?: (mode: 'replace' | 'append') => void
  injectCapsule?: (body: string) => void
  setPanelMode?: (mode: 'pick' | 'manage') => void
  ensureLibrary?: () => void
  dismissListError?: () => void
  retryGroupLoad?: () => void
} = {}) {
  const store = createSnapshotStore<SopCapsulesSessionView>({
    libraryStatus: 'ready',
    panelOpen: true,
    panelMode: 'pick',
    groups: [{ id: 'onboarding', displayName: '入门' }],
    listError: null,
    selectedGroupId: 'onboarding',
    groupStatus: 'ready',
    capsules: GROUP_A.capsules,
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
  const writeDraft = vi.fn(options.writeDraft ?? (() => {}))
  const readDraft = vi.fn(options.readDraft ?? (() => ''))
  const closePanel = vi.fn(options.closePanel ?? (() => { store.update(d => { d.panelOpen = false }) }))
  const selectGroup = vi.fn(options.selectGroup ?? (() => {}))
  const setSearchQuery = vi.fn(options.setSearchQuery ?? (() => {}))
  const setInjectMode = vi.fn(options.setInjectMode ?? (() => {}))
  const injectCapsule = vi.fn(options.injectCapsule ?? (() => {}))
  const setPanelMode = vi.fn(options.setPanelMode ?? (() => {}))
  const ensureLibrary = vi.fn(options.ensureLibrary ?? (() => {}))
  const dismissListError = vi.fn(options.dismissListError ?? (() => {}))
  const retryGroupLoad = vi.fn(options.retryGroupLoad ?? (() => {}))
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
    closePanel,
    readDraft,
    writeDraft,
    selectGroup,
    setSearchQuery,
    setInjectMode,
    injectCapsule,
    setPanelMode,
    ensureLibrary,
    dismissListError,
    retryGroupLoad,
    t,
  } as unknown as Parameters<typeof SopCapsulesPanel>[0]

  return {
    ...render(<SopCapsulesPanel {...props} />),
    store,
    writeDraft,
    readDraft,
    closePanel,
    selectGroup,
    setSearchQuery,
    setInjectMode,
    injectCapsule,
    setPanelMode,
    retryGroupLoad,
  }
}

describe('SopCapsulesPanel pick default', () => {
  it('shows pick mode with grouped sidebar and capsule titles (US-3)', () => {
    mountPanel()
    expect(screen.getByRole('tab', { name: zh['panel.mode.pick'] }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: '入门' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /每日站会/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /代码评审/ })).toBeTruthy()
  })

  it('filters capsule titles in the current group when searching (US-4)', () => {
    const ui = mountPanel()
    const search = screen.getByRole('searchbox', { name: zh['panel.search.aria'] })
    fireEvent.change(search, { target: { value: '站会' } })
    expect(ui.setSearchQuery).toHaveBeenCalledWith('站会')
  })

  it('persists append when the inject confirm chooses append (US-5)', () => {
    const ui = mountPanel()
    fireEvent.click(screen.getByRole('button', { name: /每日站会/ }))
    fireEvent.click(screen.getByRole('button', { name: zh['panel.inject.confirm.append'] }))
    expect(ui.setInjectMode).toHaveBeenCalledWith('append')
    expect(localStorage.getItem(`sop-capsules:inject-mode:${WORKSPACE}`)).toBe('append')
  })

  it('writes capsule body to draft without submitting when a capsule row is clicked (US-6)', () => {
    const ui = mountPanel({
      injectCapsule: (body) => {
        ui.writeDraft(body)
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /每日站会/ }))
    expect(ui.injectCapsule).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: zh['panel.inject.confirm.replace'] }))
    expect(ui.injectCapsule).toHaveBeenCalledWith('站会 SOP 正文')
    expect(ui.writeDraft).toHaveBeenCalledWith('站会 SOP 正文')
  })

  it('closes the overlay after a successful inject (US-7)', () => {
    const ui = mountPanel({
      injectCapsule: () => { ui.closePanel() },
    })
    fireEvent.click(screen.getByRole('button', { name: /每日站会/ }))
    fireEvent.click(screen.getByRole('button', { name: zh['panel.inject.confirm.replace'] }))
    expect(ui.closePanel).toHaveBeenCalledOnce()
  })

  it('drops the inject confirm when the panel is opened again', () => {
    const ui = mountPanel()
    fireEvent.click(screen.getByRole('button', { name: /每日站会/ }))
    expect(screen.getByRole('dialog', { name: zh['panel.inject.confirm.title'] })).toBeTruthy()
    act(() => { ui.store.update(draft => { draft.panelOpen = false }) })
    act(() => { ui.store.update(draft => { draft.panelOpen = true }) })
    expect(screen.queryByRole('dialog', { name: zh['panel.inject.confirm.title'] })).toBeNull()
  })
})

describe('SopCapsulesPanel pick Replace/Append semantics', () => {
  it('Replace sets draft to body only; Append joins with blank lines when draft is non-empty', () => {
    let draft = '已有草稿'
    const ui = mountPanel({
      view: { injectMode: 'replace' },
      readDraft: () => draft,
      writeDraft: (text) => { draft = text },
      injectCapsule: (body) => {
        const mode = 'replace'
        const current = ui.readDraft()
        const next = mode === 'replace'
          ? body
          : (current.trim() === '' ? body : `${current}\n\n${body}`)
        ui.writeDraft(next)
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /每日站会/ }))
    fireEvent.click(screen.getByRole('button', { name: zh['panel.inject.confirm.replace'] }))
    expect(draft).toBe('站会 SOP 正文')

    draft = '已有草稿'
    ui.injectCapsule.mockImplementation((body: string) => {
      const current = ui.readDraft()
      ui.writeDraft(current.trim() === '' ? body : `${current}\n\n${body}`)
    })
    fireEvent.click(screen.getByRole('button', { name: /代码评审/ }))
    fireEvent.click(screen.getByRole('button', { name: zh['panel.inject.confirm.append'] }))
    expect(draft).toBe('已有草稿\n\n评审 SOP 正文')
  })
})

describe('SopCapsulesPanel empty states', () => {
  it('distinguishes empty group from no search results', () => {
    mountPanel({ view: { capsules: [], groupStatus: 'ready', searchQuery: '' } })
    expect(screen.getByText(zh['panel.empty.group'])).toBeTruthy()

    cleanup()
    mountPanel({ view: { capsules: GROUP_A.capsules, groupStatus: 'ready', searchQuery: 'zzz' } })
    expect(screen.getByText(zh['panel.empty.search'])).toBeTruthy()
  })
})

describe('SopCapsulesPanel loading and error', () => {
  it('shows skeleton while group capsules are loading', () => {
    mountPanel({ view: { groupStatus: 'loading', capsules: [] } })
    expect(document.querySelector('[data-sop-capsules-skeleton="true"]')).toBeTruthy()
  })

  it('shows group error banner and allows retry to recover', async () => {
    const ui = mountPanel({
      view: {
        groupStatus: 'error',
        groupError: zh['panel.error.remote'],
        capsules: [],
      },
    })
    expect(screen.getByRole('alert').textContent).toContain(zh['panel.error.remote'])
    fireEvent.click(screen.getByRole('button', { name: zh['panel.error.retry'] }))
    expect(ui.retryGroupLoad).toHaveBeenCalledOnce()
  })

  it('shows no-workspace body when library status is no-workspace', () => {
    mountPanel({ view: { libraryStatus: 'no-workspace', groups: [], capsules: [] } })
    expect(screen.getByText(zh['panel.noWorkspace.body'])).toBeTruthy()
  })

  it('disables capsule clicks while inject is in flight', () => {
    mountPanel({ view: { injecting: true } })
    const row = screen.getByRole('button', { name: /每日站会/ })
    expect(row.hasAttribute('disabled')).toBe(true)
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
 * Stub geometry for the capsule list and the open inject confirm.
 * @param scroller - capsule list scroller.
 * @param scrollerBottom - visible bottom of the scroller.
 * @param revealBottom - bottom of the inject confirm.
 * @param scrollHeight - content height before extra padding.
 */
function stubRevealGeometry(
  scroller: HTMLElement,
  scrollerBottom: number,
  revealBottom: number,
  scrollHeight: number,
): () => void {
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: scrollerBottom })
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

describe('SopCapsulesPanel reveal inject confirm', () => {
  it('keeps the panel at twice the one-capsule height when space above the composer allows it', () => {
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      right: 720,
      top: 0,
      bottom: 800,
      width: 720,
      height: 800,
      toJSON() { return {} },
    }) as DOMRect
    try {
      mountPanel({ view: { capsules: [{ id: 'c1', title: '打招呼', body: '你好' }] } })
      const panel = screen.getByRole('region', { name: zh['panel.title'] })
      expect(panel.style.minHeight).toBe('342px')
      expect(panel.style.maxHeight).toBe('480px')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original
    }
  })

  it('grows and scrolls a short capsule list until the inject confirm is fully visible', () => {
    mountPanel({
      view: { capsules: [{ id: 'c1', title: '打招呼', body: '你好，我是南哥。' }] },
    })
    const scroller = document.querySelector('[class*="contentScroll"]')
    expect(scroller).toBeInstanceOf(HTMLElement)
    const list = scroller as HTMLElement
    const restore = stubRevealGeometry(list, 100, 178, 100)
    try {
      fireEvent.click(screen.getByRole('button', { name: /打招呼/ }))
      expect(list.scrollTop).toBe(86)
      expect(list.style.paddingBottom).toBe('86px')
      fireEvent.click(screen.getByRole('button', { name: zh['panel.manage.cancel'] }))
      expect(list.style.paddingBottom).toBe('')
    } finally {
      restore()
    }
  })
})
