import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  forbiddenRuntimeValues,
  runRuntimeDataCheck,
} from './check-runtime-data.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('production runtime cannot reference dashboard fixtures', () => {
  assert.doesNotThrow(() => runRuntimeDataCheck(root))
})

test('guard rejects every recovered fixture in production TS and TSX sources', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'clash-verge-runtime-guard-'))
  try {
    const sourceRoot = join(fixtureRoot, 'src')
    mkdirSync(sourceRoot, { recursive: true })
    const midpoint = Math.ceil(forbiddenRuntimeValues.length / 2)
    writeFileSync(
      join(sourceRoot, 'runtime.ts'),
      forbiddenRuntimeValues.slice(0, midpoint).join('\n'),
    )
    writeFileSync(
      join(sourceRoot, 'dashboard.tsx'),
      forbiddenRuntimeValues.slice(midpoint).join('\n'),
    )

    assert.throws(
      () => runRuntimeDataCheck(fixtureRoot),
      (error) =>
        error instanceof Error &&
        forbiddenRuntimeValues.every((value) => error.message.includes(value)) &&
        error.message.includes('runtime.ts') &&
        error.message.includes('dashboard.tsx'),
    )
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test('the archived design HTML remains outside the production TypeScript scan', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'clash-verge-runtime-archive-'))
  try {
    const archiveDirectory = join(
      fixtureRoot,
      'src',
      'assets',
      'design-dashboard',
    )
    mkdirSync(archiveDirectory, { recursive: true })
    writeFileSync(
      join(archiveDirectory, 'index.html'),
      forbiddenRuntimeValues.join('\n'),
    )

    assert.doesNotThrow(() => runRuntimeDataCheck(fixtureRoot))
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})
