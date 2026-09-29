/**
 * SOP capsules plugin, Host half: Typert Remote `sopCapsules` and workspace library IO.
 * @module @nangeagi/dsh-sop-capsules
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-workspace'
import * as library from './library-io.ts'
import type { SopCapsuleGroup, SopLibrarySummary } from './types.ts'
import { resolveLibraryRoot } from './workspace-root.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `sopCapsules` Remote namespace. */
    sopCapsules: SopCapsulesService
  }
}

/** Host Remote service for workspace SOP capsule library persistence. */
export class SopCapsulesService extends TypertRemoteService {
  static inject = ['sessions', 'workspaceRegistry', 'sessionPersistence'] as const

  /**
   * @param ctx - Host context carrying sessions and workspace registry.
   */
  constructor(ctx: Context) {
    super(ctx, 'sopCapsules')
  }

  /**
   * List registered groups for the session workspace library.
   * @param sessionId - Session whose workspace entity selects the library root.
   * @param signal - caller cancellation.
   */
  @Remote
  async listLibrary(sessionId: SessionId, signal: AbortSignal): Promise<SopLibrarySummary> {
    signal.throwIfAborted()
    const root = await resolveLibraryRoot(this.ctx, sessionId)
    return await library.listLibrary(root)
  }

  /**
   * Load one group yaml.
   * @param sessionId - Session whose workspace entity selects the library root.
   * @param groupId - stable group id.
   * @param signal - caller cancellation.
   */
  @Remote
  async getGroup(sessionId: SessionId, groupId: string, signal: AbortSignal): Promise<SopCapsuleGroup> {
    signal.throwIfAborted()
    const root = await resolveLibraryRoot(this.ctx, sessionId)
    return await library.getGroup(root, groupId)
  }

  /**
   * Create or replace one group and register new ids on the manifest.
   * @param sessionId - Session whose workspace entity selects the library root.
   * @param group - full group payload.
   * @param signal - caller cancellation.
   */
  @Remote
  async saveGroup(sessionId: SessionId, group: SopCapsuleGroup, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    const root = await resolveLibraryRoot(this.ctx, sessionId)
    await library.saveGroup(root, group)
  }

  /**
   * Delete one group file and remove it from the manifest.
   * @param sessionId - Session whose workspace entity selects the library root.
   * @param groupId - stable group id.
   * @param signal - caller cancellation.
   */
  @Remote
  async deleteGroup(sessionId: SessionId, groupId: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    const root = await resolveLibraryRoot(this.ctx, sessionId)
    await library.deleteGroup(root, groupId)
  }

  /**
   * Replace manifest group order.
   * @param sessionId - Session whose workspace entity selects the library root.
   * @param groupIds - ordered ids covering every registered group.
   * @param signal - caller cancellation.
   */
  @Remote
  async reorderGroups(sessionId: SessionId, groupIds: readonly string[], signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    const root = await resolveLibraryRoot(this.ctx, sessionId)
    await library.reorderGroups(root, groupIds)
  }
}

export default SopCapsulesService
