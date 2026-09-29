/**
 * Filesystem persistence for the workspace SOP capsule library.
 */

import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { parseGroupYaml, stringifyGroupYaml } from './group-yaml.ts'
import {
  SOP_CAPSULES_SCHEMA_VERSION,
  type SopCapsuleGroup,
  type SopLibraryGroupSummary,
  type SopLibrarySummary,
} from './types.ts'

interface ManifestDocument {
  schemaVersion: number
  groups: string[]
}

const MANIFEST_NAME = 'manifest.yaml'
const GROUPS_DIR = 'groups'

function manifestPath(libraryRoot: string): string {
  return join(libraryRoot, MANIFEST_NAME)
}

function groupPath(libraryRoot: string, groupId: string): string {
  return join(libraryRoot, GROUPS_DIR, `${groupId}.yaml`)
}

function parseManifest(raw: string): ManifestDocument {
  const value: unknown = parse(raw)
  if (typeof value !== 'object' || value === null) throw new TypeError('invalid manifest')
  const record = value as Record<string, unknown>
  const schemaVersion = record.schemaVersion
  const groups = record.groups
  if (schemaVersion !== SOP_CAPSULES_SCHEMA_VERSION) {
    throw new TypeError(`unsupported manifest schemaVersion ${String(schemaVersion)}`)
  }
  if (!Array.isArray(groups) || !groups.every(id => typeof id === 'string')) {
    throw new TypeError('invalid manifest groups')
  }
  return { schemaVersion, groups: [...groups] }
}

async function ensureLibraryLayout(libraryRoot: string): Promise<void> {
  await mkdir(join(libraryRoot, GROUPS_DIR), { recursive: true })
}

async function readManifest(libraryRoot: string): Promise<ManifestDocument> {
  try {
    const raw = await readFile(manifestPath(libraryRoot), 'utf8')
    return parseManifest(raw)
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { schemaVersion: SOP_CAPSULES_SCHEMA_VERSION, groups: [] }
    }
    throw error
  }
}

async function writeManifestAtomic(libraryRoot: string, manifest: ManifestDocument): Promise<void> {
  await ensureLibraryLayout(libraryRoot)
  const target = manifestPath(libraryRoot)
  const temp = `${target}.tmp`
  const body = stringify({
    schemaVersion: manifest.schemaVersion,
    groups: manifest.groups,
  })
  await writeFile(temp, body, 'utf8')
  await rename(temp, target)
}

async function readGroupSummary(libraryRoot: string, groupId: string): Promise<SopLibraryGroupSummary> {
  const raw = await readFile(groupPath(libraryRoot, groupId), 'utf8')
  const doc = parseGroupYaml(raw, groupId)
  return { id: groupId, displayName: doc.displayName }
}

/**
 * List groups, registering orphan yaml files onto the manifest tail first.
 * @param libraryRoot - `.dsh/sop-capsules` directory.
 */
export async function listLibrary(libraryRoot: string): Promise<SopLibrarySummary> {
  await ensureLibraryLayout(libraryRoot)
  const manifest = await readManifest(libraryRoot)
  const onDisk = (await readdir(join(libraryRoot, GROUPS_DIR)))
    .filter(name => name.endsWith('.yaml'))
    .map(name => name.slice(0, -'.yaml'.length))
    .sort()

  const registered = new Set(manifest.groups)
  const orphans = onDisk.filter(id => !registered.has(id))
  if (orphans.length > 0) {
    manifest.groups.push(...orphans)
    await writeManifestAtomic(libraryRoot, manifest)
  }

  const groups: SopLibraryGroupSummary[] = []
  for (const id of manifest.groups) {
    groups.push(await readGroupSummary(libraryRoot, id))
  }
  return { groups, adoptedOrphanIds: orphans }
}

/**
 * Load one group file.
 * @param libraryRoot - library root directory.
 * @param groupId - stable group id.
 */
export async function getGroup(libraryRoot: string, groupId: string): Promise<SopCapsuleGroup> {
  try {
    const raw = await readFile(groupPath(libraryRoot, groupId), 'utf8')
    return parseGroupYaml(raw, groupId)
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new RemoteError('sop-capsules/group-not-found', `group "${groupId}" not found`, { groupId })
    }
    throw error
  }
}

/**
 * Replace or create one group and register it on the manifest when new.
 * @param libraryRoot - library root directory.
 * @param group - full group payload.
 */
export async function saveGroup(libraryRoot: string, group: SopCapsuleGroup): Promise<void> {
  await ensureLibraryLayout(libraryRoot)
  const manifest = await readManifest(libraryRoot)
  const target = groupPath(libraryRoot, group.id)
  const temp = `${target}.tmp`
  const body = stringifyGroupYaml(group)
  await writeFile(temp, body, 'utf8')
  await rename(temp, target)
  if (!manifest.groups.includes(group.id)) {
    manifest.groups.push(group.id)
    await writeManifestAtomic(libraryRoot, manifest)
  }
}

/**
 * Remove a group file and its manifest entry.
 * @param libraryRoot - library root directory.
 * @param groupId - stable group id.
 */
export async function deleteGroup(libraryRoot: string, groupId: string): Promise<void> {
  const manifest = await readManifest(libraryRoot)
  if (!manifest.groups.includes(groupId)) {
    throw new RemoteError('sop-capsules/group-not-found', `group "${groupId}" not found`, { groupId })
  }
  manifest.groups = manifest.groups.filter(id => id !== groupId)
  await writeManifestAtomic(libraryRoot, manifest)
  await rm(groupPath(libraryRoot, groupId), { force: true })
}

/**
 * Rewrite manifest group order.
 * @param libraryRoot - library root directory.
 * @param groupIds - complete ordered id list.
 */
export async function reorderGroups(libraryRoot: string, groupIds: readonly string[]): Promise<void> {
  const manifest = await readManifest(libraryRoot)
  const known = new Set(manifest.groups)
  if (groupIds.length !== known.size || groupIds.some(id => !known.has(id))) {
    throw new RemoteError('gateway/bad-request', 'reorderGroups must list every registered group id exactly once', {})
  }
  manifest.groups = [...groupIds]
  await writeManifestAtomic(libraryRoot, manifest)
}
