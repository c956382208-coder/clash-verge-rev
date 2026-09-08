/* The design template is an audited local asset. Its event bridge intentionally
   uses imperative listeners because the DOM hierarchy is copied verbatim. */
/* eslint-disable @eslint-react/web-api-no-leaked-event-listener, @eslint-react/dom-no-dangerously-set-innerhtml */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router'

import designDocument from '@/assets/design-dashboard/index.html?raw'
import '@/assets/design-dashboard/css/style.css'
import '@/assets/styles/design-shell.scss'
import { useConnectionSummaryData } from '@/hooks/use-connection-data'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVerge } from '@/hooks/use-verge'
import { useWindowControls } from '@/hooks/use-window'
import {
  useClashConfigData,
  useAppRefreshers,
  useProxiesData,
} from '@/providers/app-data-context'
import { getIpInfo } from '@/services/api'
import { patchClashMode, updateProfile } from '@/services/cmds'
import { useQuery } from '@/services/query-client'
import { useSetThemeMode, useThemeMode } from '@/services/states'
import parseTraffic from '@/utils/parse-traffic'

const ROUTE_BY_TAB: Record<string, string> = {
  home: '/',
  proxies: '/proxies',
  subscriptions: '/profile',
  connections: '/connections',
  rules: '/rules',
  logs: '/logs',
  test: '/unlock',
  settings: '/settings',
}

const SEARCH_DESTINATIONS: Array<{ terms: string[]; path: string }> = [
  { terms: ['代理', 'proxy', '节点', 'node'], path: '/proxies' },
  { terms: ['订阅', 'subscription', 'profile'], path: '/profile' },
  { terms: ['连接', 'connection'], path: '/connections' },
  { terms: ['规则', 'rule'], path: '/rules' },
  { terms: ['日志', 'log'], path: '/logs' },
  { terms: ['测试', 'test', '解锁', 'unlock'], path: '/unlock' },
  { terms: ['设置', 'setting'], path: '/settings' },
]

const text = (root: ParentNode, selector: string, value: string) => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element) element.textContent = value
}

const sanitizeDesignDocument = (source: string) => {
  if (typeof DOMParser === 'undefined') return ''

  const document = new DOMParser().parseFromString(source, 'text/html')
  const shell = document.querySelector('.window-shell')
  if (!shell) return ''

  // The design file is the DOM/CSS source of truth, but its demo telemetry is
  // deliberately removed before rendering. Live values are filled by the
  // bridge below from Clash Verge/Mihomo state.
  const subList = shell.querySelector('.sub-list')
  subList?.replaceChildren()
  const nodeMenu = shell.querySelector('#nodeMenu')
  nodeMenu?.replaceChildren()
  const groupMenu = shell.querySelector('#groupMenu')
  groupMenu?.replaceChildren()

  for (const selector of [
    '#totalTrafficUsed',
    '#totalTrafficPercent',
    '#expireDays',
    '#subCount',
    '#currentServerName',
    '#currentProto',
    '#currentPing',
    '#selectedGroupName',
    '#selectedNodeName',
    '#exitIpAddress',
    '#exitIpLocation',
    '#rateDownVal',
    '#rateUpVal',
    '#activeConnCount',
    '#cpuUsageVal',
    '#sessionDownVal',
    '#sessionUpVal',
  ]) {
    text(shell, selector, '--')
  }
  shell.querySelector<HTMLElement>('#totalProgressBar')?.style.setProperty(
    'width',
    '0%',
  )
  text(shell, '.expire-date', '--')
  text(shell, '.traffic-total', '--')
  text(shell, '.ver-text', 'v2.5.2')
  text(shell, '.app-version-info span:first-child', 'Clash Verge v2.5.2')

  shell.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
    const tab = item.dataset.tab
    const labels: Record<string, string> = {
      home: '首页',
      proxies: '代理',
      subscriptions: '订阅',
      connections: '连接',
      rules: '规则',
      logs: '日志',
      test: '测试',
      settings: '设置',
    }
    const label = item.querySelector('.nav-label')
    if (tab && label && labels[tab]) label.textContent = labels[tab]
  })

  return shell.innerHTML
}

const profileRows = (profiles: any[] | undefined) => {
  const rows = document.createDocumentFragment()
  for (const profile of profiles ?? []) {
    if (!profile) continue
    const item = document.createElement('div')
    item.className = 'sub-item'
    item.dataset.name = profile.name || profile.file || profile.uid || ''

    const brand = document.createElement('div')
    brand.className = 'sub-brand'
    const icon = document.createElement('div')
    icon.className = 'custom-icon icon-cloud-spark'
    icon.textContent = '✦'
    const name = document.createElement('span')
    name.className = 'sub-name'
    name.textContent = profile.name || profile.file || profile.uid || '未命名订阅'
    brand.append(icon, name)

    const extra = profile.extra
    const upload = Number(extra?.upload || 0)
    const download = Number(extra?.download || 0)
    const total = Number(extra?.total || 0)
    const used = upload + download
    const [usedValue, usedUnit] = parseTraffic(used)
    const [totalValue, totalUnit] = parseTraffic(total)
    const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

    const usage = document.createElement('div')
    usage.className = 'sub-usage'
    usage.textContent = total > 0 ? `${usedValue} ${usedUnit} / ${totalValue} ${totalUnit}` : '--'
    const progressWrap = document.createElement('div')
    progressWrap.className = 'sub-prog-wrap'
    const progress = document.createElement('div')
    progress.className = 'sub-prog-bar'
    progress.style.width = `${percent}%`
    progressWrap.append(progress)
    const percentNode = document.createElement('div')
    percentNode.className = 'sub-percent'
    percentNode.textContent = total > 0 ? `${percent}%` : '--'
    const reset = document.createElement('div')
    reset.className = 'sub-reset'
    reset.textContent = extra?.expire
      ? `到期 ${new Date(extra.expire * 1000).toISOString().slice(0, 10)}`
      : '到期信息不可用'
    const action = document.createElement('button')
    action.className = 'btn-node-list'
    action.dataset.source = profile.name || profile.file || profile.uid || ''
    action.textContent = '节点列表 >'
    item.append(brand, usage, progressWrap, percentNode, reset, action)
    rows.append(item)
  }
  return rows
}

type DesignNode = {
  name: string
  ping: number | '--'
  proto: string
}

const latestDelay = (record: any): number | '--' => {
  const history = Array.isArray(record?.history) ? record.history : []
  const delay = history[history.length - 1]?.delay
  return typeof delay === 'number' && delay >= 0 ? delay : '--'
}

const proxyRows = (proxies: any, groupName?: string): DesignNode[] => {
  const records = proxies?.records || {}
  const groups = Array.isArray(proxies?.groups) ? proxies.groups : []
  const group =
    groups.find((candidate: any) => candidate?.name === groupName) || groups[0]
  const candidates = Array.isArray(group?.all) ? group.all : []
  const names: string[] = candidates
    .map((candidate: any) =>
      typeof candidate === 'string' ? candidate : candidate?.name,
    )
    .filter((name: unknown): name is string => Boolean(name))

  return names.map((name): DesignNode => {
    const record = records[name] || {}
    return {
      name,
      ping: latestDelay(record),
      proto: record.type || '--',
    }
  })
}

const DesignTelemetryBridge = () => {
  const shellRef = useRef<HTMLDivElement>(null)
  const trafficHistoryRef = useRef<{
    down: Array<{ value: number; timestamp: number }>
    up: Array<{ value: number; timestamp: number }>
  }>({
    down: [],
    up: [],
  })
  const renderTrafficRef = useRef<(() => void) | null>(null)
  const [selectedGroupName, setSelectedGroupName] = useState<string>()
  const { profiles, current, mutateProfiles } = useProfiles()
  const { proxies } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshClashConfig, refreshProxy } = useAppRefreshers()
  const { indicator: systemProxyEnabled, toggleSystemProxy } = useSystemProxyState()
  const { isTunModeAvailable } = useSystemState()
  const { patchVerge, verge } = useVerge()
  const themeMode = useThemeMode()
  const setThemeMode = useSetThemeMode()
  const {
    response: { data: traffic },
  } = useTrafficData()
  const {
    response: { data: connectionSummary },
  } = useConnectionSummaryData()
  const groups = useMemo(
    () => (Array.isArray(proxies?.groups) ? proxies.groups : []),
    [proxies],
  )
  const defaultGroupName = groups.find((group: any) => group?.now)?.name || groups[0]?.name
  const activeGroupName = selectedGroupName || defaultGroupName
  const nodes = useMemo(
    () => proxyRows(proxies, activeGroupName),
    [activeGroupName, proxies],
  )
  const activeGroup = groups.find((group: any) => group?.name === activeGroupName)
  const selectedNode =
    nodes.find((node) => node.name === activeGroup?.now) || nodes[0]
  const { data: ipInfo } = useQuery({
    queryKey: ['cv_ip_info_cache'],
    queryFn: getIpInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
  const showToast = useCallback((message: string) => {
    const container = shellRef.current?.querySelector<HTMLElement>('#toastContainer')
    if (!container) return
    const toast = document.createElement('div')
    toast.className = 'toast-msg'
    const icon = document.createElement('span')
    icon.style.color = '#38bdf8'
    icon.textContent = '✦'
    const copy = document.createElement('span')
    copy.textContent = message
    toast.append(icon, copy)
    container.append(toast)
    const toastTimeoutId = window.setTimeout(() => toast.remove(), 2500)
    toast.dataset.timeoutId = String(toastTimeoutId)
  }, [])
  const { changeProxy } = useProxySelection({
    onSuccess: () => {
      void refreshProxy()
      showToast('节点切换成功')
    },
    onError: (error) => {
      console.error('[DesignShell] 节点切换失败:', error)
      showToast('节点切换失败，已保留当前连接')
    },
  })

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const subList = shell.querySelector<HTMLElement>('#subList')
    if (subList) {
      const profileSignature = (profiles?.items || [])
        .filter(Boolean)
        .map((profile: any) => {
          const extra = profile.extra || {}
          return [
            profile.uid,
            profile.name,
            profile.file,
            extra.upload,
            extra.download,
            extra.total,
            extra.expire,
          ].join(':')
        })
        .join('|')
      if (subList.dataset.signature !== profileSignature) {
        subList.replaceChildren()
        const rows = profileRows(profiles?.items)
        if (rows.childNodes.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'design-data-empty'
          empty.textContent = '暂无可用订阅资料'
          subList.append(empty)
        } else {
          subList.append(rows)
        }
        subList.dataset.signature = profileSignature
      }
    }
    text(shell, '#subCount', String(profiles?.items?.length ?? 0))

    const extra = current?.extra
    const used = Number(extra?.upload || 0) + Number(extra?.download || 0)
    const total = Number(extra?.total || 0)
    const [usedValue, usedUnit] = parseTraffic(used)
    const [totalValue, totalUnit] = parseTraffic(total)
    const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
    text(shell, '#totalTrafficUsed', total > 0 ? `${usedValue}` : '--')
    text(shell, '.traffic-unit', total > 0 ? usedUnit : '')
    text(shell, '.traffic-total', total > 0 ? `${totalValue} ${totalUnit}` : '--')
    text(shell, '#totalTrafficPercent', total > 0 ? `${percent}%` : '--')
    shell.querySelector<HTMLElement>('#totalProgressBar')?.style.setProperty('width', `${percent}%`)
    text(shell, '.expire-date', extra?.expire ? new Date(extra.expire * 1000).toISOString().slice(0, 10) : '--')
    text(shell, '#expireDays', extra?.expire ? String(Math.max(0, Math.ceil((extra.expire * 1000 - Date.now()) / 86400000))) : '--')

    const down = parseTraffic(traffic?.down || 0)
    const up = parseTraffic(traffic?.up || 0)
    text(shell, '#rateDownVal', traffic ? `${down[0]}` : '--')
    text(shell, '#rateUpVal', traffic ? `${up[0]}` : '--')
    text(shell, '#sessionDownVal', traffic ? `${parseTraffic(traffic.downTotal || 0).join(' ')} ` : '--')
    text(shell, '#sessionUpVal', traffic ? `${parseTraffic(traffic.upTotal || 0).join(' ')} ` : '--')
    text(shell, '#activeConnCount', String(connectionSummary?.activeConnectionCount ?? 0))
    text(shell, '#cpuUsageVal', '--')

    const mode = String(clashConfig?.mode || '').toLowerCase()
    shell.querySelectorAll<HTMLElement>('.seg-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === mode)
    })
    const systemToggle = shell.querySelector<HTMLInputElement>('#toggleSystemProxy')
    const tunToggle = shell.querySelector<HTMLInputElement>('#toggleTunMode')
    if (systemToggle) systemToggle.checked = systemProxyEnabled
    if (tunToggle) tunToggle.checked = Boolean(verge?.enable_tun_mode && isTunModeAvailable)
    shell.querySelector('#themeSun')?.classList.toggle('active', themeMode === 'light')
    shell.querySelector('#themeMoon')?.classList.toggle('active', themeMode === 'dark')
    shell.classList.toggle('design-light-theme', themeMode === 'light')

    const noticeBadge = shell.querySelector<HTMLElement>('.notice-badge')
    if (noticeBadge) noticeBadge.hidden = true

    const groupMenu = shell.querySelector<HTMLElement>('#groupMenu')
    if (groupMenu) {
      const groupNames = groups.map((group: any) => group?.name).filter(Boolean)
      const existingNames = Array.from(groupMenu.querySelectorAll<HTMLElement>('.dropdown-item')).map((item) => item.dataset.value)
      if (groupNames.join('|') !== existingNames.join('|')) {
        groupMenu.replaceChildren()
        for (const group of groups) {
          if (!group?.name) continue
          const option = document.createElement('div')
          option.className = 'dropdown-item'
          option.dataset.value = group.name
          option.textContent = group.name
          groupMenu.append(option)
        }
        text(shell, '#selectedGroupName', activeGroupName || '--')
      }
    }

    const nodeMenu = shell.querySelector<HTMLElement>('#nodeMenu')
    if (nodeMenu) {
      const signature = nodes.map((node) => `${node.name}:${node.ping}`).join('|')
      if (
        nodeMenu.dataset.signature !== signature ||
        nodeMenu.dataset.group !== (activeGroupName || '')
      ) {
        nodeMenu.replaceChildren()
        for (const node of nodes) {
          const option = document.createElement('div')
          option.className = 'dropdown-item'
          option.dataset.node = node.name
          option.dataset.ping = String(node.ping)
          option.dataset.proto = node.proto
          option.dataset.group = activeGroupName || ''
          option.textContent = `${node.name} (${node.ping === '--' ? '--' : `${node.ping}ms`})`
          nodeMenu.append(option)
        }
        nodeMenu.dataset.signature = signature
        nodeMenu.dataset.group = activeGroupName || ''
      }
    }
    text(shell, '#selectedGroupName', activeGroupName || '--')
    text(shell, '#selectedNodeName', selectedNode?.name || '--')
    text(shell, '#currentServerName', selectedNode?.name || '--')
    text(shell, '#currentProto', selectedNode?.proto || '--')
    text(shell, '#currentPing', String(selectedNode?.ping ?? '--'))
    text(shell, '#exitIpAddress', ipInfo?.ip || '--')
    text(
      shell,
      '#exitIpLocation',
      [ipInfo?.city, ipInfo?.region, ipInfo?.country].filter(Boolean).join(', ') ||
        'Unavailable',
    )
  }, [activeGroupName, clashConfig, connectionSummary, current, groups, ipInfo, isTunModeAvailable, nodes, profiles, selectedNode, systemProxyEnabled, themeMode, traffic, verge?.enable_tun_mode])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const cleanups: Array<() => void> = []
    const on = <T extends Element>(selector: string, event: string, handler: (event: Event, element: T) => void) => {
      shell.querySelectorAll<T>(selector).forEach((element) => {
        const listener = (event: Event) => handler(event, element)
        element.addEventListener(event, listener)
        cleanups.push(() => element.removeEventListener(event, listener))
      })
    }

    on<HTMLElement>('.btn-node-list', 'click', (event) => {
      event.stopPropagation()
      const overlay = shell.querySelector<HTMLElement>('#nodeModalOverlay')
      const body = shell.querySelector<HTMLElement>('#modalNodeList')
      if (!overlay || !body) return
      text(shell, '#modalTitle', `${activeGroupName || '当前策略组'} - 实时节点`)
      body.replaceChildren()
      if (nodes.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'design-data-empty'
        empty.textContent = '暂无实时节点'
        body.append(empty)
      } else {
        for (const node of nodes) {
          const item = document.createElement('div')
          item.className = 'modal-node-item'
          item.dataset.node = node.name
          item.dataset.group = activeGroupName || ''
          item.textContent = `${node.name} · ${node.proto} · ${node.ping === '--' ? '--' : `${node.ping} ms`}`
          body.append(item)
        }
      }
      overlay.classList.add('open')
    })
    const modalNodeList = shell.querySelector<HTMLElement>('#modalNodeList')
    const handleModalNodeSelect = (event: Event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('.modal-node-item')
      const groupName = item?.dataset.group || activeGroupName
      const nodeName = item?.dataset.node
      if (!groupName || !nodeName) return
      changeProxy(groupName, nodeName, activeGroup?.now)
      shell.querySelector('#nodeModalOverlay')?.classList.remove('open')
      showToast('正在切换节点…')
    }
    modalNodeList?.addEventListener('click', handleModalNodeSelect)
    if (modalNodeList) {
      cleanups.push(() =>
        modalNodeList.removeEventListener('click', handleModalNodeSelect),
      )
    }
    on<HTMLElement>('#modalCloseBtn', 'click', () => shell.querySelector('#nodeModalOverlay')?.classList.remove('open'))
    on<HTMLElement>('#nodeModalOverlay', 'click', (event, element) => {
      if (event.target === element) element.classList.remove('open')
    })
    on<HTMLElement>('.nav-item', 'click', (event, element) => {
      event.preventDefault()
      const path = ROUTE_BY_TAB[element.dataset.tab || 'home'] || '/'
      window.dispatchEvent(new CustomEvent('design-shell-navigate', { detail: path }))
    })
    on<HTMLElement>('#refreshSubBtn', 'click', (_event, element) => {
      const refreshCurrentProfile = async () => {
        if (!current?.uid) {
          showToast('没有可更新的当前订阅')
          return
        }
        element.setAttribute('aria-busy', 'true')
        element.classList.remove('rotating')
        void element.offsetWidth
        element.classList.add('rotating')
        try {
          await updateProfile(current.uid, current.option)
          await mutateProfiles()
          showToast('订阅已更新')
        } catch (error) {
          console.error('[DesignShell] 订阅更新失败:', error)
          showToast('订阅更新失败，请查看日志')
        } finally {
          element.removeAttribute('aria-busy')
        }
      }
      void refreshCurrentProfile()
    })
    const groupMenu = shell.querySelector<HTMLElement>('#groupMenu')
    const nodeMenu = shell.querySelector<HTMLElement>('#nodeMenu')
    const closeMenus = () => {
      groupMenu?.classList.remove('open')
      nodeMenu?.classList.remove('open')
    }
    on<HTMLElement>('#groupDropdown .dropdown-trigger', 'click', (event) => {
      event.stopPropagation()
      nodeMenu?.classList.remove('open')
      groupMenu?.classList.toggle('open')
    })
    on<HTMLElement>('#nodeDropdown .dropdown-trigger', 'click', (event) => {
      event.stopPropagation()
      groupMenu?.classList.remove('open')
      nodeMenu?.classList.toggle('open')
    })
    on<HTMLElement>('#groupMenu .dropdown-item', 'click', (event, element) => {
      event.stopPropagation()
      setSelectedGroupName(element.dataset.value)
      closeMenus()
    })
    on<HTMLElement>('#nodeMenu .dropdown-item', 'click', (event, element) => {
      event.stopPropagation()
      const groupName = element.dataset.group || activeGroupName
      const nodeName = element.dataset.node
      if (groupName && nodeName) {
        changeProxy(groupName, nodeName, activeGroup?.now)
        showToast('正在切换节点…')
      }
      closeMenus()
    })
    shell.addEventListener('click', closeMenus)
    cleanups.push(() => shell.removeEventListener('click', closeMenus))
    on<HTMLElement>('#disconnectBtn', 'click', () => {
      window.dispatchEvent(new CustomEvent('design-shell-navigate', { detail: '/proxies' }))
    })
    on<HTMLInputElement>('#toggleSystemProxy', 'change', (event, element) => {
      const target = element.checked
      void toggleSystemProxy(target).catch((error) => {
        console.error('[DesignShell] System Proxy 切换失败:', error)
        element.checked = systemProxyEnabled
        showToast('System Proxy 切换失败')
      })
    })
    on<HTMLInputElement>('#toggleTunMode', 'change', (event, element) => {
      const target = element.checked
      if (target && !isTunModeAvailable) {
        element.checked = false
        showToast('TUN 当前不可用：需要管理员权限或系统服务')
        return
      }
      void patchVerge({ enable_tun_mode: target }).catch((error) => {
        console.error('[DesignShell] TUN 切换失败:', error)
        element.checked = Boolean(verge?.enable_tun_mode)
        showToast('TUN 切换失败')
      })
    })
    on<HTMLElement>('#noticeBtn', 'click', () => {
      if (!profiles && groups.length === 0) {
        showToast('暂无可用的运行状态')
        return
      }
      const summary = [
        `订阅 ${profiles?.items?.length ?? 0}`,
        `策略组 ${groups.length}`,
        `活动连接 ${connectionSummary?.activeConnectionCount ?? 0}`,
      ].join(' · ')
      showToast(`当前软件状态：${summary}`)
    })
    on<HTMLElement>('#themeToggle', 'click', () => {
      const nextMode = themeMode === 'dark' ? 'light' : 'dark'
      void patchVerge({ theme_mode: nextMode })
        .then(() => {
          setThemeMode(nextMode)
          showToast(nextMode === 'light' ? '已切换至日间主题' : '已切换至夜间主题')
        })
        .catch((error) => {
          console.error('[DesignShell] 主题切换失败:', error)
          showToast('主题切换失败')
        })
    })
    on<HTMLElement>('#exitIpCard', 'click', async () => {
      const value = shell.querySelector('#exitIpAddress')?.textContent || ''
      if (!value || value === '--') return
      await navigator.clipboard?.writeText(value).catch(() => undefined)
      showToast(`IP 地址 ${value} 已复制`)
    })
    on<HTMLElement>('.seg-btn', 'click', (_event, element) => {
      const nextMode = element.dataset.mode || 'rule'
      void patchClashMode(nextMode)
        .then(async () => {
          await refreshClashConfig()
          showToast(`Clash Mode 已切换为 ${nextMode}`)
        })
        .catch((error) => {
          console.error('[DesignShell] Clash Mode 切换失败:', error)
          showToast('Clash Mode 切换失败，已保留原状态')
        })
    })

    const input = shell.querySelector<HTMLInputElement>('#searchInput')
    const search = () => {
      const query = input?.value.trim().toLowerCase() || ''
      shell.querySelectorAll<HTMLElement>('.sub-item').forEach((item) => {
        item.style.display = !query || (item.dataset.name || '').toLowerCase().includes(query) ? 'flex' : 'none'
      })
      nodeMenu?.querySelectorAll<HTMLElement>('.dropdown-item').forEach((item) => {
        item.style.display = !query || (item.dataset.node || '').toLowerCase().includes(query) ? 'block' : 'none'
      })
    }
    const handleSearchKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      const query = input?.value.trim().toLowerCase() || ''
      if (!query) return
      const route = SEARCH_DESTINATIONS.find((destination) =>
        destination.terms.some((term) => term.includes(query) || query.includes(term)),
      )
      if (route) {
        window.dispatchEvent(new CustomEvent('design-shell-navigate', { detail: route.path }))
        return
      }
      if (query && nodes.some((node) => node.name.toLowerCase().includes(query))) {
        nodeMenu?.classList.add('open')
      }
    }
    input?.addEventListener('input', search)
    input?.addEventListener('keydown', handleSearchKeyDown)
    if (input) {
      cleanups.push(() => input.removeEventListener('input', search))
      cleanups.push(() => input.removeEventListener('keydown', handleSearchKeyDown))
    }

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [activeGroup?.now, activeGroupName, changeProxy, connectionSummary?.activeConnectionCount, current, groups.length, isTunModeAvailable, mutateProfiles, nodes, patchVerge, profiles, refreshClashConfig, setThemeMode, showToast, systemProxyEnabled, themeMode, toggleSystemProxy, verge?.enable_tun_mode])

  useEffect(() => {
    const shell = shellRef.current
    const canvas = shell?.querySelector<HTMLCanvasElement>('#starsCanvas')
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const particles = Array.from({ length: 35 }, (_, index) => ({
      x: ((index * 193) % 1024) / 1024,
      y: ((index * 317) % 683) / 683,
      radius: 0.35 + ((index * 7) % 12) / 10,
      phase: index * 0.73,
    }))
    let frame = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * ratio))
      canvas.height = Math.max(1, Math.round(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect()
      context.clearRect(0, 0, rect.width, rect.height)
      for (const particle of particles) {
        const alpha = 0.2 + (Math.sin(time * 0.001 + particle.phase) + 1) * 0.18
        context.beginPath()
        context.arc(particle.x * rect.width, particle.y * rect.height, particle.radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(160, 220, 255, ${alpha})`
        context.shadowColor = '#38bdf8'
        context.shadowBlur = 4
        context.fill()
      }
      frame = window.requestAnimationFrame(draw)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    frame = window.requestAnimationFrame(draw)
    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const history = trafficHistoryRef.current
    const timestamp = Date.now()
    history.down.push({ value: Math.max(0, traffic?.down || 0), timestamp })
    history.up.push({ value: Math.max(0, traffic?.up || 0), timestamp })
    history.down.splice(0, Math.max(0, history.down.length - 60))
    history.up.splice(0, Math.max(0, history.up.length - 60))
    renderTrafficRef.current?.()
  }, [traffic])

  useEffect(() => {
    const shell = shellRef.current
    const canvas = shell?.querySelector<HTMLCanvasElement>('#trafficCanvas')
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * ratio))
      canvas.height = Math.max(1, Math.round(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const width = rect.width
      const height = rect.height
      const padLeft = 46
      const padBottom = 16
      const plotHeight = height - padBottom - 6
      const plotWidth = width - padLeft - 10
      const history = trafficHistoryRef.current
      const points = [...history.up, ...history.down]
      const maxRate = Math.max(1, ...points.map((point) => point.value))
      const formatRate = (value: number) => `${parseTraffic(value).join(' ')}/s`
      context.clearRect(0, 0, width, height)
      context.font = '9px sans-serif'
      context.fillStyle = '#64748b'
      context.textAlign = 'right'
      context.textBaseline = 'middle'
      for (const tick of [
        { label: formatRate(maxRate), y: 6 },
        { label: formatRate(maxRate / 2), y: 6 + plotHeight * 0.5 },
        { label: '0', y: 6 + plotHeight },
      ]) {
        context.fillText(tick.label, padLeft - 8, tick.y)
        context.beginPath()
        context.setLineDash([3, 4])
        context.strokeStyle = 'rgba(56, 189, 248, 0.12)'
        context.moveTo(padLeft, tick.y)
        context.lineTo(padLeft + plotWidth, tick.y)
        context.stroke()
      }
      context.setLineDash([])
      context.textAlign = 'center'
      context.textBaseline = 'top'
      const timePoints = history.down
      const labelCount = Math.min(6, timePoints.length)
      for (let index = 0; index < labelCount; index++) {
        const pointIndex =
          labelCount === 1
            ? 0
            : Math.round((index * (timePoints.length - 1)) / (labelCount - 1))
        const point = timePoints[pointIndex]
        const label = point
          ? new Date(point.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : ''
        context.fillText(
          label,
          padLeft + (plotWidth / Math.max(1, labelCount - 1)) * index,
          height - padBottom + 3,
        )
      }

      const drawLine = (
        series: Array<{ value: number; timestamp: number }>,
        stroke: string,
        fill: string,
      ) => {
        if (series.length < 2) return
        const step = plotWidth / Math.max(1, series.length - 1)
        context.beginPath()
        series.forEach((point, index) => {
          const x = padLeft + index * step
          const y = 6 + plotHeight * (1 - Math.min(1, point.value / maxRate))
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.lineTo(padLeft + (series.length - 1) * step, 6 + plotHeight)
        context.lineTo(padLeft, 6 + plotHeight)
        context.closePath()
        context.fillStyle = fill
        context.fill()
        context.beginPath()
        series.forEach((point, index) => {
          const x = padLeft + index * step
          const y = 6 + plotHeight * (1 - Math.min(1, point.value / maxRate))
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.strokeStyle = stroke
        context.lineWidth = 1.8
        context.shadowColor = stroke
        context.shadowBlur = 6
        context.stroke()
        context.shadowBlur = 0
      }
      drawLine(history.up, '#e879f9', 'rgba(232, 121, 249, 0.20)')
      drawLine(history.down, '#00d2ff', 'rgba(0, 210, 255, 0.24)')
    }

    let frame: number | undefined
    const scheduleDraw = () => {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame(() => {
        frame = undefined
        draw()
      })
    }
    renderTrafficRef.current = scheduleDraw
    const resizeObserver = new ResizeObserver(scheduleDraw)
    resizeObserver.observe(canvas.parentElement || canvas)
    scheduleDraw()
    return () => {
      resizeObserver.disconnect()
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      if (renderTrafficRef.current === scheduleDraw) {
        renderTrafficRef.current = null
      }
    }
  }, [])

  const markup = useMemo(() => sanitizeDesignDocument(designDocument), [])
  return <div ref={shellRef} className="design-static-shell" dangerouslySetInnerHTML={{ __html: markup }} />
}

export const DesignShell = ({ children, isHome }: { children: ReactNode; isHome: boolean }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { minimize, close, toggleMaximize } = useWindowControls()
  const themeMode = useThemeMode()

  useEffect(() => {
    const navigateListener = (event: Event) => {
      const path = (event as CustomEvent<string>).detail
      navigate(path)
    }
    window.addEventListener('design-shell-navigate', navigateListener)
    return () => window.removeEventListener('design-shell-navigate', navigateListener)
  }, [navigate])

  useEffect(() => {
    const root = document.querySelector('.design-static-shell')
    if (!root) return
    const bindWindowControl = (selector: string, name: string, action: () => Promise<void>) => {
      const button = root.querySelector(selector)
      if (!button) return () => {}
      const listener = () => {
        void action().catch((error) =>
          console.error(`[DesignShell] ${name} 窗口操作失败:`, error),
        )
      }
      button.addEventListener('click', listener)
      return () => button.removeEventListener('click', listener)
    }
    const cleanups = [
      bindWindowControl('#winMin', '最小化', minimize),
      bindWindowControl('#winMax', '最大化/恢复', toggleMaximize),
      bindWindowControl('#winClose', '关闭', close),
    ]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [close, minimize, toggleMaximize])

  useEffect(() => {
    const root = document.querySelector('.design-static-shell')
    if (!root) return
    const activeTab = Object.entries(ROUTE_BY_TAB).find(([, path]) => path === pathname)?.[0] || 'home'
    root.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.tab === activeTab)
    })
  }, [pathname])

  return (
    <div
      className={`design-app ${isHome ? 'home-mode' : 'route-mode'}`}
      data-design-theme={themeMode}
    >
      <div className="viewport-wrapper">
        <div className="window-shell" data-design-shell="true">
          <DesignTelemetryBridge />
          <div
            className="design-shell-drag-region"
            data-tauri-drag-region="true"
            onDoubleClick={() => {
              void toggleMaximize().catch((error) =>
                console.error('[DesignShell] 双击最大化/恢复失败:', error),
              )
            }}
          />
          <div className="design-route-content" aria-hidden={isHome}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
