/**
 * Per-session SOP capsules client state: library load, pick/manage overlay, and Remote mutations.
 * @module @nangeagi/dsh-sop-capsules/client/surface
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { parseGroupYaml, stringifyGroupYaml } from '../group-yaml.ts'
import type { SopCapsule, SopCapsuleGroup, SopLibraryGroupSummary, SopLibrarySummary } from '../types.ts'

/** Progress of the session's first `listLibrary` read for header gating. */
export type SopCapsulesLibraryStatus = 'idle' | 'loading' | 'ready' | 'no-workspace'

/** Overlay panel mode. */
export type SopCapsulesPanelMode = 'pick' | 'manage'

/** Load lifecycle for the selected group's capsule list. */
export type SopCapsulesGroupStatus = 'idle' | 'loading' | 'ready' | 'error'

/** In-progress manage editor; retained when `saveGroup` returns RemoteError. */
export type SopCapsulesEditor =
  | { readonly kind: 'none' }
  | { readonly kind: 'group-new'; readonly displayName: string }
  | { readonly kind: 'group-rename'; readonly groupId: string; readonly displayName: string }
  | { readonly kind: 'capsule-new'; readonly title: string; readonly body: string }
  | { readonly kind: 'capsule-edit'; readonly capsuleId: string; readonly title: string; readonly body: string }

/** Pending destructive or import confirm dialog. */
export type SopCapsulesConfirm =
  | null
  | { readonly kind: 'delete-group'; readonly groupId: string }
  | { readonly kind: 'delete-capsule'; readonly capsuleId: string }
  | {
    readonly kind: 'import-group'
    readonly group: SopCapsuleGroup
    readonly deleteCount: number
  }

/** Host mutate methods used by the manage path. */
export interface SopCapsulesMutateRemote {
  saveGroup: (
    sessionId: SessionId,
    group: SopCapsuleGroup,
    signal?: AbortSignal,
  ) => Promise<RemoteResult<void>>
  deleteGroup: (
    sessionId: SessionId,
    groupId: string,
    signal?: AbortSignal,
  ) => Promise<RemoteResult<void>>
  reorderGroups: (
    sessionId: SessionId,
    groupIds: readonly string[],
    signal?: AbortSignal,
  ) => Promise<RemoteResult<void>>
}

/** Immutable view shared by the header entry and composer overlay. */
export interface SopCapsulesSessionView {
  /** First library fetch lifecycle for the bound workspace. */
  libraryStatus: SopCapsulesLibraryStatus
  /** Whether the sop-capsules-panel overlay is open. */
  panelOpen: boolean
  /** Pick vs manage segmented mode (pick is default). */
  panelMode: SopCapsulesPanelMode
  /** Group summaries from the last successful `listLibrary`. */
  groups: readonly SopLibraryGroupSummary[]
  /** User-visible list-level Remote failure (banner). */
  listError: string | null
  /** Selected group id in pick/manage sidebars. */
  selectedGroupId: string | null
  /** Selected group capsule fetch lifecycle. */
  groupStatus: SopCapsulesGroupStatus
  /** Capsules for the selected group when `groupStatus` is `ready`. */
  capsules: readonly SopCapsule[]
  /** User-visible group-level Remote failure (banner). */
  groupError: string | null
  /** Title filter within the selected group (kept across Pick/Manage). */
  searchQuery: string
  /** Replace vs Append composer injection preference. */
  injectMode: 'replace' | 'append'
  /** True while one inject call is in flight (disables repeat clicks). */
  injecting: boolean
  /** Open manage editor form; kept after a failed save so the user can retry. */
  editor: SopCapsulesEditor
  /** Open delete confirmation, if any. */
  confirm: SopCapsulesConfirm
  /** True while a save/delete/reorder Remote call is in flight. */
  mutationStatus: 'idle' | 'submitting'
  /** User-visible mutation failure kept with the editor. */
  mutationError: string | null
  /** Informational banner after Host adopted orphan groups on `listLibrary`. */
  orphanBanner: boolean
}

const INITIAL: SopCapsulesSessionView = Object.freeze({
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
  editor: { kind: 'none' as const },
  confirm: null,
  mutationStatus: 'idle',
  mutationError: null,
  orphanBanner: false,
})

/** localStorage key for workspace-scoped Replace/Append preference. */
export function injectModeStorageKey(workspaceId: string): string {
  return `sop-capsules:inject-mode:${workspaceId}`
}

/**
 * Mint a file-safe group-id or capsule-id. v1 never offers a rename-id UI.
 * @param prefix - `g` for groups, `c` for capsules.
 * @returns a unique id.
 */
export function newStableId(prefix: 'g' | 'c'): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/**
 * Move `draggedId` to the current index of `targetId`.
 * @param ids - current order.
 * @param draggedId - id being dropped.
 * @param targetId - drop target id.
 * @returns a new ordered array, or the original order when ids are unknown.
 */
export function moveIdBefore(
  ids: readonly string[],
  draggedId: string,
  targetId: string,
): readonly string[] {
  if (draggedId === targetId) return ids
  const from = ids.indexOf(draggedId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, draggedId)
  return next
}

/** File-stem group-id from an import/export filename. */
function groupIdFromFilename(filename: string): string {
  return filename.replace(/\.(ya?ml)$/i, '')
}

/**
 * Session-scoped SOP capsules controller backing header and overlay entries.
 */
export class SopCapsulesSurface {
  /** Shared session view for inject hooks. */
  readonly state: SnapshotStore<SopCapsulesSessionView>

  private disposed = false
  private groupRequest = 0

  /**
   * @param listLibrary - Host `sopCapsules.listLibrary` for this session.
   * @param getGroup - Host `sopCapsules.getGroup` for this session.
   * @param sessionId - owning session id.
   * @param mutate - Host save/delete/reorder used by manage CRUD.
   */
  constructor(
    private readonly listLibrary: (
      sessionId: SessionId,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<SopLibrarySummary>>,
    private readonly getGroup: (
      sessionId: SessionId,
      groupId: string,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<SopCapsuleGroup>>,
    private readonly sessionId: SessionId,
    private readonly mutate: SopCapsulesMutateRemote,
  ) {
    this.state = createSnapshotStore({ ...INITIAL })
  }

  /** Start the first library read when the session has a workspace binding. */
  ensureLibrary(): void {
    if (this.disposed) return
    const status = this.state.getSnapshot().libraryStatus
    if (status === 'loading' || status === 'ready' || status === 'no-workspace') return
    this.state.update(draft => {
      draft.listError = null
      draft.libraryStatus = 'loading'
    })
    void this.listLibrary(this.sessionId).then((result) => {
      if (this.disposed) return
      this.state.update((draft) => {
        if (!result.ok) {
          draft.libraryStatus = result.error.code === 'sop-capsules/no-workspace'
            ? 'no-workspace'
            : 'idle'
          if (result.error.code !== 'sop-capsules/no-workspace') {
            draft.listError = result.error.message
          }
          return
        }
        draft.libraryStatus = 'ready'
        draft.groups = result.value.groups
        draft.listError = null
        if (result.value.adoptedOrphanIds.length > 0) draft.orphanBanner = true
        if (draft.selectedGroupId === null && result.value.groups.length > 0) {
          draft.selectedGroupId = result.value.groups[0]!.id
        }
      })
      const selected = this.state.getSnapshot().selectedGroupId
      if (selected !== null) this.loadGroup(selected)
    }).catch(() => {
      if (this.disposed) return
      this.state.update(draft => {
        draft.libraryStatus = 'idle'
        draft.listError = 'Remote unavailable'
      })
    })
  }

  /** Open the composer overlay panel for this session. */
  openPanel(): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.panelOpen = true
      draft.panelMode = 'pick'
    })
    this.ensureLibrary()
    const { selectedGroupId, groupStatus, libraryStatus } = this.state.getSnapshot()
    if (libraryStatus === 'ready' && selectedGroupId !== null && groupStatus === 'idle') {
      this.loadGroup(selectedGroupId)
    }
  }

  /** Close the composer overlay panel for this session. */
  closePanel(): void {
    if (this.disposed) return
    this.state.update(draft => { draft.panelOpen = false })
  }

  /** Switch segmented panel mode. */
  setPanelMode(mode: SopCapsulesPanelMode): void {
    if (this.disposed) return
    this.state.update(draft => { draft.panelMode = mode })
  }

  /** Select a group and load its capsules. */
  selectGroup(groupId: string): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.selectedGroupId = groupId
      draft.searchQuery = ''
    })
    this.loadGroup(groupId)
  }

  /** Update the pick-path title filter. */
  setSearchQuery(query: string): void {
    if (this.disposed) return
    this.state.update(draft => { draft.searchQuery = query })
  }

  /** Update Replace/Append preference in session view. */
  setInjectMode(mode: 'replace' | 'append'): void {
    if (this.disposed) return
    this.state.update(draft => { draft.injectMode = mode })
  }

  /** Dismiss the orphan-group informational banner. */
  dismissOrphanBanner(): void {
    if (this.disposed) return
    this.state.update(draft => { draft.orphanBanner = false })
  }

  /** Clear list-level error banner state. */
  dismissListError(): void {
    if (this.disposed) return
    this.state.update(draft => { draft.listError = null })
  }

  /** Retry loading the selected group after a Remote failure. */
  retryGroupLoad(): void {
    if (this.disposed) return
    const groupId = this.state.getSnapshot().selectedGroupId
    if (groupId === null) return
    this.loadGroup(groupId)
  }

  /**
   * Inject one capsule body into the composer draft and close on success.
   * When `prepare` is set, the draft is written after it settles, including
   * when it rejects, so a catalog failure still injects plain text.
   * @param body - capsule body text.
   * @param readDraft - current composer draft projection.
   * @param writeDraft - replace composer draft.
   * @param close - close overlay after inject.
   * @param prepare - optional work that must finish before the draft is written.
   */
  injectCapsule(
    body: string,
    readDraft: () => string,
    writeDraft: (text: string) => void,
    close: () => void,
    prepare?: () => Promise<void>,
  ): void {
    if (this.disposed) return
    if (this.state.getSnapshot().injecting) return
    const write = (): void => {
      if (this.disposed) return
      const mode = this.state.getSnapshot().injectMode
      const current = readDraft()
      const next = mode === 'replace'
        ? body
        : (current.trim() === '' ? body : `${current}\n\n${body}`)
      writeDraft(next)
      close()
    }
    this.state.update(draft => { draft.injecting = true })
    if (prepare === undefined) {
      try {
        write()
      } finally {
        this.state.update(draft => { draft.injecting = false })
      }
      return
    }
    void prepare().then(write, write).finally(() => {
      if (this.disposed) return
      this.state.update(draft => { draft.injecting = false })
    })
  }

  /** Open an empty new-group editor. */
  beginNewGroup(): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.editor = { kind: 'group-new', displayName: '' }
      draft.mutationError = null
    })
  }

  /**
   * Open a rename editor for a group's displayName.
   * @param groupId - target group id.
   */
  beginRenameGroup(groupId: string): void {
    if (this.disposed) return
    const group = this.state.getSnapshot().groups.find(row => row.id === groupId)
    this.state.update(draft => {
      draft.editor = {
        kind: 'group-rename',
        groupId,
        displayName: group?.displayName ?? '',
      }
      draft.mutationError = null
    })
  }

  /** Open an empty new-capsule editor for the selected group. */
  beginNewCapsule(): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.editor = { kind: 'capsule-new', title: '', body: '' }
      draft.mutationError = null
    })
  }

  /**
   * Open an edit editor for one capsule's title and body.
   * @param capsuleId - target capsule id in the selected group.
   */
  beginEditCapsule(capsuleId: string): void {
    if (this.disposed) return
    const capsule = this.state.getSnapshot().capsules.find(row => row.id === capsuleId)
    this.state.update(draft => {
      draft.editor = {
        kind: 'capsule-edit',
        capsuleId,
        title: capsule?.title ?? '',
        body: capsule?.body ?? '',
      }
      draft.mutationError = null
    })
  }

  /**
   * Update displayName in an open group editor.
   * @param value - next displayName.
   */
  setEditorDisplayName(value: string): void {
    if (this.disposed) return
    this.state.update(draft => {
      if (draft.editor.kind === 'group-new' || draft.editor.kind === 'group-rename') {
        draft.editor = { ...draft.editor, displayName: value }
      }
    })
  }

  /**
   * Update title in an open capsule editor.
   * @param value - next title.
   */
  setEditorTitle(value: string): void {
    if (this.disposed) return
    this.state.update(draft => {
      if (draft.editor.kind === 'capsule-new' || draft.editor.kind === 'capsule-edit') {
        draft.editor = { ...draft.editor, title: value }
      }
    })
  }

  /**
   * Update body in an open capsule editor.
   * @param value - next body.
   */
  setEditorBody(value: string): void {
    if (this.disposed) return
    this.state.update(draft => {
      if (draft.editor.kind === 'capsule-new' || draft.editor.kind === 'capsule-edit') {
        draft.editor = { ...draft.editor, body: value }
      }
    })
  }

  /** Close the editor without calling Remote. */
  cancelEditor(): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.editor = { kind: 'none' }
      draft.mutationError = null
    })
  }

  /** Persist the open editor via `saveGroup`. On RemoteError the editor fields stay. */
  commitEditor(): void {
    if (this.disposed) return
    const snap = this.state.getSnapshot()
    if (snap.mutationStatus === 'submitting') return
    const editor = snap.editor
    if (editor.kind === 'none') return
    this.state.update(draft => {
      draft.mutationStatus = 'submitting'
      draft.mutationError = null
    })
    void this.persistEditor(editor).then((error) => {
      if (this.disposed) return
      this.state.update(draft => {
        draft.mutationStatus = 'idle'
        if (error !== null) {
          draft.mutationError = error
          return
        }
        draft.editor = { kind: 'none' }
        draft.mutationError = null
      })
    })
  }

  /**
   * Open delete-group confirmation.
   * @param groupId - group to delete after confirm.
   */
  requestDeleteGroup(groupId: string): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.confirm = { kind: 'delete-group', groupId }
      draft.mutationError = null
    })
  }

  /**
   * Open delete-capsule confirmation.
   * @param capsuleId - capsule to delete after confirm.
   */
  requestDeleteCapsule(capsuleId: string): void {
    if (this.disposed) return
    this.state.update(draft => {
      draft.confirm = { kind: 'delete-capsule', capsuleId }
      draft.mutationError = null
    })
  }

  /** Dismiss the confirm dialog without mutating. */
  cancelConfirm(): void {
    if (this.disposed) return
    this.state.update(draft => { draft.confirm = null })
  }

  /** Run the pending confirm after the user confirms. */
  confirmMutation(): void {
    if (this.disposed) return
    const snap = this.state.getSnapshot()
    if (snap.mutationStatus === 'submitting' || snap.confirm === null) return
    const pending = snap.confirm
    this.state.update(draft => {
      draft.mutationStatus = 'submitting'
      draft.mutationError = null
    })
    void this.persistDelete(pending).then((error) => {
      if (this.disposed) return
      this.state.update(draft => {
        draft.mutationStatus = 'idle'
        if (error !== null) {
          draft.mutationError = error
          return
        }
        draft.confirm = null
        draft.mutationError = null
      })
    })
  }

  /**
   * Parse a single-group yaml file and open the import confirm dialog.
   * @param filename - download or upload name; stem is the group-id.
   * @param raw - yaml document isomorphic with `groups/<group-id>.yaml`.
   */
  async prepareImport(filename: string, raw: string): Promise<void> {
    if (this.disposed) return
    const groupId = groupIdFromFilename(filename).trim()
    if (groupId === '') {
      this.state.update(draft => { draft.mutationError = 'invalid group file' })
      return
    }
    try {
      const group = parseGroupYaml(raw, groupId)
      let deleteCount = 0
      const known = this.state.getSnapshot().groups.some(row => row.id === groupId)
      if (known) {
        const current = await this.getGroup(this.sessionId, groupId)
        if (!current.ok) {
          this.state.update(draft => { draft.mutationError = current.error.message })
          return
        }
        const incoming = new Set(group.capsules.map(row => row.id))
        deleteCount = current.value.capsules.filter(row => !incoming.has(row.id)).length
      }
      this.state.update(draft => {
        draft.confirm = { kind: 'import-group', group, deleteCount }
        draft.mutationError = null
      })
    } catch (error: unknown) {
      // Invalid yaml or missing required group fields.
      void error
      this.state.update(draft => { draft.mutationError = 'invalid group file' })
    }
  }

  /**
   * Serialize the selected group as `groups/<group-id>.yaml`.
   * @returns filename plus yaml body, or null when no group is selected or Remote fails.
   */
  async exportSelectedGroup(): Promise<{ readonly filename: string; readonly body: string } | null> {
    if (this.disposed) return null
    const groupId = this.state.getSnapshot().selectedGroupId
    if (groupId === null) return null
    try {
      const result = await this.getGroup(this.sessionId, groupId)
      if (!result.ok) {
        this.state.update(draft => { draft.mutationError = result.error.message })
        return null
      }
      return { filename: `${result.value.id}.yaml`, body: stringifyGroupYaml(result.value) }
    } catch (error: unknown) {
      // Typert Remote client threw instead of returning `{ ok: false }`.
      void error
      this.state.update(draft => { draft.mutationError = 'Remote unavailable' })
      return null
    }
  }

  /**
   * Persist a new group order covering every registered group-id.
   * @param groupIds - ordered ids.
   */
  reorderGroups(groupIds: readonly string[]): void {
    if (this.disposed) return
    if (this.state.getSnapshot().mutationStatus === 'submitting') return
    this.state.update(draft => {
      draft.mutationStatus = 'submitting'
      draft.mutationError = null
    })
    void this.mutate.reorderGroups(this.sessionId, groupIds).then(async (result) => {
      if (this.disposed) return
      if (!result.ok) {
        this.state.update(draft => {
          draft.mutationStatus = 'idle'
          draft.mutationError = result.error.message
        })
        return
      }
      await this.refreshLibrary()
      this.state.update(draft => {
        draft.mutationStatus = 'idle'
        draft.mutationError = null
      })
    }).catch(() => {
      if (this.disposed) return
      this.state.update(draft => {
        draft.mutationStatus = 'idle'
        draft.mutationError = 'Remote unavailable'
      })
    })
  }

  /**
   * Persist a new capsule order inside the selected group.
   * @param capsuleIds - ordered capsule ids covering the selected group.
   */
  reorderCapsules(capsuleIds: readonly string[]): void {
    if (this.disposed) return
    const snap = this.state.getSnapshot()
    if (snap.mutationStatus === 'submitting' || snap.selectedGroupId === null) return
    const groupId = snap.selectedGroupId
    const displayName = snap.groups.find(row => row.id === groupId)?.displayName ?? groupId
    const byId = new Map(snap.capsules.map(row => [row.id, row]))
    const capsules = capsuleIds.flatMap((id) => {
      const row = byId.get(id)
      return row === undefined ? [] : [row]
    })
    if (capsules.length !== snap.capsules.length) return
    this.state.update(draft => {
      draft.mutationStatus = 'submitting'
      draft.mutationError = null
    })
    void this.mutate.saveGroup(this.sessionId, { id: groupId, displayName, capsules }).then((result) => {
      if (this.disposed) return
      if (!result.ok) {
        this.state.update(draft => {
          draft.mutationStatus = 'idle'
          draft.mutationError = result.error.message
        })
        return
      }
      this.loadGroup(groupId)
      this.state.update(draft => {
        draft.mutationStatus = 'idle'
        draft.mutationError = null
      })
    }).catch(() => {
      if (this.disposed) return
      this.state.update(draft => {
        draft.mutationStatus = 'idle'
        draft.mutationError = 'Remote unavailable'
      })
    })
  }

  /** Release the snapshot store listeners. */
  dispose(): void {
    this.disposed = true
  }

  private async persistEditor(editor: Exclude<SopCapsulesEditor, { kind: 'none' }>): Promise<string | null> {
    try {
      if (editor.kind === 'group-new') {
        const displayName = editor.displayName.trim()
        if (displayName === '') return 'displayName required'
        const group: SopCapsuleGroup = { id: newStableId('g'), displayName, capsules: [] }
        const result = await this.mutate.saveGroup(this.sessionId, group)
        if (!result.ok) return result.error.message
        await this.refreshLibrary()
        this.selectGroup(group.id)
        return null
      }
      if (editor.kind === 'group-rename') {
        const displayName = editor.displayName.trim()
        if (displayName === '') return 'displayName required'
        const current = await this.getGroup(this.sessionId, editor.groupId)
        if (!current.ok) return current.error.message
        const result = await this.mutate.saveGroup(this.sessionId, { ...current.value, displayName })
        if (!result.ok) return result.error.message
        await this.refreshLibrary()
        return null
      }
      const selected = this.state.getSnapshot().selectedGroupId
      if (selected === null) return 'no group selected'
      const current = await this.getGroup(this.sessionId, selected)
      if (!current.ok) return current.error.message
      const title = editor.title.trim()
      const body = editor.body.trim()
      if (title === '' || body === '') return 'title and body required'
      const capsules = editor.kind === 'capsule-new'
        ? [...current.value.capsules, { id: newStableId('c'), title, body }]
        : current.value.capsules.map(row => (
          row.id === editor.capsuleId ? { ...row, title, body } : row
        ))
      const result = await this.mutate.saveGroup(this.sessionId, { ...current.value, capsules })
      if (!result.ok) return result.error.message
      this.loadGroup(selected)
      return null
    } catch (error: unknown) {
      // Typert Remote client threw instead of returning `{ ok: false }`.
      void error
      return 'Remote unavailable'
    }
  }

  private async persistDelete(pending: Exclude<SopCapsulesConfirm, null>): Promise<string | null> {
    try {
      if (pending.kind === 'import-group') {
        const result = await this.mutate.saveGroup(this.sessionId, pending.group)
        if (!result.ok) return result.error.message
        await this.refreshLibrary()
        this.selectGroup(pending.group.id)
        return null
      }
      if (pending.kind === 'delete-group') {
        const result = await this.mutate.deleteGroup(this.sessionId, pending.groupId)
        if (!result.ok) return result.error.message
        const previous = this.state.getSnapshot().selectedGroupId
        await this.refreshLibrary()
        const groups = this.state.getSnapshot().groups
        if (previous === pending.groupId) {
          const next = groups[0]?.id ?? null
          this.state.update(draft => {
            draft.selectedGroupId = next
            draft.capsules = []
          })
          if (next !== null) this.loadGroup(next)
        }
        return null
      }
      const selected = this.state.getSnapshot().selectedGroupId
      if (selected === null) return 'no group selected'
      const current = await this.getGroup(this.sessionId, selected)
      if (!current.ok) return current.error.message
      const result = await this.mutate.saveGroup(this.sessionId, {
        ...current.value,
        capsules: current.value.capsules.filter(row => row.id !== pending.capsuleId),
      })
      if (!result.ok) return result.error.message
      this.loadGroup(selected)
      return null
    } catch (error: unknown) {
      // Typert Remote client threw instead of returning `{ ok: false }`.
      void error
      return 'Remote unavailable'
    }
  }

  private async refreshLibrary(): Promise<void> {
    const result = await this.listLibrary(this.sessionId)
    if (this.disposed) return
    this.state.update((draft) => {
      if (!result.ok) {
        draft.listError = result.error.message
        return
      }
      draft.groups = result.value.groups
      draft.listError = null
      if (result.value.adoptedOrphanIds.length > 0) draft.orphanBanner = true
    })
  }

  private loadGroup(groupId: string): void {
    const requestId = ++this.groupRequest
    this.state.update(draft => {
      draft.groupStatus = 'loading'
      draft.groupError = null
      draft.capsules = []
    })
    void this.getGroup(this.sessionId, groupId).then((result) => {
      if (this.disposed || requestId !== this.groupRequest) return
      this.state.update((draft) => {
        if (!result.ok) {
          draft.groupStatus = 'error'
          draft.groupError = result.error.message
          draft.capsules = []
          return
        }
        draft.groupStatus = 'ready'
        draft.capsules = result.value.capsules
        draft.groupError = null
      })
    }).catch(() => {
      if (this.disposed || requestId !== this.groupRequest) return
      this.state.update(draft => {
        draft.groupStatus = 'error'
        draft.groupError = 'Remote unavailable'
        draft.capsules = []
      })
    })
  }
}

/** Per-session surface cache owned by the browser plugin apply body. */
export type SopCapsulesSurfaceMap = Map<SessionId, SopCapsulesSurface>

/**
 * Resolve or create the surface for one session.
 * @param ctx - client root context carrying the remote namespace.
 * @param surfaces - session cache mutated by this helper.
 * @param sessionId - target session.
 * @returns the live surface for inject wiring.
 */
export function surfaceFor(
  ctx: ClientContext,
  surfaces: SopCapsulesSurfaceMap,
  sessionId: SessionId,
): SopCapsulesSurface {
  let surface = surfaces.get(sessionId)
  if (surface === undefined) {
    surface = new SopCapsulesSurface(
      (id, signal) => ctx.remote.sopCapsules.listLibrary(id, signal),
      (id, groupId, signal) => ctx.remote.sopCapsules.getGroup(id, groupId, signal),
      sessionId,
      {
        saveGroup: (id, group, signal) => ctx.remote.sopCapsules.saveGroup(id, group, signal),
        deleteGroup: (id, groupId, signal) => ctx.remote.sopCapsules.deleteGroup(id, groupId, signal),
        reorderGroups: (id, groupIds, signal) => ctx.remote.sopCapsules.reorderGroups(id, groupIds, signal),
      },
    )
    surfaces.set(sessionId, surface)
  }
  return surface
}
