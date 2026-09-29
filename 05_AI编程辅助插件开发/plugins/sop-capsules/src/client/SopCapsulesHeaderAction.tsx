/** Session-header utility for the workspace SOP capsules panel. */
import { useEffect } from 'react'
import {
  IconListPenOutline16,
  IconLoadingOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SopCapsulesHeaderActionProps } from './slots.ts'
import css from './SopCapsulesHeaderAction.module.css'

/**
 * Icon control in the session header, left of the open-in-app button.
 * @param props - runtime slot currency, locale seat, and injected session verbs.
 * @returns the header action control.
 */
export function SopCapsulesHeaderAction({
  sessionId,
  useWorkspaces,
  useSopCapsules,
  ensureLibrary,
  openPanel,
  t,
}: SopCapsulesHeaderActionProps) {
  const hasWorkspace = useWorkspaces(state =>
    state.items.some(workspace => workspace.sessionIds.includes(sessionId)))
  const libraryStatus = useSopCapsules(state => state.libraryStatus)
  const workspaceBlocked = !hasWorkspace || libraryStatus === 'no-workspace'
  const loading = hasWorkspace && libraryStatus === 'loading'

  useEffect(() => {
    if (!hasWorkspace) return
    ensureLibrary()
  }, [hasWorkspace, ensureLibrary])

  const tooltip = workspaceBlocked ? t('header.tooltip.noWorkspace') : t('header.aria')
  const onClick = (): void => {
    if (workspaceBlocked) return
    openPanel()
  }

  const trigger = (
    <button
      type="button"
      className={css.trigger}
      aria-label={t('header.aria')}
      disabled={workspaceBlocked}
      onClick={onClick}
    >
      {loading
        ? (
          <span data-sop-capsules-loading="true" aria-hidden="true">
            <IconLoadingOutline16 size={14} className={css.spinner} />
          </span>
        )
        : <IconListPenOutline16 size={15} aria-hidden="true" />}
    </button>
  )

  return (
    <div className={css.root} data-sop-capsules-header="">
      <Tooltip label={tooltip} side="bottom" delayMs={400}>
        {workspaceBlocked
          ? (
            <span className={css.anchor} tabIndex={0}>
              {trigger}
            </span>
          )
          : trigger}
      </Tooltip>
    </div>
  )
}
