/**
 * Minimal tree-outside tool plugin for the hello-tool walkthrough.
 * @module dsh-hello-tool
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'hello-tool'
export const inject = ['tools']

/**
 * Register the model-facing `hello` tool on the global tool registry.
 * @param ctx - Cordis context carrying `ctx.tools`.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'hello',
    description: 'Return a friendly greeting. Use when the user asks for a hello demo.',
    parameters: {
      name: { type: 'string', description: 'Optional name to greet.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute(args) {
      const who = args.name?.trim() || 'world'
      return Promise.resolve(`Hello, ${who}! (from dsh-hello-tool)`)
    },
  }))
}
