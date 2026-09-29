// @vitest-environment jsdom
/**
 * A reference-styled slash token that shares its node with more text must
 * split once. Lexical merges same-style siblings before the next transform,
 * so leaving the copied style on the remainder retriggers the split forever.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
} from '../../../packages/client/ui-conversation/node_modules/lexical'
import { bindSlashRefDecoration, SLASH_REF_STYLE } from '../src/client/slash-refs.ts'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

/** Text nodes left after decoration, in document order. */
function leaves(editor: LexicalEditor): Array<{ text: string; style: string }> {
  return editor.getEditorState().read(() => {
    const found: Array<{ text: string; style: string }> = []
    const walk = (node: { getChildren?: () => unknown[]; getType?: () => string; getTextContent?: () => string; getStyle?: () => string }): void => {
      if (node.getType?.() === 'text') {
        found.push({ text: node.getTextContent?.() ?? '', style: node.getStyle?.() ?? '' })
        return
      }
      for (const child of node.getChildren?.() ?? []) walk(child as typeof node)
    }
    walk($getRoot())
    return found
  })
}

describe('slash reference split', () => {
  it('splits following text off a reference-styled token without looping', () => {
    const editor = createEditor({
      onError: (error) => { throw error },
    })
    const root = document.createElement('div')
    root.contentEditable = 'true'
    document.body.append(root)
    editor.setRootElement(root)
    cleanups.push(() => {
      editor.setRootElement(null)
      root.remove()
    })
    bindSlashRefDecoration({ editor }, new Set(['计划']))
    editor.update(() => {
      const text = $createTextNode('/计划 划')
      text.setStyle(SLASH_REF_STYLE)
      const paragraph = $createParagraphNode()
      paragraph.append(text)
      $getRoot().append(paragraph)
    }, { discrete: true })
    expect(leaves(editor)).toEqual([
      { text: '/计划', style: SLASH_REF_STYLE },
      { text: ' 划', style: '' },
    ])
  })
})
