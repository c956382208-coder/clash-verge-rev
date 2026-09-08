import {
  HelpOutlineRounded,
  HistoryEduOutlined,
  SettingsOutlined,
} from '@mui/icons-material'
import { Box, IconButton, Tooltip } from '@mui/material'
import { useLockFn } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { BasePage } from '@/components/base'
import { CustomDashboard } from '@/components/dashboard/custom-dashboard'
import { entry_lightweight_mode, openWebUrl } from '@/services/cmds'

/**
 * Home remains a routed Clash Verge page. The custom dashboard is a React
 * composition layer; it does not introduce a standalone browser page or a
 * separate state model.
 */
const HomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toGithubDoc = useLockFn(() =>
    openWebUrl('https://clash-verge-rev.github.io/index.html'),
  )

  return (
    <BasePage
      title={t('home.page.title')}
      contentStyle={{ padding: 1.5 }}
      header={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={t('home.page.tooltips.lightweightMode')} arrow>
            <IconButton
              onClick={async () => await entry_lightweight_mode()}
              size="small"
              color="inherit"
            >
              <HistoryEduOutlined />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('home.page.tooltips.manual')} arrow>
            <IconButton onClick={toGithubDoc} size="small" color="inherit">
              <HelpOutlineRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('home.page.tooltips.settings')} arrow>
            <IconButton
              onClick={() => navigate('/settings')}
              size="small"
              color="inherit"
            >
              <SettingsOutlined />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      <CustomDashboard />
    </BasePage>
  )
}

export default HomePage
