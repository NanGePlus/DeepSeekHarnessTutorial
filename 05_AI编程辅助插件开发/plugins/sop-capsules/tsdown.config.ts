/**
 * Tree-outside plugin client bundle preset. Does not import Harness
 * Harness `clientBundle` (manifest lookup is limited to official package tiers). This
 * config reads the local `package.json` so the same package builds in a
 * monorepo workspace or as a standalone npm install for `dsh plugin add`.
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire, isBuiltin } from 'node:module'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'
import { typertPlugin } from '../../packages/typert/generator/lib/types/tsdown-plugin.js'

const pluginRoot = dirname(fileURLToPath(import.meta.url))

interface PluginManifest {
  name: string
  peerDependencies?: Record<string, string>
  dsh?: { client?: { external?: readonly string[] } }
}

const manifest = JSON.parse(
  readFileSync(resolve(pluginRoot, 'package.json'), 'utf8'),
) as PluginManifest

const packageId = manifest.name

/** Browser module-table keys shipped with Harness Web (keep aligned with shell seed). */
const SHELL_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
] as const

const requestedExternal = new Set<string>([
  ...SHELL_EXTERNALS,
  ...(manifest.dsh?.client?.external ?? []),
])

const require = createRequire(import.meta.url)

/**
 * yaml's package `exports` prefer the Node `dist/` CJS face when the bundler
 * supplies a `node` condition. That face `require`s `process` and `buffer`,
 * which the Web module table does not provide, so Client boot reports import
 * failed. Pin the browser entry (`exports.default` / `browser/index.js`).
 */
const yamlBrowserEntry = resolve(dirname(require.resolve('yaml/package.json')), 'browser/index.js')

/**
 * Whether a bare import stays external for the dynamic browser half.
 * @param specifier - module specifier.
 * @returns true when the Web module table must provide it.
 */
function isModuleTableExternal(specifier: string): boolean {
  if (requestedExternal.has(specifier)) return true
  for (const base of requestedExternal) {
    if (specifier.startsWith(`${base}/`)) return true
  }
  return false
}

const peerNames = Object.keys(manifest.peerDependencies ?? {})

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Resolve a stylesheet path relative to its importer. */
function sourceAssetPath(source: string, importer: string): string {
  return resolve(dirname(importer), source)
}

/** Emit style injection plus optional CSS Modules class map. */
function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap?: Readonly<Record<string, string>>,
): string {
  const source = [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
  ]
  source.push(classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`)
  return source.join('\n')
}

/**
 * Whether the Node half should keep a dependency external at install time.
 * @param specifier - module specifier.
 * @returns true for peer dependencies declared by this plugin package.
 */
function isPeerExternal(specifier: string): boolean {
  return peerNames.some(name => specifier === name || specifier.startsWith(`${name}/`))
}

const nodeHalf: UserConfig = {
  name: packageId,
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  plugins: [typertPlugin({ mode: 'package', faces: ['host'] })],
  deps: {
    neverBundle: isPeerExternal,
    alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !isPeerExternal(specifier),
  },
}

const browserHalf: UserConfig = {
  name: `${packageId}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  sourcemap: true,
  deps: {
    neverBundle: isModuleTableExternal,
    alwaysBundle: (specifier: string) => !isModuleTableExternal(specifier),
  },
  inputOptions: {
    resolve: {
      alias: { yaml: yamlBrowserEntry },
      conditionNames: [
        (process.env.NODE_ENV ?? 'production') === 'development' ? 'development' : 'production',
        'browser',
        'import',
        'module',
        'default',
      ],
    },
  },
  define: {
    'process.env': '{}',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [{
    name: 'sop-capsules-remote-js',
    resolveId(source: string) {
      if (source !== '@nangeagi/dsh-sop-capsules/remote') return null
      return resolve(pluginRoot, 'lib/typert.remote-client.js')
    },
  }, {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      const exportEntries = Object.entries(cssExports ?? {})
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      for (const [local, exp] of exportEntries) classMap[local] = exp.name
      return styleInjectionModule(packageId, fileId, code.toString(), classMap)
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(packageId)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeHalf, browserHalf]
