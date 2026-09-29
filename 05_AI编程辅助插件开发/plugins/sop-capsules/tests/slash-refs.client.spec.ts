/**
 * Slash spelling collection and text-node decoration for capsule inject.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  SLASH_CLAIM_STYLE,
  SLASH_REF_STYLE,
  bindSlashRefDecoration,
  decorateSlashTextNode,
  firstSlashSpelling,
  loadSlashSpellings,
  refreshSlashRefDecoration,
  type SlashTextNode,
} from '../src/client/slash-refs.ts'

const SESSION = 'sess-1' as SessionId

/** Text node whose splitText keeps the original object as the first piece. */
class FakeText implements SlashTextNode {
  splitCount = 0
  readonly pieces: FakeText[] = []

  constructor(
    public text: string,
    public style = '',
    public type = 'text',
    public simple = true,
  ) {}

  getType(): string {
    return this.type
  }

  getTextContent(): string {
    return this.text
  }

  getStyle(): string {
    return this.style
  }

  setStyle(style: string): void {
    this.style = style
  }

  isSimpleText(): boolean {
    return this.simple
  }

  splitText(...offsets: number[]): SlashTextNode[] {
    this.splitCount += 1
    const original = this.text
    const cuts = [0, ...offsets, original.length]
    const parts: FakeText[] = []
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const slice = original.slice(cuts[index], cuts[index + 1])
      if (index === 0) {
        this.text = slice
        parts.push(this)
      } else {
        const piece = new FakeText(slice, this.style, this.type, this.simple)
        this.pieces.push(piece)
        parts.push(piece)
      }
    }
    return parts
  }
}

describe('firstSlashSpelling', () => {
  const spellings = new Set(['计划', 'tdd', 'plan'])

  it('matches a whole non-space run and ignores glued text', () => {
    expect(firstSlashSpelling('/计划 小程序', spellings)).toEqual({ start: 0, end: 3 })
    expect(firstSlashSpelling('先做 /tdd 再写', spellings)).toEqual({ start: 3, end: 7 })
    expect(firstSlashSpelling('/计划小程序', spellings)).toBeNull()
    expect(firstSlashSpelling('/plan.md', spellings)).toBeNull()
    expect(firstSlashSpelling('/未知', spellings)).toBeNull()
    expect(firstSlashSpelling('x/plan', spellings)).toBeNull()
  })
})

describe('decorateSlashTextNode', () => {
  const spellings = new Set(['计划', 'tdd'])

  it('splits a leading match out of the rest of the line and styles only the token', () => {
    const node = new FakeText('/计划 小程序')
    decorateSlashTextNode(node, spellings)
    expect(node.text).toBe('/计划')
    expect(node.style).toBe(SLASH_REF_STYLE)
    expect(node.splitCount).toBe(1)
    expect(node.pieces[0]?.text).toBe(' 小程序')
    expect(node.pieces[0]?.style).toBe('')
  })

  it('styles a slash token that sits after other text', () => {
    const node = new FakeText('先做 /tdd 再写')
    decorateSlashTextNode(node, spellings)
    expect(node.text).toBe('先做 ')
    expect(node.style).toBe('')
    expect(node.pieces[0]?.text).toBe('/tdd')
    expect(node.pieces[0]?.style).toBe(SLASH_REF_STYLE)
  })

  it('styles an exact token without splitting', () => {
    const node = new FakeText('/tdd')
    decorateSlashTextNode(node, spellings)
    expect(node.text).toBe('/tdd')
    expect(node.style).toBe(SLASH_REF_STYLE)
    expect(node.splitCount).toBe(0)
  })

  it('leaves unmatched text and claim-styled nodes unchanged', () => {
    const plain = new FakeText('/未知 文本')
    decorateSlashTextNode(plain, spellings)
    expect(plain.text).toBe('/未知 文本')
    expect(plain.style).toBe('')
    expect(plain.splitCount).toBe(0)

    const claimed = new FakeText('/计划', SLASH_CLAIM_STYLE)
    decorateSlashTextNode(claimed, spellings)
    expect(claimed.style).toBe(SLASH_CLAIM_STYLE)
    expect(claimed.splitCount).toBe(0)
  })

  it('clears the reference style when the node no longer matches', () => {
    const node = new FakeText('普通文本', SLASH_REF_STYLE)
    decorateSlashTextNode(node, spellings)
    expect(node.style).toBe('')
  })
})

describe('loadSlashSpellings', () => {
  it('collects command names, localized built-in tokens, and skill names', async () => {
    const spellings = await loadSlashSpellings({
      commands: {
        list: async () => ({
          ok: true,
          value: [
            { name: 'plan', definitionId: '@deepseek-ai/dsh-plan-mode' },
            { name: 'myplan', definitionId: '@deepseek-ai/dsh-plan-mode' },
            { name: 'ship' },
          ],
        }),
      },
      skills: {
        list: async () => ({ ok: true, value: { skills: [{ name: 'tdd' }, { name: '' }] } }),
      },
    }, SESSION, (name) => (name === 'ship' ? '发版' : `token.${name}`))
    expect(spellings).toEqual(new Set(['myplan', 'plan', 'ship', 'tdd', '发版', '计划']))
  })

  it('returns the names it could read when one catalog throws before the call', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const remote = new Proxy({
        skills: { list: async () => ({ ok: true, value: { skills: [{ name: 'tdd' }] } }) },
      }, {
        get(target, prop, receiver) {
          if (prop === 'commands') throw new Error('cannot get property "remote.commands" without inject')
          return Reflect.get(target, prop, receiver)
        },
      })
      const spellings = await loadSlashSpellings(remote, SESSION, (name) => `token.${name}`)
      expect([...spellings]).toEqual(['tdd'])
    } finally {
      error.mockRestore()
    }
  })

  it('returns the names it could read when one catalog rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const spellings = await loadSlashSpellings({
        commands: { list: async () => Promise.reject(new Error('no agent')) },
        skills: { list: async () => ({ ok: true, value: { skills: [{ name: 'tdd' }] } }) },
      }, SESSION, (name) => `token.${name}`)
      expect([...spellings]).toEqual(['tdd'])
    } finally {
      error.mockRestore()
    }
  })
})

describe('refreshSlashRefDecoration', () => {
  it('marks pending text nodes dirty inside the editor update', () => {
    const dirty: string[] = []
    const editor = {
      update(fn: () => void) {
        editor._pendingEditorState = {
          _nodeMap: new Map([
            ['root', { getType: () => 'root', markDirty: () => { dirty.push('root') } }],
            ['t', { getType: () => 'text', markDirty: () => { dirty.push('t') } }],
          ]),
        }
        fn()
      },
      _pendingEditorState: undefined as undefined | {
        _nodeMap: Map<string, { getType(): string; markDirty(): void }>
      },
    }
    refreshSlashRefDecoration({ editor })
    expect(dirty).toEqual(['t'])
  })
})

describe('bindSlashRefDecoration', () => {
  it('registers one transform and refreshes the spelling set in place', () => {
    let transform: ((node: SlashTextNode) => void) | undefined
    const editor = {
      _nodes: { get: () => ({ klass: function TextNode() {} }) },
      registerNodeTransform: (_klass: object, fn: (node: SlashTextNode) => void) => {
        transform = fn
        return () => {}
      },
    }
    const input = { editor }
    bindSlashRefDecoration(input, new Set(['计划']))
    bindSlashRefDecoration(input, new Set(['tdd']))
    const missed = new FakeText('/计划')
    transform?.(missed)
    expect(missed.style).toBe('')
    const node = new FakeText('/tdd')
    transform?.(node)
    expect(node.style).toBe(SLASH_REF_STYLE)
  })

  it('does nothing when the input has no editor', () => {
    expect(() => { bindSlashRefDecoration(undefined, new Set(['计划'])) }).not.toThrow()
    expect(() => { bindSlashRefDecoration({}, new Set(['计划'])) }).not.toThrow()
  })
})
