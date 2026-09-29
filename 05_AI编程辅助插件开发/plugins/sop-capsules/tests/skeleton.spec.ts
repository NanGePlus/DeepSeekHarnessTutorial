import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCordisYaml } from '../../../scripts/cordis-yaml.ts'
import pkg from '../package.json'

const pluginRoot = join(import.meta.dirname, '..')

type PatchInsert = { id?: string; name?: string }

/**
 * Collect loader entry rows from a bundle patch document.
 * @param document - parsed Cordis patch YAML.
 * @returns insert rows declared by the patch.
 */
function patchInserts(document: unknown): PatchInsert[] {
  if (!Array.isArray(document)) return []
  const rows: PatchInsert[] = []
  for (const item of document) {
    if (typeof item !== 'object' || item === null) continue
    const insert = (item as { insert?: unknown }).insert
    if (!Array.isArray(insert)) continue
    for (const row of insert) {
      if (typeof row === 'object' && row !== null) rows.push(row as PatchInsert)
    }
  }
  return rows
}

describe('dsh-sop-capsules tree-outside skeleton', () => {
  it('declares dsh.bundle.patch on the npm package', () => {
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh?.client?.platform).toBe('web')
  })

  it('mounts Web profile patches with entry id sop-capsules (not hello-tool)', () => {
    for (const file of ['cordis.patch.yml', 'cordis.source.patch.yml'] as const) {
      const document = loadCordisYaml(readFileSync(join(pluginRoot, file), 'utf8'))
      const inserts = patchInserts(document)
      expect(inserts, file).toHaveLength(1)
      expect(inserts[0]?.id, file).toBe('sop-capsules')
      expect(inserts[0]?.id, file).not.toBe('hello-tool')
    }
  })

  it('exposes Host TypertRemoteService default export and Client apply', async () => {
    const host = await import('../src/index.ts')
    const client = await import('../src/client/index.ts')
    expect(typeof host.default).toBe('function')
    expect(typeof client.apply).toBe('function')
    expect(Array.isArray(client.inject)).toBe(true)
  })

  it('builds host and client artifacts via pnpm --filter', () => {
    execSync('pnpm run build', { cwd: pluginRoot, stdio: 'pipe' })
    expect(existsSync(join(pluginRoot, 'lib/index.js'))).toBe(true)
    expect(existsSync(join(pluginRoot, 'lib/client.js'))).toBe(true)
    const source = readFileSync(join(pluginRoot, 'lib/client.js'), 'utf8')
    const specifiers = [...source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map(match => match[1]!)
    const moduleTable = new Set([
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-store',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-dockkit',
    ])
    expect([...new Set(specifiers)].filter(id => !moduleTable.has(id))).toEqual([])
  }, 60_000)
})
