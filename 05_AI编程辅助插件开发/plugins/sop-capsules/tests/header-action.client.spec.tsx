// @vitest-environment jsdom
/**
 * Session-header SOP capsules entry: workspace gating, first library load
 * spinner, and panel open/close wiring (Issue #18).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { SopCapsulesHeaderAction } from '../src/client/SopCapsulesHeaderAction.tsx'
import type { SopCapsulesSessionView } from '../src/client/surface.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SESSION = 'sess-1' as SessionId
const WORKSPACE = 'ws-1' as WorkspaceId
const t = makeTranslate(zh)

function workspaceState(hasWorkspace: boolean) {
  return {
    items: hasWorkspace
      ? [{ workspaceId: WORKSPACE, title: 'Proj', path: '/proj', sessionIds: [SESSION] }]
      : [],
    archivedSessionIds: [],
    state: 'idle' as const,
    phase: 'ready' as const,
    error: null,
  }
}

function mountHeader(options: {
  hasWorkspace?: boolean
  view?: Partial<SopCapsulesSessionView>
  ensureLibrary?: () => void
  openPanel?: () => void
} = {}) {
  const store = createSnapshotStore<SopCapsulesSessionView>({
    libraryStatus: 'idle',
    panelOpen: false,
    panelMode: 'pick',
    groups: [],
    listError: null,
    selectedGroupId: null,
    groupStatus: 'idle',
    capsules: [],
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
  const ensureLibrary = vi.fn(options.ensureLibrary ?? (() => {}))
  const openPanel = vi.fn(options.openPanel ?? (() => { store.update(draft => { draft.panelOpen = true }) }))
  const ws = workspaceState(options.hasWorkspace ?? true)
  const useWorkspaces = (<T,>(select: (state: typeof ws) => T): T => select(ws)) as never
  const useSessions = (() => { throw new Error('unused') }) as never
  const useSopCapsules = bindSnapshotSelector(store)

  const props = {
    sessionId: SESSION,
    useWorkspaces,
    useSessions,
    useSopCapsules,
    ensureLibrary,
    openPanel,
    t,
  } as unknown as Parameters<typeof SopCapsulesHeaderAction>[0]

  return { ...render(<SopCapsulesHeaderAction {...props} />), ensureLibrary, openPanel, store }
}

describe('SopCapsulesHeaderAction default', () => {
  it('renders the session-header entry with locale aria and stays enabled when the session has a workspace', () => {
    const ui = mountHeader({ hasWorkspace: true, view: { libraryStatus: 'ready' } })
    const button = screen.getByRole('button', { name: zh['header.aria'] })
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(ui.ensureLibrary).toHaveBeenCalledOnce()
  })

  it('opens the panel overlay when the enabled entry is clicked', () => {
    const ui = mountHeader({ view: { libraryStatus: 'ready' } })
    fireEvent.click(screen.getByRole('button', { name: zh['header.aria'] }))
    expect(ui.openPanel).toHaveBeenCalledOnce()
  })
})

describe('SopCapsulesHeaderAction disabled', () => {
  it('disables the entry without a workspace and shows the no-workspace tooltip on hover', async () => {
    const ui = mountHeader({ hasWorkspace: false })
    const button = screen.getByRole('button', { name: zh['header.aria'] })
    expect(button.hasAttribute('disabled')).toBe(true)
    const anchor = document.querySelector('[data-sop-capsules-header] span') as HTMLElement
    fireEvent.mouseEnter(anchor)
    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toBe(zh['header.tooltip.noWorkspace'])
    })
    fireEvent.click(button)
    expect(ui.openPanel).not.toHaveBeenCalled()
  })
})

describe('SopCapsulesHeaderAction loading', () => {
  it('shows a spinner while the first listLibrary is in flight but keeps the entry enabled with a workspace', () => {
    mountHeader({ view: { libraryStatus: 'loading' } })
    const button = screen.getByRole('button', { name: zh['header.aria'] })
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(document.querySelector('[data-sop-capsules-loading="true"]')).toBeTruthy()
  })
})
