/** Composer overlay for SOP capsules pick, manage, import, and export. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  IconCloseOutline16,
  IconEditOutline16,
  IconSearchOutline16,
  IconTrashOutline16,
  Input,
  Modal,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SopCapsulesPanelProps } from './slots.ts'
import { injectModeStorageKey, moveIdBefore } from './surface.ts'
import css from './SopCapsulesPanel.module.css'

/**
 * Filter capsule titles within the selected group.
 * @param titles - capsule rows.
 * @param query - case-insensitive substring filter.
 * @returns visible rows.
 */
function filterCapsules<T extends { title: string }>(titles: readonly T[], query: string): readonly T[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return titles
  return titles.filter(row => row.title.toLowerCase().includes(needle))
}

/**
 * Resolve the workspace id bound to one session, if any.
 * @param sessionId - target session.
 * @param useWorkspaces - workspace catalog hook.
 * @returns workspace id or undefined.
 */
function workspaceForSession(
  sessionId: SessionId,
  useWorkspaces: SopCapsulesPanelProps['useWorkspaces'],
): WorkspaceId | undefined {
  const items = useWorkspaces(state => state.items)
  return items.find(item => item.sessionIds.includes(sessionId))?.workspaceId
}

function dndPayload(kind: 'group' | 'capsule', id: string): string {
  return `${kind}:${id}`
}

function parseDndPayload(raw: string): { kind: 'group' | 'capsule'; id: string } | null {
  const split = raw.indexOf(':')
  if (split <= 0) return null
  const kind = raw.slice(0, split)
  const id = raw.slice(split + 1)
  if ((kind !== 'group' && kind !== 'capsule') || id === '') return null
  return { kind, id }
}

/** Design cap for the panel body; runtime clamp uses space above the composer. */
const PANEL_MAX_HEIGHT = 480

/**
 * Outer floor for a short library. Twice the one-capsule panel (171px).
 * The runtime clamp still wins when the space above the composer is shorter.
 */
const PANEL_MIN_HEIGHT = 342

/** Gap kept between the panel and the top of the clipping conversation column. */
const PANEL_TOP_MARGIN = 12

/**
 * Top of the space the panel may occupy: the lowest clipping ancestor, else the viewport.
 * The conversation scroll body clips this overlay, so a viewport-only clamp still hides the header.
 * @param el - the bottom-anchored shell.
 * @returns the y coordinate the panel top must stay below.
 */
function panelCeiling(el: HTMLElement): number {
  let ceiling = PANEL_TOP_MARGIN
  let node = el.parentElement
  while (node !== null && node !== document.body && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden' || overflowY === 'clip') {
      ceiling = Math.max(ceiling, node.getBoundingClientRect().top + PANEL_TOP_MARGIN)
    }
    node = node.parentElement
  }
  return ceiling
}

/** Gap kept between a revealed editor or confirm and the list's bottom edge. */
const REVEAL_PAD = 8

/**
 * Scroll a panel list so an editor or confirm that hangs under its row is fully inside that list.
 * Absolute popovers do not extend the list's scroll range, so the list grows padding-bottom until the bottom edge clears.
 * @param node - open editor or confirm.
 * @param scrollers - the group list and the capsule list.
 */
function revealInPanelScroller(node: HTMLElement, scrollers: readonly HTMLElement[]): void {
  const scroller = scrollers.find(item => item.contains(node))
  if (scroller === undefined) return
  const box = scroller.getBoundingClientRect()
  const rect = node.getBoundingClientRect()
  if (rect.height === 0 || box.height === 0) return
  const overflow = rect.bottom - (box.bottom - REVEAL_PAD)
  if (overflow <= 1) return
  const room = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
  if (room + 1 < overflow) {
    const current = Number.parseFloat(scroller.style.paddingBottom) || 0
    scroller.style.paddingBottom = `${current + (overflow - room)}px`
  }
  scroller.scrollTop += overflow
}

/** True when this box can still scroll in the wheel direction. */
function consumesWheel(node: HTMLElement, deltaX: number, deltaY: number): boolean {
  const style = getComputedStyle(node)
  if (deltaY !== 0 && /(auto|scroll)/.test(style.overflowY)) {
    const max = node.scrollHeight - node.clientHeight
    if (max > 1 && ((deltaY < 0 && node.scrollTop > 0) || (deltaY > 0 && node.scrollTop < max - 1))) return true
  }
  if (deltaX !== 0 && /(auto|scroll)/.test(style.overflowX)) {
    const max = node.scrollWidth - node.clientWidth
    if (max > 1 && ((deltaX < 0 && node.scrollLeft > 0) || (deltaX > 0 && node.scrollLeft < max - 1))) return true
  }
  return false
}

function GroupNamePopover({
  displayName,
  submitting,
  setEditorDisplayName,
  commitEditor,
  cancelEditor,
  t,
}: {
  displayName: string
  submitting: boolean
  setEditorDisplayName: SopCapsulesPanelProps['setEditorDisplayName']
  commitEditor: SopCapsulesPanelProps['commitEditor']
  cancelEditor: SopCapsulesPanelProps['cancelEditor']
  t: SopCapsulesPanelProps['t']
}) {
  return (
    <form
      className={css.groupPopover}
      data-sop-reveal=""
      draggable={false}
      onDragStart={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onSubmit={event => {
        event.preventDefault()
        commitEditor()
      }}
    >
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('panel.manage.displayName')}</span>
        <Input
          aria-label={t('panel.manage.displayName')}
          value={displayName}
          onChange={event => { setEditorDisplayName(event.target.value) }}
        />
      </label>
      <div className={css.editorActions}>
        <button type="submit" className={css.primaryBtn} disabled={submitting}>
          {t('panel.manage.save')}
        </button>
        <button type="button" className={css.secondaryBtn} onClick={() => { cancelEditor() }}>
          {t('panel.manage.cancel')}
        </button>
      </div>
    </form>
  )
}

/**
 * Trigger a browser download of a text file.
 * @param filename - suggested download name (`<group-id>.yaml`).
 * @param body - file contents.
 */
function ConfirmPopover({
  title,
  body,
  actionLabel,
  submitting,
  confirmMutation,
  cancelConfirm,
  t,
}: {
  title: string
  body: string
  actionLabel: string
  submitting: boolean
  confirmMutation: SopCapsulesPanelProps['confirmMutation']
  cancelConfirm: SopCapsulesPanelProps['cancelConfirm']
  t: SopCapsulesPanelProps['t']
}) {
  return (
    <div className={css.groupPopover} role="dialog" aria-label={title} data-sop-reveal="">
      <p className={css.confirmTitle}>{title}</p>
      <p className={css.confirmBody}>{body}</p>
      <div className={css.editorActions}>
        <button type="button" className={css.secondaryBtn} disabled={submitting} onClick={() => { cancelConfirm() }}>
          {t('panel.manage.cancel')}
        </button>
        <button
          type="button"
          className={css.primaryBtn}
          disabled={submitting}
          aria-busy={submitting}
          aria-label={submitting ? t('panel.manage.submitting') : actionLabel}
          onClick={() => { confirmMutation() }}
        >
          {submitting ? t('panel.manage.submitting') : actionLabel}
        </button>
      </div>
    </div>
  )
}

function CapsuleEditorForm({
  title,
  body,
  submitting,
  reveal,
  setEditorTitle,
  setEditorBody,
  commitEditor,
  cancelEditor,
  t,
}: {
  title: string
  body: string
  submitting: boolean
  /** Scroll the capsule list until this form is fully visible. */
  reveal: boolean
  setEditorTitle: SopCapsulesPanelProps['setEditorTitle']
  setEditorBody: SopCapsulesPanelProps['setEditorBody']
  commitEditor: SopCapsulesPanelProps['commitEditor']
  cancelEditor: SopCapsulesPanelProps['cancelEditor']
  t: SopCapsulesPanelProps['t']
}) {
  return (
    <form
      className={css.editor}
      data-sop-reveal={reveal ? '' : undefined}
      draggable={false}
      onDragStart={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onSubmit={event => {
        event.preventDefault()
        commitEditor()
      }}
    >
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('panel.manage.capsuleTitle')}</span>
        <Input
          aria-label={t('panel.manage.capsuleTitle')}
          value={title}
          onChange={event => { setEditorTitle(event.target.value) }}
        />
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('panel.manage.capsuleBody')}</span>
        <textarea
          className={css.bodyInput}
          aria-label={t('panel.manage.capsuleBody')}
          value={body}
          rows={4}
          onChange={event => { setEditorBody(event.target.value) }}
        />
      </label>
      <div className={css.editorActions}>
        <button type="submit" className={css.primaryBtn} disabled={submitting}>
          {t('panel.manage.save')}
        </button>
        <button type="button" className={css.secondaryBtn} onClick={() => { cancelEditor() }}>
          {t('panel.manage.cancel')}
        </button>
      </div>
    </form>
  )
}

function downloadTextFile(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'text/yaml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * SOP capsules overlay: pick path (list, search, inject) and manage path (CRUD, reorder, import/export).
 * @param props - overlay slot currency and injected verbs.
 * @returns the panel while open, otherwise null.
 */
export function SopCapsulesPanel({
  sessionId,
  useWorkspaces,
  useSopCapsules,
  closePanel,
  selectGroup,
  setSearchQuery,
  setInjectMode,
  injectCapsule,
  setPanelMode,
  ensureLibrary,
  dismissListError,
  retryGroupLoad,
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
}: SopCapsulesPanelProps) {
  const view = useSopCapsules(state => state)
  const workspaceId = workspaceForSession(sessionId, useWorkspaces)
  const importInput = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const [panelMaxHeight, setPanelMaxHeight] = useState(PANEL_MAX_HEIGHT)
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (shell === null) return
    const fit = () => {
      const room = shell.getBoundingClientRect().bottom - panelCeiling(shell)
      setPanelMaxHeight(Math.min(PANEL_MAX_HEIGHT, Math.max(0, room)))
    }
    fit()
    const Observer = globalThis.ResizeObserver
    const observer = Observer === undefined ? null : new Observer(fit)
    if (observer !== null) {
      observer.observe(shell)
      let node = shell.parentElement
      while (node !== null) {
        observer.observe(node)
        node = node.parentElement
      }
    }
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', fit, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', fit, true)
    }
  }, [view.panelOpen])

  useEffect(() => {
    if (!view.panelOpen) return
    ensureLibrary()
  }, [ensureLibrary, view.panelOpen])

  useEffect(() => {
    const elements = [sidebarRef.current, contentScrollRef.current].filter(el => el !== null)
    const timers = new Map<HTMLElement, number>()
    const cleanups = elements.map(el => {
      const onScroll = () => {
        el.dataset.scrolling = ''
        window.clearTimeout(timers.get(el))
        timers.set(el, window.setTimeout(() => {
          delete el.dataset.scrolling
        }, 800))
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        window.clearTimeout(timers.get(el))
        el.removeEventListener('scroll', onScroll)
      }
    })
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [view.panelOpen, view.libraryStatus])

  useEffect(() => {
    const shell = shellRef.current
    if (shell === null) return
    const onWheel = (event: WheelEvent) => {
      let node: Element | null = event.target instanceof Element ? event.target : null
      while (node !== null && node !== shell) {
        if (node instanceof HTMLElement && consumesWheel(node, event.deltaX, event.deltaY)) return
        node = node.parentElement
      }
      event.preventDefault()
    }
    shell.addEventListener('wheel', onWheel, { passive: false })
    return () => { shell.removeEventListener('wheel', onWheel) }
  }, [view.panelOpen])

  useEffect(() => {
    if (!view.panelOpen || workspaceId === undefined) return
    const stored = localStorage.getItem(injectModeStorageKey(workspaceId))
    if (stored === 'replace' || stored === 'append') setInjectMode(stored)
  }, [setInjectMode, view.panelOpen, workspaceId])

  const [pendingInject, setPendingInject] = useState<{ id: string, body: string } | null>(null)
  useLayoutEffect(() => {
    if (view.editor.kind !== 'capsule-new') return
    const scroller = contentScrollRef.current
    if (scroller === null) return
    scroller.scrollTop = 0
  }, [view.editor.kind])
  const revealGroupId = view.editor.kind === 'group-rename' ? view.editor.groupId : ''
  const revealCapsuleId = view.editor.kind === 'capsule-edit' ? view.editor.capsuleId : ''
  const revealConfirmId = view.confirm?.kind === 'delete-group'
    ? view.confirm.groupId
    : view.confirm?.kind === 'delete-capsule'
      ? view.confirm.capsuleId
      : ''
  useLayoutEffect(() => {
    const scrollers = [sidebarRef.current, contentScrollRef.current].filter(el => el !== null)
    for (const scroller of scrollers) scroller.style.paddingBottom = ''
    const shell = shellRef.current
    if (shell === null) return
    for (const node of shell.querySelectorAll('[data-sop-reveal]')) {
      if (node instanceof HTMLElement) revealInPanelScroller(node, scrollers)
    }
  }, [view.editor.kind, revealGroupId, revealCapsuleId, view.confirm?.kind, revealConfirmId, pendingInject?.id])
  useEffect(() => {
    if (!view.panelOpen) setPendingInject(null)
  }, [view.panelOpen])

  const visibleCapsules = useMemo(
    () => filterCapsules(view.capsules, view.searchQuery),
    [view.capsules, view.searchQuery],
  )

  if (!view.panelOpen) return null

  const pickMode = view.panelMode === 'pick'
  const noWorkspace = view.libraryStatus === 'no-workspace'
  const submitting = view.mutationStatus === 'submitting'
  const editor = view.editor
  const confirm = view.confirm

  return (
    <div
      ref={shellRef}
      className={css.shell}
      data-sop-capsules-panel=""
      data-trigger-menu=""
    >
      <section
        className={css.panel}
        aria-label={t('panel.title')}
        style={{ maxHeight: panelMaxHeight, minHeight: Math.min(PANEL_MIN_HEIGHT, panelMaxHeight) }}
      >
        <header className={css.header}>
          <h2 className={css.title}>{t('panel.title')}</h2>
          <div className={css.modeSwitch} role="tablist" aria-label={t('panel.title')}>
            <button
              type="button"
              role="tab"
              className={pickMode ? css.modeActive : css.modeIdle}
              aria-selected={pickMode}
              onClick={() => { setPanelMode('pick') }}
            >
              {t('panel.mode.pick')}
            </button>
            <button
              type="button"
              role="tab"
              className={!pickMode ? css.modeActive : css.modeIdle}
              aria-selected={!pickMode}
              onClick={() => { setPanelMode('manage') }}
            >
              {t('panel.mode.manage')}
            </button>
          </div>
          <button
            type="button"
            className={css.close}
            aria-label={t('panel.close')}
            onClick={() => { closePanel() }}
          >
            <IconCloseOutline16 size={14} aria-hidden="true" />
          </button>
        </header>

        {view.listError !== null && (
          <div className={css.bannerError} role="alert">
            <span>{view.listError}</span>
            <button type="button" className={css.bannerAction} onClick={() => { dismissListError(); ensureLibrary() }}>
              {t('panel.error.retry')}
            </button>
          </div>
        )}

        {view.orphanBanner && (
          <div className={css.bannerInfo} role="status">
            <span>{t('panel.banner.orphan')}</span>
            <button type="button" className={css.bannerAction} onClick={() => { dismissOrphanBanner() }}>
              {t('panel.banner.orphan.dismiss')}
            </button>
          </div>
        )}

        {view.mutationError !== null && (
          <div className={css.bannerError} role="alert">
            <span>{view.mutationError}</span>
          </div>
        )}

        {noWorkspace ? (
          <div className={css.noWorkspace}>
            <p>{t('panel.noWorkspace.body')}</p>
            <button type="button" className={css.secondaryBtn} onClick={() => { closePanel() }}>
              {t('panel.close')}
            </button>
          </div>
        ) : (
          <div className={css.body}>
            <nav className={css.sidebar} aria-label={pickMode ? t('panel.mode.pick') : t('panel.mode.manage')}>
              <div className={css.sidebarHeader}>
                <h3 className={css.sidebarTitle}>{t('panel.manage.groupHeading')}</h3>
                {!pickMode && (
                  <div className={css.popoverAnchor}>
                    <button type="button" className={css.sidebarAction} onClick={() => { beginNewGroup() }}>
                      {t('panel.manage.newGroup')}
                    </button>
                    {editor.kind === 'group-new' && (
                      <GroupNamePopover
                        displayName={editor.displayName}
                        submitting={submitting}
                        setEditorDisplayName={setEditorDisplayName}
                        commitEditor={commitEditor}
                        cancelEditor={cancelEditor}
                        t={t}
                      />
                    )}
                  </div>
                )}
              </div>
              <div ref={sidebarRef} className={css.groupList}>
              {view.groups.map(group => (
                <div
                  key={group.id}
                  className={css.groupRow}
                  data-selected={group.id === view.selectedGroupId ? '' : undefined}
                  data-confirm={confirm?.kind === 'delete-group' && confirm.groupId === group.id ? '' : undefined}
                  onDragOver={event => {
                    if (pickMode) return
                    event.preventDefault()
                  }}
                  onDrop={event => {
                    if (pickMode) return
                    event.preventDefault()
                    const payload = parseDndPayload(event.dataTransfer.getData('text/plain'))
                    if (payload === null || payload.kind !== 'group') return
                    reorderGroups(moveIdBefore(view.groups.map(row => row.id), payload.id, group.id))
                  }}
                >
                  {!pickMode && (
                    <span
                      className={css.dragHandle}
                      draggable
                      aria-label={t('panel.manage.drag.group')}
                      onDragStart={event => {
                        event.stopPropagation()
                        event.dataTransfer.setData('text/plain', dndPayload('group', group.id))
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                    >
                      ⋮⋮
                    </span>
                  )}
                  <button
                    type="button"
                    className={group.id === view.selectedGroupId ? css.groupActive : css.groupItem}
                    aria-current={group.id === view.selectedGroupId ? 'true' : undefined}
                    onClick={() => { selectGroup(group.id) }}
                  >
                    {group.displayName}
                  </button>
                  {!pickMode && (
                    <span className={css.rowActions}>
                      <Tooltip label={t('panel.manage.renameGroup')} side="top" delayMs={400}>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={t('panel.manage.renameGroup')}
                          onClick={() => { beginRenameGroup(group.id) }}
                        >
                          <IconEditOutline16 size={12} aria-hidden="true" />
                        </button>
                      </Tooltip>
                      <Tooltip label={t('panel.manage.deleteGroup')} side="top" delayMs={400}>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={t('panel.manage.deleteGroup')}
                          onClick={() => { requestDeleteGroup(group.id) }}
                        >
                          <IconTrashOutline16 size={12} aria-hidden="true" />
                        </button>
                      </Tooltip>
                    </span>
                  )}
                  {confirm?.kind === 'delete-group' && confirm.groupId === group.id && (
                    <ConfirmPopover
                      title={t('panel.manage.confirm.deleteGroup.title')}
                      body={t('panel.manage.confirm.deleteGroup.body')}
                      actionLabel={t('panel.manage.confirm.action')}
                      submitting={submitting}
                      confirmMutation={confirmMutation}
                      cancelConfirm={cancelConfirm}
                      t={t}
                    />
                  )}
                  {editor.kind === 'group-rename' && editor.groupId === group.id && (
                    <GroupNamePopover
                      displayName={editor.displayName}
                      submitting={submitting}
                      setEditorDisplayName={setEditorDisplayName}
                      commitEditor={commitEditor}
                      cancelEditor={cancelEditor}
                      t={t}
                    />
                  )}
                </div>
              ))}
              </div>
            </nav>
            <div className={css.content}>
              {view.groupError !== null && (
                <div className={css.bannerError} role="alert">
                  <span>{view.groupError}</span>
                  <button type="button" className={css.bannerAction} onClick={() => { retryGroupLoad() }}>
                    {t('panel.error.retry')}
                  </button>
                </div>
              )}
              {pickMode ? (
                <div className={css.toolbar}>
                  <Input
                    className={`${css.search} ${css.searchPick}`}
                    role="searchbox"
                    aria-label={t('panel.search.aria')}
                    placeholder={t('panel.search.placeholder')}
                    icon={<IconSearchOutline16 size={16} aria-hidden="true" />}
                    value={view.searchQuery}
                    onChange={event => { setSearchQuery(event.target.value) }}
                  />
                </div>
              ) : (
                <div className={css.toolbar}>
                  <Input
                    className={css.search as string}
                    role="searchbox"
                    aria-label={t('panel.search.aria')}
                    placeholder={t('panel.search.placeholder')}
                    icon={<IconSearchOutline16 size={16} aria-hidden="true" />}
                    value={view.searchQuery}
                    onChange={event => { setSearchQuery(event.target.value) }}
                  />
                  <button type="button" className={css.toolbarAction} onClick={() => { beginNewCapsule() }}>
                    {t('panel.manage.newCapsule')}
                  </button>
                  <button
                    type="button"
                    className={css.toolbarAction}
                    onClick={() => {
                      void exportSelectedGroup().then((file) => {
                        if (file !== null) downloadTextFile(file.filename, file.body)
                      })
                    }}
                  >
                    {t('panel.manage.exportGroup')}
                  </button>
                  <input
                    ref={importInput}
                    type="file"
                    accept=".yaml,.yml,text/yaml,application/yaml"
                    className={css.fileInput}
                    aria-label={t('panel.manage.importGroup')}
                    onChange={event => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file === undefined) return
                      void file.text().then(raw => prepareImport(file.name, raw))
                    }}
                  />
                  <button
                    type="button"
                    className={css.toolbarAction}
                    onClick={() => { importInput.current?.click() }}
                  >
                    {t('panel.manage.importGroup')}
                  </button>
                </div>
              )}
              <div ref={contentScrollRef} className={css.contentScroll}>
              {editor.kind === 'capsule-new' && (
                <CapsuleEditorForm
                  title={editor.title}
                  body={editor.body}
                  submitting={submitting}
                  reveal={false}
                  setEditorTitle={setEditorTitle}
                  setEditorBody={setEditorBody}
                  commitEditor={commitEditor}
                  cancelEditor={cancelEditor}
                  t={t}
                />
              )}
              {view.groupStatus === 'loading' ? (
                <div className={css.skeletonList} data-sop-capsules-skeleton="true" aria-busy="true">
                  {[0, 1, 2].map(key => (
                    <div key={key} className={css.skeletonRow} />
                  ))}
                </div>
              ) : visibleCapsules.length === 0 ? (
                <p className={css.empty}>
                  {pickMode
                    ? (view.searchQuery.trim() === '' ? t('panel.empty.group') : t('panel.empty.search'))
                    : t('panel.empty.manage')}
                </p>
              ) : pickMode ? (
                <ul className={css.capsuleList}>
                  {visibleCapsules.map(capsule => (
                    <li key={capsule.id} className={css.popoverAnchor}>
                      <button
                        type="button"
                        className={css.capsuleRow}
                        disabled={view.injecting}
                        onClick={() => {
                          setPendingInject({ id: capsule.id, body: capsule.body })
                        }}
                      >
                        <span className={css.capsuleTitle}>{capsule.title}</span>
                        {capsule.body.trim() !== '' && (
                          <span className={css.capsulePreview}>{capsule.body}</span>
                        )}
                      </button>
                      {pendingInject?.id === capsule.id && (
                        <div className={`${css.groupPopover} ${css.injectPopover}`} role="dialog" aria-label={t('panel.inject.confirm.title')} data-sop-reveal="">
                          <p className={css.confirmTitle}>{t('panel.inject.confirm.title')}</p>
                          <p className={css.confirmBody}>{t('panel.inject.confirm.body')}</p>
                          <div className={css.editorActions}>
                            <button
                              type="button"
                              className={css.secondaryBtn}
                              disabled={view.injecting}
                              onClick={() => { setPendingInject(null) }}
                            >
                              {t('panel.manage.cancel')}
                            </button>
                            <button
                              type="button"
                              className={css.secondaryBtn}
                              disabled={view.injecting}
                              onClick={() => {
                                setInjectMode('append')
                                if (workspaceId !== undefined) localStorage.setItem(injectModeStorageKey(workspaceId), 'append')
                                injectCapsule(pendingInject.body)
                              }}
                            >
                              {t('panel.inject.confirm.append')}
                            </button>
                            <button
                              type="button"
                              className={css.primaryBtn}
                              disabled={view.injecting}
                              onClick={() => {
                                setInjectMode('replace')
                                if (workspaceId !== undefined) localStorage.setItem(injectModeStorageKey(workspaceId), 'replace')
                                injectCapsule(pendingInject.body)
                              }}
                            >
                              {t('panel.inject.confirm.replace')}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={css.capsuleList}>
                  {visibleCapsules.map(capsule => (
                    <li key={capsule.id} className={css.manageCapsuleItem}>
                    <div
                      className={css.manageCapsuleRow}
                      data-confirm={confirm?.kind === 'delete-capsule' && confirm.capsuleId === capsule.id ? '' : undefined}
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData('text/plain', dndPayload('capsule', capsule.id))
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={event => { event.preventDefault() }}
                      onDrop={event => {
                        event.preventDefault()
                        const payload = parseDndPayload(event.dataTransfer.getData('text/plain'))
                        if (payload === null || payload.kind !== 'capsule') return
                        reorderCapsules(moveIdBefore(view.capsules.map(row => row.id), payload.id, capsule.id))
                      }}
                    >
                      <span className={css.dragHandle} aria-label={t('panel.manage.drag.capsule')}>⋮⋮</span>
                      <span className={css.capsuleTitle}>{capsule.title}</span>
                      <span className={css.rowActions}>
                        <Tooltip label={t('panel.manage.editCapsule')} side="top" delayMs={400}>
                          <button
                            type="button"
                            className={css.iconButton}
                            aria-label={t('panel.manage.editCapsule')}
                            onClick={() => { beginEditCapsule(capsule.id) }}
                          >
                            <IconEditOutline16 size={12} aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip label={t('panel.manage.deleteCapsule')} side="top" delayMs={400}>
                          <button
                            type="button"
                            className={css.iconButton}
                            aria-label={t('panel.manage.deleteCapsule')}
                            onClick={() => { requestDeleteCapsule(capsule.id) }}
                          >
                            <IconTrashOutline16 size={12} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      </span>
                      {confirm?.kind === 'delete-capsule' && confirm.capsuleId === capsule.id && (
                        <ConfirmPopover
                          title={t('panel.manage.confirm.deleteCapsule.title')}
                          body={t('panel.manage.confirm.deleteCapsule.body')}
                          actionLabel={t('panel.manage.confirm.action')}
                          submitting={submitting}
                          confirmMutation={confirmMutation}
                          cancelConfirm={cancelConfirm}
                          t={t}
                        />
                      )}
                    </div>
                    {editor.kind === 'capsule-edit' && editor.capsuleId === capsule.id && (
                      <CapsuleEditorForm
                        title={editor.title}
                        body={editor.body}
                        submitting={submitting}
                        reveal
                        setEditorTitle={setEditorTitle}
                        setEditorBody={setEditorBody}
                        commitEditor={commitEditor}
                        cancelEditor={cancelEditor}
                        t={t}
                      />
                    )}
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>
          </div>
        )}
      </section>
      <Modal
        open={confirm?.kind === 'import-group'}
        onClose={() => { if (!submitting) cancelConfirm() }}
        title={t('panel.manage.confirm.import.title')}
        closeLabel={t('panel.close')}
        description={confirm?.kind === 'import-group'
          ? t('panel.manage.confirm.import.body', {
            groupId: confirm.group.id,
            writeCount: confirm.group.capsules.length,
            deleteCount: confirm.deleteCount,
          })
          : ''}
        footer={(
          <>
            <button type="button" className={css.secondaryBtn} disabled={submitting} onClick={() => { cancelConfirm() }}>
              {t('panel.manage.cancel')}
            </button>
            <button
              type="button"
              className={css.primaryBtn}
              disabled={submitting}
              aria-busy={submitting}
              aria-label={submitting ? t('panel.manage.submitting') : t('panel.manage.confirm.import.action')}
              onClick={() => { confirmMutation() }}
            >
              {submitting ? t('panel.manage.submitting') : t('panel.manage.confirm.import.action')}
            </button>
          </>
        )}
      />
    </div>
  )
}
