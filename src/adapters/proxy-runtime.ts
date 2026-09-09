export interface RuntimeProxy {
  name: string
  type?: string
  history?: Array<{ delay?: number }>
}

export interface RuntimeProxyGroup {
  name: string
  type?: string
  now?: string
  all?: Array<string | RuntimeProxy>
}

export interface RuntimeProxySnapshot {
  groups?: RuntimeProxyGroup[]
  records?: Record<string, RuntimeProxy>
}

export interface DashboardNode {
  name: string
  type: string
  delay: number | null
}

export interface DashboardProxyModel {
  groups: RuntimeProxyGroup[]
  selectedGroup?: RuntimeProxyGroup
  nodes: DashboardNode[]
  selectedNode?: DashboardNode
}

const getDelay = (record?: RuntimeProxy): number | null => {
  const delay = record?.history?.at(-1)?.delay
  return typeof delay === 'number' && delay >= 0 ? delay : null
}

export const buildDashboardProxyModel = (
  snapshot?: RuntimeProxySnapshot,
  groupName?: string,
): DashboardProxyModel => {
  const groups = snapshot?.groups ?? []
  const selectedGroup =
    groups.find((group) => group.name === groupName) ??
    groups.find((group) => Boolean(group.now)) ??
    groups[0]
  const nodes = (selectedGroup?.all ?? [])
    .map((item) => {
      const name = typeof item === 'string' ? item : item.name
      const record =
        typeof item === 'string' ? snapshot?.records?.[item] : item
      return name
        ? { name, type: record?.type ?? 'Unavailable', delay: getDelay(record) }
        : undefined
    })
    .filter((node): node is DashboardNode => node !== undefined)

  return {
    groups,
    selectedGroup,
    nodes,
    selectedNode: nodes.find((node) => node.name === selectedGroup?.now),
  }
}

export const isMihomoSelectionConfirmed = (
  proxyRecords: Record<string, { now?: string } | undefined> | undefined,
  groupName: string,
  proxyName: string,
) => proxyRecords?.[groupName]?.now === proxyName
