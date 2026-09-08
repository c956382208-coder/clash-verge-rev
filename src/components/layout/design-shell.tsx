/* The design template is an audited local asset. Its event bridge intentionally
   uses imperative listeners because the DOM hierarchy is copied verbatim. */
/* eslint-disable @eslint-react/web-api-no-leaked-event-listener, @eslint-react/dom-no-dangerously-set-innerhtml */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

import designDocument from '@/assets/design-dashboard/index.html?raw'
import '@/assets/design-dashboard/css/style.css'
import '@/assets/styles/design-shell.scss'
import { useConnectionSummaryData } from '@/hooks/use-connection-data'
import { useProfiles } from '@/hooks/use-profiles'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVerge } from '@/hooks/use-verge'
import { useWindowControls } from '@/hooks/use-window'
import {
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { patchClashMode } from '@/services/cmds'
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

const proxyRows = (proxies: any) => {
  const records = proxies?.records || {}
  const groups = Array.isArray(proxies?.groups) ? proxies.groups : []
  const names: string[] = []
  for (const group of groups) {
    for (const candidate of Array.isArray(group?.all) ? group.all : []) {
      const name = typeof candidate === 'string' ? candidate : candidate?.name
      if (name && !names.includes(name)) names.push(name)
    }
  }
  return names.slice(0, 40).map((name) => {
    const record = records[name] || {}
    return {
      name,
      ping: record.delay ?? record.latency ?? '--',
      proto: record.type || '--',
      ip: record.server || '--',
      location: '--',
    }
  })
}

const DesignTelemetryBridge = () => {
  const shellRef = useRef<HTMLDivElement>(null)
  const trafficHistoryRef = useRef<{ down: number[]; up: number[] }>({
    down: [],
    up: [],
  })
  const { profiles, current, mutateProfiles } = useProfiles()
  const { proxies } = useProxiesData()
  const { clashConfig } = useClashConfigData()
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

  const nodes = useMemo(() => proxyRows(proxies), [proxies])
  const groups = useMemo(
    () => (Array.isArray(proxies?.groups) ? proxies.groups : []),
    [proxies],
  )
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

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const subList = shell.querySelector<HTMLElement>('#subList')
    if (subList) {
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
    shell.querySelector('#themeSun')?.classList.toggle('active', themeMode === 'dark')
    shell.querySelector('#themeMoon')?.classList.toggle('active', themeMode === 'light')

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
        const selected = groups.find((group: any) => group?.now)?.name || groups[0]?.name || '--'
        text(shell, '#selectedGroupName', selected)
      }
    }

    const nodeMenu = shell.querySelector<HTMLElement>('#nodeMenu')
    if (nodeMenu) {
      const existingNames = Array.from(nodeMenu.querySelectorAll<HTMLElement>('.dropdown-item')).map((item) => item.dataset.node)
      if (nodes.map((node) => node.name).join('|') !== existingNames.join('|')) {
        nodeMenu.replaceChildren()
        for (const node of nodes) {
          const option = document.createElement('div')
          option.className = 'dropdown-item'
          option.dataset.node = node.name
          option.dataset.ping = String(node.ping)
          option.dataset.proto = node.proto
          option.dataset.ip = node.ip
          option.dataset.loc = node.location
          option.textContent = `${node.name} (${node.ping}ms)`
          nodeMenu.append(option)
        }
        const active = nodes[0]
        if (active) {
          text(shell, '#selectedNodeName', active.name)
          text(shell, '#currentServerName', active.name)
          text(shell, '#currentProto', active.proto)
          text(shell, '#currentPing', String(active.ping))
          text(shell, '#exitIpAddress', active.ip)
          text(shell, '#exitIpLocation', active.location)
        }
      }
    }
  }, [clashConfig, connectionSummary, current, groups, isTunModeAvailable, nodes, profiles, systemProxyEnabled, themeMode, traffic, verge?.enable_tun_mode])

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

    on<HTMLElement>('.btn-node-list', 'click', (event, element) => {
      event.stopPropagation()
      const overlay = shell.querySelector<HTMLElement>('#nodeModalOverlay')
      const body = shell.querySelector<HTMLElement>('#modalNodeList')
      if (!overlay || !body) return
      text(shell, '#modalTitle', `${element.dataset.source || ''} - 实时节点`)
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
          item.textContent = `${node.name} · ${node.proto} · ${node.ping} ms`
          body.append(item)
        }
      }
      overlay.classList.add('open')
    })
    on<HTMLElement>('#modalCloseBtn', 'click', () => shell.querySelector('#nodeModalOverlay')?.classList.remove('open'))
    on<HTMLElement>('#nodeModalOverlay', 'click', (event, element) => {
      if (event.target === element) element.classList.remove('open')
    })
    on<HTMLElement>('.nav-item', 'click', (event, element) => {
      event.preventDefault()
      const path = ROUTE_BY_TAB[element.dataset.tab || 'home'] || '/'
      window.dispatchEvent(new CustomEvent('design-shell-navigate', { detail: path }))
    })
    on<HTMLElement>('#refreshSubBtn', 'click', () => void mutateProfiles())
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
      shell.querySelector('#selectedGroupName')!.textContent = element.textContent
      closeMenus()
    })
    on<HTMLElement>('#nodeMenu .dropdown-item', 'click', (event, element) => {
      event.stopPropagation()
      shell.querySelector('#selectedNodeName')!.textContent = element.dataset.node || '--'
      text(shell, '#currentServerName', element.dataset.node || '--')
      text(shell, '#currentProto', element.dataset.proto || '--')
      text(shell, '#currentPing', element.dataset.ping || '--')
      text(shell, '#exitIpAddress', element.dataset.ip || '--')
      text(shell, '#exitIpLocation', element.dataset.loc || '--')
      closeMenus()
    })
    shell.addEventListener('click', closeMenus)
    cleanups.push(() => shell.removeEventListener('click', closeMenus))
    on<HTMLElement>('#disconnectBtn', 'click', () => {
      window.dispatchEvent(new CustomEvent('design-shell-navigate', { detail: '/proxies' }))
    })
    on<HTMLElement>('#refreshSubBtn', 'click', (_event, element) => {
      element.classList.remove('rotating')
      void element.offsetWidth
      element.classList.add('rotating')
    })
    on<HTMLInputElement>('#toggleSystemProxy', 'change', (event, element) => {
      void toggleSystemProxy(element.checked)
    })
    on<HTMLInputElement>('#toggleTunMode', 'change', (event, element) => {
      void patchVerge({ enable_tun_mode: element.checked })
    })
    on<HTMLElement>('#noticeBtn', 'click', () => showToast('通知中心暂无新的系统告警'))
    on<HTMLElement>('#winMin', 'click', () => showToast('应用已最小化到系统托盘'))
    on<HTMLElement>('#winMax', 'click', () => showToast('窗口最大化由 Tauri 窗口控制'))
    on<HTMLElement>('#winClose', 'click', () => showToast('应用关闭由 Tauri 窗口控制'))
    on<HTMLElement>('#themeToggle', 'click', (event, element) => {
      element.classList.toggle('design-light-theme')
      setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
      showToast(element.classList.contains('design-light-theme') ? '已切换至日间主题' : '已切换至夜间主题')
    })
    on<HTMLElement>('#exitIpCard', 'click', async () => {
      const value = shell.querySelector('#exitIpAddress')?.textContent || ''
      if (!value || value === '--') return
      await navigator.clipboard?.writeText(value).catch(() => undefined)
      showToast(`IP 地址 ${value} 已复制`)
    })
    on<HTMLElement>('.seg-btn', 'click', (event, element) => {
      shell.querySelectorAll('.seg-btn').forEach((button) => button.classList.remove('active'))
      element.classList.add('active')
      void patchClashMode(element.dataset.mode || 'rule')
    })

    const input = shell.querySelector<HTMLInputElement>('#searchInput')
    const search = () => {
      const query = input?.value.trim().toLowerCase() || ''
      shell.querySelectorAll<HTMLElement>('.sub-item').forEach((item) => {
        item.style.display = !query || (item.dataset.name || '').toLowerCase().includes(query) ? 'flex' : 'none'
      })
    }
    input?.addEventListener('input', search)
    if (input) cleanups.push(() => input.removeEventListener('input', search))

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [groups, mutateProfiles, nodes, patchVerge, profiles, setThemeMode, showToast, themeMode, toggleSystemProxy])

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
    window.addEventListener('resize', resize)
    frame = window.requestAnimationFrame(draw)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    const canvas = shell?.querySelector<HTMLCanvasElement>('#trafficCanvas')
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const history = trafficHistoryRef.current
    const toPoint = (value: unknown) => {
      const numeric = typeof value === 'number' ? value : 0
      if (numeric <= 0) return 0
      return Math.max(0.04, Math.min(0.92, Math.log2(numeric + 1) / 22))
    }
    history.down.push(toPoint(traffic?.down))
    history.up.push(toPoint(traffic?.up))
    history.down.splice(0, Math.max(0, history.down.length - 20))
    history.up.splice(0, Math.max(0, history.up.length - 20))

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
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
      context.clearRect(0, 0, width, height)
      context.font = '9px sans-serif'
      context.fillStyle = '#64748b'
      context.textAlign = 'right'
      context.textBaseline = 'middle'
      for (const tick of [
        { label: '2 MB/s', y: 6 },
        { label: '1 MB/s', y: 6 + plotHeight * 0.5 },
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
      for (const [index, label] of ['10:40', '10:42', '10:44', '10:46', '10:48', '10:50'].entries()) {
        context.fillText(label, padLeft + (plotWidth / 5) * index, height - padBottom + 3)
      }

      const drawLine = (points: number[], stroke: string, fill: string) => {
        if (points.length < 2) return
        const step = plotWidth / Math.max(1, points.length - 1)
        context.beginPath()
        points.forEach((point, index) => {
          const x = padLeft + index * step
          const y = 6 + plotHeight * (1 - point)
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.lineTo(padLeft + (points.length - 1) * step, 6 + plotHeight)
        context.lineTo(padLeft, 6 + plotHeight)
        context.closePath()
        context.fillStyle = fill
        context.fill()
        context.beginPath()
        points.forEach((point, index) => {
          const x = padLeft + index * step
          const y = 6 + plotHeight * (1 - point)
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

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [traffic])

  const markup = useMemo(() => sanitizeDesignDocument(designDocument), [])
  return <div ref={shellRef} className="design-static-shell" dangerouslySetInnerHTML={{ __html: markup }} />
}

export const DesignShell = ({ children, isHome }: { children: ReactNode; isHome: boolean }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { minimize, close, toggleMaximize } = useWindowControls()
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const updateScale = () => {
      const shell = frame.querySelector<HTMLElement>('.window-shell')
      if (shell) {
        shell.style.transform = `scale(${Math.min(1, frame.clientWidth / 1024, frame.clientHeight / 683)})`
      }
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

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
    const bindWindowControl = (selector: string, action: () => void) => {
      const button = root.querySelector(selector)
      if (!button) return () => {}
      button.addEventListener('click', action)
      return () => button.removeEventListener('click', action)
    }
    const cleanups = [
      bindWindowControl('#winMin', minimize),
      bindWindowControl('#winMax', toggleMaximize),
      bindWindowControl('#winClose', close),
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
    <div className={`design-app ${isHome ? 'home-mode' : 'route-mode'}`}>
      <div ref={frameRef} className="viewport-wrapper">
        <div className="window-shell" data-design-shell="true">
          <DesignTelemetryBridge />
          <div className="design-shell-drag-region" data-tauri-drag-region="true" />
          <div className="design-route-content" aria-hidden={isHome}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
