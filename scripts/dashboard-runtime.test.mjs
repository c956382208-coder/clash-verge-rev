import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'src/adapters/proxy-runtime.ts')
const selectionSourcePath = resolve(root, 'src/hooks/use-proxy-selection.ts')
const dashboardSourcePath = resolve(
  root,
  'src/components/layout/recovered-design-shell.tsx',
)
const proxyGroupsSourcePath = resolve(root, 'src/components/proxy/proxy-groups.tsx')
const renderListSourcePath = resolve(root, 'src/components/proxy/use-render-list.ts')

const loadAdapter = async () => {
  const source = readFileSync(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const adapter = await loadAdapter()

test('empty profile has a truthful dashboard state', () => {
  const model = adapter.buildDashboardProxyModel()
  assert.deepEqual(model.groups, [])
  assert.deepEqual(model.nodes, [])
  assert.equal(model.selectedGroup, undefined)
  assert.equal(model.selectedNode, undefined)
})

test('real Mihomo groups map to their current node records', () => {
  const model = adapter.buildDashboardProxyModel({
    groups: [{ name: 'Auto', type: 'Selector', now: 'Tokyo', all: ['Tokyo', 'Direct'] }],
    records: {
      Tokyo: { name: 'Tokyo', type: 'Trojan', history: [{ delay: 42 }] },
      Direct: { name: 'Direct', type: 'Direct', history: [] },
    },
  })
  assert.equal(model.selectedGroup.name, 'Auto')
  assert.deepEqual(model.selectedNode, { name: 'Tokyo', type: 'Trojan', delay: 42 })
  assert.deepEqual(model.nodes[1], { name: 'Direct', type: 'Direct', delay: null })
})

test('verified node selection succeeds only after Mihomo reports the requested node', () => {
  assert.equal(adapter.isMihomoSelectionConfirmed({ Auto: { now: 'Tokyo' } }, 'Auto', 'Tokyo'), true)
  assert.equal(adapter.isMihomoSelectionConfirmed({ Auto: { now: 'Tokyo' } }, 'Auto', 'Osaka'), false)
  assert.equal(adapter.isMihomoSelectionConfirmed(undefined, 'Auto', 'Tokyo'), false)
})

test('failed node selection keeps the previous Mihomo snapshot visible and refreshes it', () => {
  const requestedNode = 'Osaka'
  const snapshotAfterFailure = {
    groups: [
      { name: 'Auto', type: 'Selector', now: 'Tokyo', all: ['Tokyo', requestedNode] },
    ],
    records: {
      Tokyo: { name: 'Tokyo', type: 'Trojan' },
      [requestedNode]: { name: requestedNode, type: 'Vmess' },
    },
  }
  const model = adapter.buildDashboardProxyModel(snapshotAfterFailure)
  assert.equal(
    adapter.isMihomoSelectionConfirmed(
      { Auto: { now: snapshotAfterFailure.groups[0].now } },
      'Auto',
      requestedNode,
    ),
    false,
  )
  assert.equal(model.selectedNode?.name, 'Tokyo')

  const selectionSource = readFileSync(selectionSourcePath, 'utf8')
  const dashboardSource = readFileSync(dashboardSourcePath, 'utf8')
  assert.match(
    selectionSource,
    /if \(!isVerified\) \{[\s\S]*?throw new Error\([\s\S]*?\)[\s\S]*?\}[\s\S]*?onSuccess\?\.\(\)[\s\S]*?persistSelection\(/,
  )
  assert.match(
    selectionSource,
    /catch \(error\) \{[\s\S]*?onError\?\.\(error\)[\s\S]*?throw error/,
  )
  assert.match(
    dashboardSource,
    /catch \(error\) \{[\s\S]*?await refreshProxy\(\)[\s\S]*?showNotice\.error\(error\)/,
  )
})

test('selection contract calls Mihomo, verifies live state, then persists only on success', () => {
  const selectionSource = readFileSync(selectionSourcePath, 'utf8')
  const verifiedChange = selectionSource.slice(
    selectionSource.indexOf('const changeProxyVerified'),
    selectionSource.indexOf('const changeProxy ='),
  )
  const selectIndex = verifiedChange.indexOf('await selectNodeForGroup(groupName, proxyName)')
  const readIndex = verifiedChange.indexOf('const response = await getProxies()')
  const confirmationIndex = verifiedChange.indexOf(
    'isMihomoSelectionConfirmed(response.proxies, groupName, proxyName)',
  )
  const persistIndex = verifiedChange.indexOf('persistSelection(groupName, proxyName, skipConfigSave)')

  assert.ok(selectIndex >= 0)
  assert.ok(readIndex > selectIndex)
  assert.ok(confirmationIndex > readIndex)
  assert.ok(persistIndex > confirmationIndex)
  assert.match(verifiedChange, /SELECTION_VERIFY_ATTEMPTS/)
})

test('Chain Mode OFF dispatches the normal proxy list without chain filtering', () => {
  const proxyGroupsSource = readFileSync(proxyGroupsSourcePath, 'utf8')
  const renderListSource = readFileSync(renderListSourcePath, 'utf8')
  assert.match(
    proxyGroupsSource,
    /if \(isChainMode\) \{[\s\S]*?return <ChainProxyGroups[\s\S]*?\}[\s\S]*?return <NormalProxyGroups mode=\{mode\} \/>/,
  )
  assert.match(
    renderListSource,
    /\/\/ 正常模式的渲染逻辑[\s\S]*?const renderGroups[\s\S]*?proxiesData\.groups/,
  )
})

test('light-theme token contract defines readable navigation colors', () => {
  const css = readFileSync(resolve(root, 'src/assets/styles/design-shell.scss'), 'utf8')
  assert.match(css, /\[data-theme='light'\][\s\S]*?--sidebar-text: #16385d/)
  assert.match(css, /\[data-theme='light'\][\s\S]*?--sidebar-icon: #174d8c/)
})
