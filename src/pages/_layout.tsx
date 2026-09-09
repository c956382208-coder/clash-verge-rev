import { Box, ThemeProvider } from '@mui/material'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { BaseErrorBoundary, BaseLoading } from '@/components/base'
import { NoticeManager } from '@/components/layout/notice-manager'
import { RecoveredDesignShell } from '@/components/layout/recovered-design-shell'
import { WindowResizeHandles } from '@/components/layout/window-controller'
import { useI18n } from '@/hooks/use-i18n'
import { useVerge } from '@/hooks/use-verge'
import { useVisibility } from '@/hooks/use-visibility'

import { useCustomTheme, useLayoutEvents, useLoadingOverlay } from './_layout/hooks'
import { handleNoticeMessage } from './_layout/utils'
import { preloadLogsPage, preloadNavigationRoutes } from './_navigation'

import 'dayjs/locale/ru'
import 'dayjs/locale/zh-cn'

const LogsPage = lazy(() => preloadLogsPage())

dayjs.extend(relativeTime)

const Layout = () => {
  const { t } = useTranslation()
  const { theme } = useCustomTheme()
  const { verge } = useVerge()
  const { language } = verge ?? {}
  const { switchLanguage } = useI18n()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageVisible = useVisibility()
  const themeReady = useMemo(() => Boolean(theme), [theme])
  const isHome = pathname === '/'

  useLoadingOverlay(themeReady)

  useEffect(() => {
    if (!themeReady || !pageVisible) return
    const controller = new AbortController()
    void preloadNavigationRoutes(controller.signal)
    return () => controller.abort()
  }, [pageVisible, themeReady])

  useEffect(() => {
    if (language) {
      dayjs.locale(language === 'zh' ? 'zh-cn' : language)
      switchLanguage(language)
    }
  }, [language, switchLanguage])

  const handleNotice = useCallback((payload: [string, string]) => {
    const [status, message] = payload
    try {
      handleNoticeMessage(status, message, t, navigate)
    } catch (error) {
      console.error('[通知处理] 失败:', error)
    }
  }, [navigate, t])

  useLayoutEvents(handleNotice)

  if (!themeReady) {
    return <div style={{ width: '100vw', height: '100vh', background: '#03081b' }} />
  }

  return (
    <ThemeProvider theme={theme}>
      <NoticeManager position={verge?.notice_position} />
      <WindowResizeHandles />
      <RecoveredDesignShell isHome={isHome}>
        {isHome ? null : (
          <BaseErrorBoundary>
            <Outlet />
            {pathname === '/logs' && (
              <Suspense
                fallback={
                  <Box sx={{ display: 'flex', minHeight: 260, alignItems: 'center', justifyContent: 'center' }}>
                    <BaseLoading />
                  </Box>
                }
              >
                <LogsPage />
              </Suspense>
            )}
          </BaseErrorBoundary>
        )}
      </RecoveredDesignShell>
    </ThemeProvider>
  )
}

export default Layout
