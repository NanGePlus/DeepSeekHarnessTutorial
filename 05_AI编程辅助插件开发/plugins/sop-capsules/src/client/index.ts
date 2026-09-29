/**
 * SOP capsules plugin, browser half: session-header utility, composer overlay
 * pick/manage/import/export, locale registration, and per-session library load gating.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import sopCapsulesRemote from '@nangeagi/dsh-sop-capsules/remote'
import { SopCapsulesHeaderAction } from './SopCapsulesHeaderAction.tsx'
import { SopCapsulesPanel } from './SopCapsulesPanel.tsx'
import { en, NS, zh, type SopCapsulesKey } from './locales.ts'
import type { SopCapsulesHeaderInjected, SopCapsulesPanelInjected } from './slots.ts'
import { bindSlashRefDecoration, loadSlashSpellings, refreshSlashRefDecoration, type SlashCatalogRemote } from './slash-refs.ts'
import { surfaceFor, type SopCapsulesSurfaceMap } from './surface.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workspace SOP capsule library copy. */
    'sop-capsules': SopCapsulesKey
  }
}

/**
 * Loader-level inject cannot include `remote.sopCapsules`: that service exists
 * only after this plugin `$mount`s the generated `./remote` contribution.
 * Official Client remotes are mounted by `dsh-api-remotes`; a tree-outside
 * plugin mounts its own namespace (same pattern as experimental Agent Teams).
 * `remote.commands` and `remote.skills` are declared on the UI fiber below:
 * reading them without inject throws, and the slash catalog stays empty.
 */
export const inject = [
  'slots',
  'locale',
  'remote',
  'sessions',
  'conversation',
] as const

/**
 * Register locale dictionaries, header utility, and overlay after `remote.sopCapsules` exists.
 * @param ctx - client context that can read `remote.sopCapsules`.
 */
function registerUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'sop-capsules: dictionaries')

  const surfaces: SopCapsulesSurfaceMap = new Map()
  ctx.effect(() => () => {
    for (const surface of surfaces.values()) surface.dispose()
    surfaces.clear()
  }, 'sop-capsules: per-session surfaces')

  ctx.slots.inject(
    'conversation.session.header.utilities',
    () => ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'sop-capsules',
      // Immediately before the open-in-app split button (order -10).
      order: -20,
      locale: NS,
      inject: (sessionId: SessionId): SopCapsulesHeaderInjected => {
        const surface = surfaceFor(ctx, surfaces, sessionId)
        return {
          hooks: { sopCapsules: surface.state },
          ensureLibrary: () => { surface.ensureLibrary() },
          openPanel: () => { surface.openPanel() },
        }
      },
    }, SopCapsulesHeaderAction),
  )
  ctx.slots.inject(
    'conversation.input.overlay',
    () => ctx.slots.register({
      name: 'conversation.input.overlay',
      id: 'sop-capsules-panel',
      order: 10,
      locale: NS,
      inject: (sessionId: SessionId): SopCapsulesPanelInjected => {
        const surface = surfaceFor(ctx, surfaces, sessionId)
        const sessions = ctx.sessions as unknown as ISessions
        const inputForSession = () => {
          const scope = sessions.scope(sessionId)
          return scope === undefined ? undefined : ctx.conversation.input.for(scope)
        }
        return {
          hooks: { sopCapsules: surface.state },
          closePanel: () => { surface.closePanel() },
          readDraft: () => inputForSession()?.state.getSnapshot().draft ?? '',
          writeDraft: (text) => { inputForSession()?.setDraft(text) },
          selectGroup: (groupId) => { surface.selectGroup(groupId) },
          setSearchQuery: (query) => { surface.setSearchQuery(query) },
          setInjectMode: (mode) => { surface.setInjectMode(mode) },
          setPanelMode: (mode) => { surface.setPanelMode(mode) },
          ensureLibrary: () => { surface.ensureLibrary() },
          dismissListError: () => { surface.dismissListError() },
          retryGroupLoad: () => { surface.retryGroupLoad() },
          beginNewGroup: () => { surface.beginNewGroup() },
          beginRenameGroup: (groupId) => { surface.beginRenameGroup(groupId) },
          beginNewCapsule: () => { surface.beginNewCapsule() },
          beginEditCapsule: (capsuleId) => { surface.beginEditCapsule(capsuleId) },
          setEditorDisplayName: (value) => { surface.setEditorDisplayName(value) },
          setEditorTitle: (value) => { surface.setEditorTitle(value) },
          setEditorBody: (value) => { surface.setEditorBody(value) },
          commitEditor: () => { surface.commitEditor() },
          cancelEditor: () => { surface.cancelEditor() },
          requestDeleteGroup: (groupId) => { surface.requestDeleteGroup(groupId) },
          requestDeleteCapsule: (capsuleId) => { surface.requestDeleteCapsule(capsuleId) },
          cancelConfirm: () => { surface.cancelConfirm() },
          confirmMutation: () => { surface.confirmMutation() },
          reorderGroups: (groupIds) => { surface.reorderGroups(groupIds) },
          reorderCapsules: (capsuleIds) => { surface.reorderCapsules(capsuleIds) },
          exportSelectedGroup: () => surface.exportSelectedGroup(),
          prepareImport: (filename, raw) => surface.prepareImport(filename, raw),
          dismissOrphanBanner: () => { surface.dismissOrphanBanner() },
          injectCapsule: (body) => {
            const input = inputForSession()
            const remote = ctx.remote as unknown as SlashCatalogRemote
            const commandToken = ctx.locale.bind('command')
            surface.injectCapsule(
              body,
              () => input?.state.getSnapshot().draft ?? '',
              (text) => {
                input?.setDraft(text)
                refreshSlashRefDecoration(input)
              },
              () => { surface.closePanel() },
              async () => {
                const spellings = await loadSlashSpellings(
                  remote,
                  sessionId,
                  (name) => commandToken(`token.${name}`),
                )
                bindSlashRefDecoration(input, spellings)
              },
            )
          },
        }
      },
    }, SopCapsulesPanel),
  )
}

/**
 * Mount the generated `sopCapsules` Remote contribution, then register UI.
 * @param ctx - client root carrying `remote`.
 * @param contribution - generated Typert Remote descriptors for this package.
 * @returns disposer for UI fiber then Remote namespace.
 */
export async function mountSopCapsulesUi(
  ctx: ClientContext,
  contribution: TypertRemoteContribution,
): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(
    ['slots', 'locale', 'remote.sopCapsules', 'remote.commands', 'remote.skills', 'sessions', 'conversation'],
    registerUi,
  )
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await disposeRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await disposeRemote()
  }
}

/**
 * Client plugin body: mount `./remote`, then header + overlay.
 * @param ctx - client root context.
 * @returns disposer for UI and Remote namespace.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  return await mountSopCapsulesUi(ctx, sopCapsulesRemote)
}
