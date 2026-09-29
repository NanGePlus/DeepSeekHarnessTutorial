/**
 * Inject faces for the sop-capsules header utility and overlay entries.
 * @module @nangeagi/dsh-sop-capsules/client/slots
 */
import type {
  HostObservable, InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { NS } from './locales.ts'
import type { SopCapsulesPanelMode, SopCapsulesSessionView } from './surface.ts'

/** Injected business face for the session-header SOP capsules entry. */
export interface SopCapsulesHeaderInjected {
  hooks: {
    /** Shared per-session view (library load + panel open). */
    sopCapsules: HostObservable<SopCapsulesSessionView>
  }
  /** Kick off the first `listLibrary` when a workspace is bound. */
  ensureLibrary: () => void
  /** Open the sop-capsules-panel overlay. */
  openPanel: () => void
}

/** Full props for the session-header SOP capsules action. */
export type SopCapsulesHeaderActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<SopCapsulesHeaderInjected>

/** Injected business face for the composer overlay panel entry. */
export interface SopCapsulesPanelInjected {
  hooks: {
    /** Shared per-session view (library load + panel open). */
    sopCapsules: HostObservable<SopCapsulesSessionView>
  }
  /** Close the sop-capsules-panel overlay. */
  closePanel: () => void
  /** Read the current composer draft projection. */
  readDraft: () => string
  /** Replace the composer draft. */
  writeDraft: (text: string) => void
  /** Select a library group and load its capsules. */
  selectGroup: (groupId: string) => void
  /** Update the pick-path title filter. */
  setSearchQuery: (query: string) => void
  /** Switch Replace vs Append injection mode (workspace-persisted). */
  setInjectMode: (mode: 'replace' | 'append') => void
  /** Inject one capsule body into the composer draft. */
  injectCapsule: (body: string) => void
  /** Switch segmented panel mode. */
  setPanelMode: (mode: SopCapsulesPanelMode) => void
  /** Ensure library summaries are loaded when the overlay opens. */
  ensureLibrary: () => void
  /** Clear list-level error banner state. */
  dismissListError: () => void
  /** Retry loading the selected group after Remote failure. */
  retryGroupLoad: () => void
  /** Open the new-group editor. */
  beginNewGroup: () => void
  /** Open the rename editor for one group. */
  beginRenameGroup: (groupId: string) => void
  /** Open the new-capsule editor. */
  beginNewCapsule: () => void
  /** Open the title/body editor for one capsule. */
  beginEditCapsule: (capsuleId: string) => void
  /** Update displayName in the open group editor. */
  setEditorDisplayName: (value: string) => void
  /** Update title in the open capsule editor. */
  setEditorTitle: (value: string) => void
  /** Update body in the open capsule editor. */
  setEditorBody: (value: string) => void
  /** Persist the open editor via `saveGroup`. */
  commitEditor: () => void
  /** Close the editor without saving. */
  cancelEditor: () => void
  /** Open delete-group confirmation. */
  requestDeleteGroup: (groupId: string) => void
  /** Open delete-capsule confirmation. */
  requestDeleteCapsule: (capsuleId: string) => void
  /** Dismiss the confirm dialog. */
  cancelConfirm: () => void
  /** Run the pending confirm after the user confirms. */
  confirmMutation: () => void
  /** Persist a new group order. */
  reorderGroups: (groupIds: readonly string[]) => void
  /** Persist a new capsule order in the selected group. */
  reorderCapsules: (capsuleIds: readonly string[]) => void
  /**
   * Serialize the selected group and return a downloadable yaml file.
   * @returns filename plus body, or null when export cannot run.
   */
  exportSelectedGroup: () => Promise<{ readonly filename: string; readonly body: string } | null>
  /**
   * Parse uploaded group yaml and open the import confirm dialog.
   * @param filename - original file name; stem is the group-id.
   * @param raw - yaml body.
   */
  prepareImport: (filename: string, raw: string) => Promise<void>
  /** Dismiss the orphan-group informational banner. */
  dismissOrphanBanner: () => void
}

/** Full props for the sop-capsules-panel overlay entry. */
export type SopCapsulesPanelProps =
  PropsRuntime<'conversation.input.overlay'>
  & PropsLocale<typeof NS>
  & InjectFace<SopCapsulesPanelInjected>
