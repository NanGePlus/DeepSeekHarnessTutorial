/**
 * Domain types for the workspace SOP capsule library Host Remote.
 * @module @nangeagi/dsh-sop-capsules/types
 */

/** v1 manifest schema version written under `.dsh/sop-capsules/`. */
export const SOP_CAPSULES_SCHEMA_VERSION = 1

/** One capsule within a group. */
export interface SopCapsule {
  /** Stable capsule id within the group. */
  readonly id: string
  /** List title. */
  readonly title: string
  /** Default composer draft body on inject. */
  readonly body: string
}

/** Full group payload exchanged by `getGroup` / `saveGroup`. */
export interface SopCapsuleGroup {
  /** Stable group id (matches `groups/<id>.yaml`). */
  readonly id: string
  /** User-visible group name. */
  readonly displayName: string
  /** Ordered capsules in the group. */
  readonly capsules: readonly SopCapsule[]
}

/** One row in `listLibrary`. */
export interface SopLibraryGroupSummary {
  readonly id: string
  readonly displayName: string
}

/** `listLibrary` result. */
export interface SopLibrarySummary {
  readonly groups: readonly SopLibraryGroupSummary[]
  /** Group ids appended from disk orphans during this `listLibrary` call. */
  readonly adoptedOrphanIds: readonly string[]
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Session has no workspace entity bound for SOP library IO. */
    'sop-capsules/no-workspace': Record<string, never>
    /** Requested group id is absent from the library. */
    'sop-capsules/group-not-found': { readonly groupId: string }
  }
}
