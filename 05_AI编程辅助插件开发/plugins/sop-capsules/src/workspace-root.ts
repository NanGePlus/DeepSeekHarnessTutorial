/**
 * Resolve `.dsh/sop-capsules/` from a Session id via workspace entity membership.
 */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { realpathNormalize } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-workspace'

/** Thrown when the session is not bound to a workspace entity. */
export function noWorkspaceError(): RemoteError {
  return new RemoteError('sop-capsules/no-workspace', 'session has no workspace entity for SOP library IO', {})
}

/**
 * Locate the library root directory for a Session.
 * @param ctx - Host context with sessions and workspace registry.
 * @param sessionId - wire Session identity.
 * @returns absolute path to `.dsh/sop-capsules/` under the workspace root.
 */
export async function resolveLibraryRoot(ctx: Context, sessionId: SessionId): Promise<string> {
  const registry = ctx.get('workspaceRegistry')
  if (registry === undefined) throw noWorkspaceError()

  const live = ctx.sessions.get(sessionId)?.header
  const stored = live === undefined
    ? await ctx.get('sessionPersistence')?.stat(sessionId)
    : undefined
  const header = live ?? stored?.header
  if (header?.cwd === undefined) throw noWorkspaceError()

  let canonicalCwd: string
  try {
    canonicalCwd = await realpathNormalize(header.cwd)
  } catch {
    throw noWorkspaceError()
  }

  for (const workspace of registry.list()) {
    if (!workspace.sessionIds.includes(sessionId)) continue
    if (workspace.path !== canonicalCwd) continue
    return join(workspace.path, '.dsh', 'sop-capsules')
  }
  throw noWorkspaceError()
}
