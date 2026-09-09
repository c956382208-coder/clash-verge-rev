import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router'

import { buildDashboardProxyModel } from '@/adapters/proxy-runtime'
import '@/assets/design-dashboard/css/style.css'
import '@/assets/styles/design-shell.scss'
import { TrafficChart } from '@/components/dashboard/traffic-chart'
import { useConnectionSummaryData } from '@/hooks/use-connection-data'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import { useWindowControls } from '@/hooks/use-window'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { getIpInfo } from '@/services/api'
import { patchClashMode, updateProfile } from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { useQuery } from '@/services/query-client'
import { useSetThemeMode, useThemeMode } from '@/services/states'
import parseTraffic from '@/utils/parse-traffic'

const NAVIGATION = [
  { label: '首页', path: '/', icon: '⌂' },
  { label: '代理', path: '/proxies', icon: '◎' },
  { label: '订阅', path: '/profile', icon: '▤' },
  { label: '连接', path: '/connections', icon: '⌁' },
  { label: '规则', path: '/rules', icon: '◇' },
  { label: '日志', path: '/logs', icon: '≡' },
  { label: '测试', path: '/unlock', icon: '◌' },
  { label: '设置', path: '/settings', icon: '⚙' },
] as const

type SearchResult = {
  groupName: string
  nodeName: string
  previousNode?: string
}

const SEARCH_DESTINATIONS = [
  { terms: ['首页', 'home'], path: '/' },
  { terms: ['代理', 'proxy', '节点', 'node'], path: '/proxies' },
  { terms: ['订阅', 'subscription', 'profile'], path: '/profile' },
  { terms: ['连接', 'connection'], path: '/connections' },
  { terms: ['规则', 'rule'], path: '/rules' },
  { terms: ['日志', 'log'], path: '/logs' },
  { terms: ['测试', 'test', '解锁', 'unlock'], path: '/unlock' },
  { terms: ['设置', 'setting'], path: '/settings' },
] as const

const isSelectableGroup = (group?: { type?: string }) =>
  Boolean(group && ['Selector', 'URLTest', 'Fallback'].includes(group.type ?? ''))

const formatDate = (timestamp?: number) => {
  if (!timestamp) return 'Not provided'
  const date = new Date(timestamp * 1000)
  return Number.isNaN(date.valueOf()) ? 'Not provided' : date.toISOString().slice(0, 10)
}

const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const particles = Array.from({ length: 24 }, (_, index) => ({
      x: ((index * 193) % 997) / 997,
      y: ((index * 317) % 991) / 991,
      radius: 0.4 + ((index * 7) % 9) / 10,
      phase: index * 0.71,
    }))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame: number | undefined
    let lastFrameAt = 0
    let size = { width: 0, height: 0, ratio: 0 }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      if (rect.width === size.width && rect.height === size.height && ratio === size.ratio) {
        return rect
      }
      size = { width: rect.width, height: rect.height, ratio }
      canvas.width = Math.max(1, Math.round(rect.width * ratio))
      canvas.height = Math.max(1, Math.round(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      return rect
    }

    const draw = (time = 0) => {
      const rect = resize()
      context.clearRect(0, 0, rect.width, rect.height)
      particles.forEach((particle) => {
        context.beginPath()
        context.arc(particle.x * rect.width, particle.y * rect.height, particle.radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(160, 220, 255, ${0.16 + (Math.sin(time * 0.001 + particle.phase) + 1) * 0.12})`
        context.fill()
      })
    }

    const tick = (time: number) => {
      if (!document.hidden && !reducedMotion.matches && time - lastFrameAt >= 33) {
        lastFrameAt = time
        draw(time)
      }
      frame = window.requestAnimationFrame(tick)
    }
    const onVisibilityChange = () => {
      if (!document.hidden) draw(performance.now())
    }
    const observer = new ResizeObserver(() => draw(performance.now()))
    observer.observe(canvas)
    document.addEventListener('visibilitychange', onVisibilityChange)
    draw(performance.now())
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(tick)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className="design-starfield" aria-hidden="true" />
}

const DesignHeader = () => {
  const navigate = useNavigate()
  const { minimize, close, toggleMaximize } = useWindowControls()
  const { patchVerge } = useVerge()
  const { proxies } = useProxiesData()
  const { refreshProxy } = useAppRefreshers()
  const { changeProxyVerified } = useProxySelection({
    onSuccess: () => void refreshProxy(),
  })
  const themeMode = useThemeMode()
  const setThemeMode = useSetThemeMode()
  const [query, setQuery] = useState('')
  const [selectingSearchResult, setSelectingSearchResult] = useState(false)
  const nodeResults = useMemo<SearchResult[]>(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return (proxies?.groups ?? []).flatMap((group: IProxyGroupItem) =>
      (group.all ?? []).flatMap((proxy) => {
        const name = typeof proxy === 'string' ? proxy : proxy.name
        return name && name.toLowerCase().includes(normalized)
          ? [{ groupName: group.name, nodeName: name, previousNode: group.now }]
          : []
      }),
    ).slice(0, 6)
  }, [proxies?.groups, query])

  const submitSearch = useCallback(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return
    const destination = SEARCH_DESTINATIONS.find((candidate) =>
      candidate.terms.some((term) => term.includes(normalized) || normalized.includes(term)),
    )
    if (destination) {
      navigate(destination.path)
      return
    }
    navigate(`/proxies?search=${encodeURIComponent(query.trim())}`)
    showNotice.info(`Search opened for “${query.trim()}”.`)
  }, [navigate, query])

  const toggleTheme = useCallback(async () => {
    const nextMode = themeMode === 'dark' ? 'light' : 'dark'
    try {
      await patchVerge({ theme_mode: nextMode })
      setThemeMode(nextMode)
    } catch (error) {
      showNotice.error(error)
    }
  }, [patchVerge, setThemeMode, themeMode])

  const selectSearchResult = useCallback(
    async (result: SearchResult) => {
      if (selectingSearchResult) return
      setSelectingSearchResult(true)
      try {
        await changeProxyVerified(result.groupName, result.nodeName, result.previousNode)
        await refreshProxy()
        setQuery('')
        navigate('/')
        showNotice.success('Proxy selection verified.')
      } catch (error) {
        await refreshProxy()
        showNotice.error(error)
      } finally {
        setSelectingSearchResult(false)
      }
    },
    [changeProxyVerified, navigate, refreshProxy, selectingSearchResult],
  )

  return (
    <header className="top-header">
      <div className="brand-area">
        <div className="brand-logo" aria-hidden="true">◆</div>
        <div className="brand-text">
          <div className="brand-title">Clash Verge</div>
          <div className="brand-sub">Connect a Bigger World</div>
        </div>
      </div>
      <div className="hero-slogan">
        <div className="slogan-main">连接无界 · 探索更大的世界</div>
        <div className="slogan-sub">稳定 · 高速 · 安全</div>
      </div>
      <div className="top-controls">
        <div className="design-search">
        <label className="search-box">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSearch()
            }}
            placeholder="搜索节点、规则或设置..."
            aria-label="Search routes and proxy nodes"
          />
        </label>
        {nodeResults.length > 0 && (
          <div className="design-search-results" role="listbox" aria-label="Matching proxy nodes">
            {nodeResults.map((result) => (
              <button key={`${result.groupName}:${result.nodeName}`} type="button" disabled={selectingSearchResult} onClick={() => void selectSearchResult(result)}>
                <span>{result.nodeName}</span><small>{result.groupName}</small>
              </button>
            ))}
          </div>
        )}
        </div>
        <button className="theme-toggle" type="button" onClick={() => void toggleTheme()} aria-label="Toggle theme">
          <span className={themeMode === 'light' ? 'theme-option active' : 'theme-option'}>☀</span>
          <span className={themeMode === 'dark' ? 'theme-option active' : 'theme-option'}>☾</span>
        </button>
        <button className="icon-btn" type="button" onClick={() => navigate('/logs')} title="Open logs">
          ♢
        </button>
        <div className="window-actions" data-tauri-drag-region="false">
          <button className="win-btn win-min" type="button" onClick={() => void minimize()} aria-label="Minimize">−</button>
          <button className="win-btn win-max" type="button" onClick={() => void toggleMaximize()} aria-label="Maximize or restore">□</button>
          <button className="win-btn win-close" type="button" onClick={() => void close()} aria-label="Close">×</button>
        </div>
      </div>
    </header>
  )
}

const DesignSidebar = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <aside className="sidebar">
      <nav className="nav-menu" aria-label="Application navigation">
        {NAVIGATION.map((item) => (
          <button
            key={item.path}
            className={pathname === item.path ? 'nav-item active' : 'nav-item'}
            type="button"
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="status-pill"><span className="ver-text">v2.5.2</span><span className="live-dot" /><span className="live-text">运行中</span></div>
    </aside>
  )
}

const SubscriptionCard = () => {
  const { profiles, current, mutateProfiles } = useProfiles()
  const [refreshing, setRefreshing] = useState(false)
  const [now] = useState(() => Date.now())
  const items = profiles?.items?.filter(Boolean) ?? []
  const extra = current?.extra
  const used = Number(extra?.upload ?? 0) + Number(extra?.download ?? 0)
  const total = Number(extra?.total ?? 0)
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const [usedValue, usedUnit] = parseTraffic(used)
  const [totalValue, totalUnit] = parseTraffic(total)
  const daysLeft = extra?.expire ? Math.max(0, Math.ceil((extra.expire * 1000 - now) / 86400000)) : null

  const refreshCurrent = async () => {
    if (!current?.uid) {
      showNotice.info('No active profile to update.')
      return
    }
    setRefreshing(true)
    try {
      await updateProfile(current.uid, current.option)
      await mutateProfiles()
      showNotice.success('Profile updated.')
    } catch (error) {
      showNotice.error(error)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="card card-subscription">
      <div className="card-header">
        <div className="card-title-group"><span className="card-title">总订阅</span></div>
        <button className="btn-refresh" type="button" disabled={refreshing} onClick={() => void refreshCurrent()}>{refreshing ? '更新中…' : '更新订阅'}</button>
      </div>
      <div className="traffic-summary">
        <div className="traffic-numbers">
          <span className="traffic-used">{total > 0 ? usedValue : '--'}</span>
          <span className="traffic-unit">{total > 0 ? usedUnit : ''}</span>
          <span className="traffic-divider">{total > 0 ? '/' : ''}</span>
          <span className="traffic-total">{total > 0 ? `${totalValue} ${totalUnit}` : 'No active profile'}</span>
        </div>
        <div className="traffic-percentage">{total > 0 ? `${percent}%` : '--'}</div>
      </div>
      <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${percent}%` }} /></div>
      <div className="subscription-meta">
        <span>{daysLeft === null ? 'Expire: Not provided' : `距离到期还有 ${daysLeft} 天 (${formatDate(extra?.expire)})`}</span>
        <span>共 {items.length} 个资源</span>
      </div>
      <div className="sub-list">
        {items.length === 0 ? (
          <div className="design-data-empty">No active profile</div>
        ) : items.map((profile) => {
          const profileExtra = profile.extra
          const profileUsed = Number(profileExtra?.upload ?? 0) + Number(profileExtra?.download ?? 0)
          const profileTotal = Number(profileExtra?.total ?? 0)
          const profilePercent = profileTotal > 0 ? Math.min(100, Math.round((profileUsed / profileTotal) * 100)) : 0
          const [profileUsedValue, profileUsedUnit] = parseTraffic(profileUsed)
          const [profileTotalValue, profileTotalUnit] = parseTraffic(profileTotal)
          return (
            <div className="sub-item" key={profile.uid}>
              <div className="sub-brand"><span className="custom-icon">✦</span><span className="sub-name">{profile.name || profile.file || profile.uid}</span></div>
              <div className="sub-usage">{profileTotal > 0 ? `${profileUsedValue} ${profileUsedUnit} / ${profileTotalValue} ${profileTotalUnit}` : '--'}</div>
              <div className="sub-prog-wrap"><div className="sub-prog-bar" style={{ width: `${profilePercent}%` }} /></div>
              <div className="sub-percent">{profileTotal > 0 ? `${profilePercent}%` : '--'}</div>
              <div className="sub-reset">{formatDate(profileExtra?.expire)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const CurrentNodeCard = () => {
  const { proxies } = useProxiesData()
  const { refreshProxy } = useAppRefreshers()
  const [groupName, setGroupName] = useState<string>('')
  const proxyModel = useMemo(
    () => buildDashboardProxyModel(proxies, groupName),
    [groupName, proxies],
  )
  const { groups, selectedGroup: activeGroup, nodes, selectedNode } = proxyModel
  const [changing, setChanging] = useState(false)
  const { changeProxyVerified } = useProxySelection({
    onSuccess: () => void refreshProxy(),
  })
  const { data: ipInfo } = useQuery({
    queryKey: ['cv_ip_info_cache'],
    queryFn: getIpInfo,
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const onNodeChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextNode = event.target.value
    if (!activeGroup || !nextNode || nextNode === activeGroup.now) return
    setChanging(true)
    try {
      await changeProxyVerified(activeGroup.name, nextNode, activeGroup.now)
      await refreshProxy()
      showNotice.success('Proxy selection verified.')
    } catch (error) {
      await refreshProxy()
      showNotice.error(error)
    } finally {
      setChanging(false)
    }
  }

  const copyIp = async () => {
    if (!ipInfo?.ip) return
    await navigator.clipboard?.writeText(ipInfo.ip).catch(() => undefined)
    showNotice.info('Exit IP copied.')
  }

  return (
    <section className="card card-node">
      <div className="card-header"><div className="card-title-group"><span className="node-live-dot" /><span className="card-title">当前节点</span></div><span className="badge-status-connected">{selectedNode ? '已选择' : 'No proxy available'}</span></div>
      <div className="active-node-box">
        <div className="node-text">
          <div className="node-main-name">{selectedNode?.name ?? 'No proxy available'}</div>
          <div className="node-tags"><span className="tag-protocol">{selectedNode?.type ?? '--'}</span><span className="tag-ping">{selectedNode?.delay === null || selectedNode === undefined ? '--' : `${selectedNode.delay} ms`}</span></div>
        </div>
      </div>
      <div className="proxy-selectors">
        <label className="select-group"><span className="select-label">代理组</span><select value={activeGroup?.name ?? ''} onChange={(event) => setGroupName(event.target.value)}><option value="">No proxy available</option>{groups.map((group) => <option key={group.name} value={group.name}>{group.name}</option>)}</select></label>
        <label className="select-group"><span className="select-label">节点</span><select value={activeGroup?.now ?? ''} disabled={!isSelectableGroup(activeGroup) || changing || nodes.length === 0} onChange={(event) => void onNodeChange(event)}><option value="">{nodes.length === 0 ? 'No proxy available' : 'Select proxy'}</option>{nodes.map((node) => <option key={node.name} value={node.name}>{node.name}{node.delay === null ? '' : ` (${node.delay} ms)`}</option>)}</select></label>
      </div>
      <div className="exit-ip-section"><div className="exit-ip-label">出口 IP 信息</div><button className="exit-ip-card" type="button" onClick={() => void copyIp()}><span className="ip-address">{ipInfo?.ip ?? '--'}</span><span className="ip-location">{[ipInfo?.city, ipInfo?.region, ipInfo?.country].filter(Boolean).join(', ') || 'Unavailable'}</span></button></div>
    </section>
  )
}

const NetworkControlsCard = () => {
  const { clashConfig } = useClashConfigData()
  const { refreshClashConfig } = useAppRefreshers()
  const { indicator: systemProxyEnabled, toggleSystemProxy } = useSystemProxyState()
  const { verge, patchVerge } = useVerge()
  const { isTunModeAvailable } = useSystemState()
  const [updating, setUpdating] = useState(false)
  const mode = String(clashConfig?.mode ?? 'rule').toLowerCase()

  const updateMode = async (nextMode: string) => {
    if (nextMode === mode) return
    setUpdating(true)
    try {
      await patchClashMode(nextMode)
      await refreshClashConfig()
    } catch (error) {
      await refreshClashConfig()
      showNotice.error(error)
    } finally {
      setUpdating(false)
    }
  }

  const updateTun = async (enabled: boolean) => {
    if (enabled && !isTunModeAvailable) {
      showNotice.error('TUN is unavailable: install or start the service first.')
      return
    }
    setUpdating(true)
    try {
      await patchVerge({ enable_tun_mode: enabled })
    } catch (error) {
      showNotice.error(error)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <section className="card card-settings-mode">
      <div className="settings-subcard"><div className="subcard-header"><span className="subcard-title">网络设置</span></div><div className="settings-list">
        <label className="setting-row"><span className="setting-info"><span className="setting-name">系统代理</span><span className="setting-desc">状态来自 Windows 系统代理</span></span><input type="checkbox" checked={systemProxyEnabled} disabled={updating} onChange={(event) => void toggleSystemProxy(event.target.checked).catch(showNotice.error)} /></label>
        <label className="setting-row"><span className="setting-info"><span className="setting-name">虚拟网卡模式</span><span className="setting-desc">{isTunModeAvailable ? 'TUN 模式' : 'Unavailable'}</span></span><input type="checkbox" checked={Boolean(verge?.enable_tun_mode)} disabled={updating || !isTunModeAvailable} onChange={(event) => void updateTun(event.target.checked)} /></label>
      </div></div>
      <div className="subcard-divider" />
      <div className="mode-subcard"><div className="subcard-header"><span className="subcard-title">代理模式</span></div><div className="segmented-control">{['rule', 'global', 'direct'].map((item) => <button key={item} className={mode === item ? 'seg-btn active' : 'seg-btn'} type="button" disabled={updating} onClick={() => void updateMode(item)}>{item === 'rule' ? '规则' : item === 'global' ? '全局' : '直连'}</button>)}</div></div>
    </section>
  )
}

const ConnectionCard = () => {
  const { response: { data } } = useConnectionSummaryData()
  return <section className="card card-status"><div className="card-header"><span className="card-title">连接状态</span></div><div className="status-grid"><div className="status-box"><span className="status-box-label">活跃连接</span><span className="status-val">{data.activeConnectionCount}</span></div><div className="status-box"><span className="status-box-label">内核占用</span><span className="status-val">--</span></div></div></section>
}

const HomeDashboard = () => (
  <main className="design-dashboard" aria-label="Dashboard">
    <SubscriptionCard />
    <CurrentNodeCard />
    <NetworkControlsCard />
    <TrafficChart />
    <ConnectionCard />
    <footer className="footer-bar"><span>互联网应该是开放的，世界应该是互联的。</span><span>Clash Verge v2.5.2</span></footer>
  </main>
)

export const RecoveredDesignShell = ({ children, isHome }: { children: ReactNode; isHome: boolean }) => {
  const { toggleMaximize } = useWindowControls()
  const themeMode = useThemeMode()
  return (
    <div className={`design-app ${isHome ? 'home-mode' : 'route-mode'}`} data-theme={themeMode} data-design-theme={themeMode}>
      <div className="viewport-wrapper"><div className="window-shell">
        <StarField />
        <DesignHeader />
        <DesignSidebar />
        <div className="design-shell-drag-region" data-tauri-drag-region="true" onDoubleClick={() => void toggleMaximize()} />
        {isHome ? <HomeDashboard /> : <main className="design-route-content">{children}</main>}
      </div></div>
    </div>
  )
}
