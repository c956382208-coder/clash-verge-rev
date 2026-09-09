import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globSync } from 'glob'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')

export const forbiddenRuntimeValues = [
  '美国国家宽',
  '维云云',
  '一元机场',
  '极光网络',
  '速连云',
  '蓝鲸加速',
  '104.21.28.173',
  '103.24.11.89',
  '133.18.29.4',
  '150 GB',
  '美国 | 洛杉矶 01',
  '香港 | 专线 01',
  '日本 | 东京 02',
]

export const runtimeSourceGlob = 'src/**/*.{ts,tsx}'
export const runtimeIgnore = ['src/components/test/**']

export const runRuntimeDataCheck = (root = projectRoot) => {
  const violations = []
  const files = globSync(runtimeSourceGlob, {
    cwd: root,
    nodir: true,
    ignore: runtimeIgnore,
  })

  for (const file of files) {
    const contents = readFileSync(resolve(root, file), 'utf8')
    for (const value of forbiddenRuntimeValues) {
      if (contents.includes(value)) violations.push(`${file}: ${value}`)
    }
    if (contents.includes('index.html?raw')) {
      violations.push(`${file}: design HTML imported as runtime data`)
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Production runtime data guard failed:\n${violations.join('\n')}`,
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runRuntimeDataCheck()
    console.log('Runtime data guard passed.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
