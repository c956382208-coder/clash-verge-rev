import {
  BoltRounded,
  CloudQueueRounded,
  DataUsageRounded,
  HubRounded,
  LinkRounded,
  RouterRounded,
  SettingsRounded,
  SpeedRounded,
  TravelExploreRounded,
} from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ClashModeCard } from '@/components/home/clash-mode-card'
import { CurrentProxyCard } from '@/components/home/current-proxy-card'
import { EnhancedTrafficStats } from '@/components/home/enhanced-traffic-stats'
import { HomeProfileCard } from '@/components/home/home-profile-card'
import { IpInfoCard } from '@/components/home/ip-info-card'
import ProxyControlSwitches from '@/components/shared/proxy-control-switches'
import { useConnectionSummaryData } from '@/hooks/use-connection-data'
import { useProfiles } from '@/hooks/use-profiles'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useTrafficData } from '@/hooks/use-traffic-data'
import {
  useClashConfigData,
  useCoreDataStatus,
  useProxiesData,
} from '@/providers/app-data-context'
import parseTraffic from '@/utils/parse-traffic'

import '@/assets/styles/custom-dashboard.scss'

interface DashboardPanelProps {
  eyebrow?: string
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

const DashboardPanel = ({
  eyebrow,
  title,
  icon,
  action,
  children,
  className = '',
}: DashboardPanelProps) => (
  <Box className={`dashboard-panel ${className}`}>
    <Stack
      className="dashboard-panel__heading"
      direction="row"
      spacing={2}
      sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        {icon && <Box className="dashboard-panel__icon">{icon}</Box>}
        <Box>
          {eyebrow && (
            <Typography className="dashboard-panel__eyebrow">
              {eyebrow}
            </Typography>
          )}
          <Typography className="dashboard-panel__title">{title}</Typography>
        </Box>
      </Stack>
      {action}
    </Stack>
    <Box className="dashboard-panel__body">{children}</Box>
  </Box>
)

interface LiveMetricProps {
  label: string
  value: string | number
  unit?: string
  icon: ReactNode
  tone?: 'violet' | 'cyan' | 'mint' | 'amber'
}

const LiveMetric = ({
  label,
  value,
  unit,
  icon,
  tone = 'violet',
}: LiveMetricProps) => (
  <Box className={`dashboard-metric dashboard-metric--${tone}`}>
    <Box className="dashboard-metric__icon">{icon}</Box>
    <Box>
      <Typography className="dashboard-metric__label">{label}</Typography>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline' }}>
        <Typography className="dashboard-metric__value">{value}</Typography>
        {unit && <Typography className="dashboard-metric__unit">{unit}</Typography>}
      </Stack>
    </Box>
  </Box>
)

const proxyGroupCount = (proxies: unknown) => {
  if (!proxies || typeof proxies !== 'object') return 0

  return Object.values(proxies as Record<string, unknown>).filter(
    (proxy) =>
      typeof proxy === 'object' &&
      proxy !== null &&
      Array.isArray((proxy as { all?: unknown }).all),
  ).length
}

/**
 * The redesigned home screen deliberately delegates control logic to the
 * established components and hooks.  It only arranges their real state into
 * the dashboard visual language.
 */
export const CustomDashboard = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { current, mutateProfiles } = useProfiles()
  const { proxies, isProxiesPending } = useProxiesData()
  const { clashConfig, isClashConfigPending } = useClashConfigData()
  const { isCoreDataPending } = useCoreDataStatus()
  const { indicator: systemProxyEnabled } = useSystemProxyState()
  const { isTunModeAvailable } = useSystemState()
  const {
    response: { data: traffic },
  } = useTrafficData()
  const {
    response: { data: connectionSummary },
  } = useConnectionSummaryData()

  const [upload, uploadUnit] = parseTraffic(traffic?.up)
  const [download, downloadUnit] = parseTraffic(traffic?.down)
  const groups = useMemo(() => proxyGroupCount(proxies), [proxies])
  const mode = clashConfig?.mode?.toUpperCase() ?? '--'
  const coreStatus = clashConfig
    ? 'Core online'
    : isCoreDataPending || isClashConfigPending
      ? 'Connecting to core'
      : 'Core unavailable'
  const profileName = current?.name || current?.file || 'No active profile'

  return (
    <Box className="custom-dashboard">
      <Box className="custom-dashboard__hero">
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography className="custom-dashboard__kicker">
              CLASH VERGE CUSTOM
            </Typography>
            <Chip
              className="custom-dashboard__status"
              icon={<BoltRounded />}
              label={coreStatus}
              size="small"
            />
          </Stack>
          <Typography component="h1" className="custom-dashboard__title">
            Your network, at a glance.
          </Typography>
          <Typography className="custom-dashboard__subtitle">
            Live Mihomo state is shown here. Settings and routing continue to
            use the upstream Clash Verge implementation.
          </Typography>
        </Box>
        <Stack
          className="custom-dashboard__hero-actions"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
        >
          <Button
            variant="outlined"
            startIcon={<HubRounded />}
            onClick={() => navigate('/proxies')}
          >
            Proxy groups
          </Button>
          <Button
            variant="contained"
            startIcon={<SettingsRounded />}
            onClick={() => navigate('/settings')}
          >
            Settings
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={1.5} className="custom-dashboard__grid">
        <Grid size={{ xs: 12, md: 7 }}>
          <DashboardPanel
            eyebrow="ACTIVE SUBSCRIPTION"
            title={profileName}
            icon={<CloudQueueRounded />}
            action={
              <Button size="small" onClick={() => navigate('/profile')}>
                Manage profiles
              </Button>
            }
          >
            <HomeProfileCard
              current={current}
              onProfileUpdated={mutateProfiles}
            />
          </DashboardPanel>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <DashboardPanel
            eyebrow="RUNTIME"
            title="Network state"
            icon={<RouterRounded />}
          >
            <Grid container spacing={1}>
              <Grid size={6}>
                <LiveMetric
                  label="Clash mode"
                  value={mode}
                  icon={<RouterRounded />}
                  tone="violet"
                />
              </Grid>
              <Grid size={6}>
                <LiveMetric
                  label="Proxy groups"
                  value={isProxiesPending ? '--' : groups}
                  icon={<HubRounded />}
                  tone="cyan"
                />
              </Grid>
              <Grid size={6}>
                <LiveMetric
                  label="System Proxy"
                  value={systemProxyEnabled ? 'ON' : 'OFF'}
                  icon={<TravelExploreRounded />}
                  tone={systemProxyEnabled ? 'mint' : 'amber'}
                />
              </Grid>
              <Grid size={6}>
                <LiveMetric
                  label="TUN control"
                  value={isTunModeAvailable ? 'READY' : 'UNAVAILABLE'}
                  icon={<LinkRounded />}
                  tone={isTunModeAvailable ? 'mint' : 'amber'}
                />
              </Grid>
            </Grid>
          </DashboardPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <DashboardPanel
            eyebrow="PROXY CONTROL"
            title="Current proxy & node selection"
            icon={<HubRounded />}
            action={
              <Button size="small" onClick={() => navigate('/proxies')}>
                Open all nodes
              </Button>
            }
          >
            <CurrentProxyCard />
          </DashboardPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <DashboardPanel
            eyebrow="SYSTEM ROUTING"
            title="System Proxy & TUN"
            icon={<TravelExploreRounded />}
            className="dashboard-panel--controls"
          >
            <Box className="dashboard-control-list">
              <ProxyControlSwitches
                label={t('settings.sections.system.toggles.systemProxy')}
              />
              <ProxyControlSwitches
                label={t('settings.sections.system.toggles.tunMode')}
              />
            </Box>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="ROUTING MODE"
            title="Clash Mode"
            icon={<RouterRounded />}
            className="dashboard-panel--mode"
          >
            <ClashModeCard />
          </DashboardPanel>
        </Grid>

        <Grid size={12}>
          <DashboardPanel
            eyebrow="REAL-TIME STREAM"
            title="Traffic & connections"
            icon={<DataUsageRounded />}
            action={
              <Button size="small" onClick={() => navigate('/connections')}>
                Inspect connections
              </Button>
            }
          >
            <Grid container spacing={1} className="dashboard-quick-stats">
              <Grid size={{ xs: 6, md: 3 }}>
                <LiveMetric
                  label="Upload"
                  value={upload}
                  unit={`${uploadUnit}/s`}
                  icon={<SpeedRounded />}
                  tone="violet"
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <LiveMetric
                  label="Download"
                  value={download}
                  unit={`${downloadUnit}/s`}
                  icon={<SpeedRounded />}
                  tone="cyan"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box className="dashboard-connections">
                  <LinkRounded />
                  <Box>
                    <Typography className="dashboard-metric__label">
                      Active connections
                    </Typography>
                    <Typography className="dashboard-connections__value">
                      {connectionSummary?.activeConnectionCount ?? '--'}
                    </Typography>
                  </Box>
                  <Typography className="dashboard-connections__hint">
                    Live connection WebSocket
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            <EnhancedTrafficStats />
          </DashboardPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardPanel
            eyebrow="NETWORK IDENTITY"
            title="IP information"
            icon={<TravelExploreRounded />}
          >
            <IpInfoCard />
          </DashboardPanel>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardPanel
            eyebrow="QUICK ACCESS"
            title="Keep the full Clash Verge toolkit"
            icon={<BoltRounded />}
          >
            <Stack className="dashboard-shortcuts" spacing={1}>
              <Button onClick={() => navigate('/connections')}>
                Connections — inspect and close real Mihomo connections
              </Button>
              <Button onClick={() => navigate('/rules')}>
                Rules — inspect the active rule chain
              </Button>
              <Button onClick={() => navigate('/logs')}>
                Logs — view Clash Verge and core diagnostics
              </Button>
            </Stack>
          </DashboardPanel>
        </Grid>
      </Grid>
    </Box>
  )
}
