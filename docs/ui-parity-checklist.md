# Clash Verge Design Shell parity checklist

Source of truth: `../clash-verge-dashboard/index.html`, `css/style.css`, `js/app.js`, and `assets/`.
The copied design DOM/CSS is rendered by `src/components/layout/design-shell.tsx`; the telemetry bridge removes demo values and hydrates the same DOM from the existing Clash Verge/Mihomo hooks.

| 原设计元素 | 当前实现 | 是否一致 | React 组件位置 | 业务数据来源 |
| --- | --- | --- | --- | --- |
| `viewport-wrapper` / `window-shell` 1024×683 | 原 class 保留，外层适配 Tauri viewport | 一致（窗口缩放时按容器约束） | `DesignShell` | Tauri viewport |
| 星空/渐变背景、`bg_clean.jpg`、stars canvas | 原 DOM/CSS/assets 直接迁移；demo canvas 脚本不再注入 | 一致（静态背景；粒子动画待 React canvas 迁移） | `DesignShell` / `style.css` | 原 `assets/bg_clean.jpg` |
| 原 `top-header` | 原 DOM/CSS 直接迁移 | 一致 | `design-shell.tsx` 静态模板 | React 事件桥 |
| Clash Verge Logo 区 | 原 SVG、brand DOM 保留 | 一致 | 静态设计模板 | 原 SVG |
| `Connect a Bigger World` | 原文案保留 | 一致 | 静态设计模板 | 常量文案 |
| `连接无界 · 探索更大的世界` | 原文案保留 | 一致 | 静态设计模板 | 常量文案 |
| `稳定 · 高速 · 安全 · 始终在线` | 原文案保留 | 一致 | 静态设计模板 | 常量文案 |
| 搜索框 | 原尺寸/class 保留，过滤真实订阅行 | 一致 | `DesignTelemetryBridge` | `profiles.items` |
| 日/月主题切换 | 原按钮/active class 保留；React 切换 `useThemeMode` 与 MUI theme | 一致（设计稿 CSS 本身没有第二套浅色调色板） | `DesignShell` / `DesignTelemetryBridge` | `useThemeMode`, `useSetThemeMode` |
| 通知按钮 | 原按钮保留，使用设计稿原 `toast-msg` 视觉反馈 | 一致 | `DesignTelemetryBridge` | React toast bridge |
| 窗口操作区域 | 原三键 DOM/CSS 保留，绑定 Tauri minimize/maximize/close | 一致 | `DesignShell` | `useWindowControls` |
| 原设计 Sidebar | 原 `nav-menu/nav-item` DOM/CSS 保留，移除上游 `the-menu` | 一致 | 静态设计模板 + `DesignShell` | React Router |
| 首页 / 代理 / 订阅 / 连接 / 规则 / 日志 / 测试 / 设置 | 原 8 个按钮保留；`测试` 映射上游 `/unlock` | 一致 | `DesignShell` | `ROUTE_BY_TAB` + Router |
| Sidebar 底部版本/运行状态 | 原 `status-pill` 保留，版本调整为当前 baseline `v2.5.2` | 一致（运行状态视觉保留） | 静态设计模板 | 当前应用 baseline |
| 总订阅卡片 | 原卡片尺寸、圆角、阴影、进度结构保留；清除 mock 行并填入当前 profile | 一致（数据为空时显示空态） | `DesignTelemetryBridge` | `useProfiles` |
| 当前节点卡片 | 原 DOM/CSS 保留；节点组/节点列表由实时 proxies 填充 | 一致（地理位置无 Mihomo 字段时显示 `--`） | `DesignTelemetryBridge` | `useProxiesData` |
| 流量/连接等卡片 | 原卡片结构与视觉保留；数值清除 mock 并绑定实时 hooks | 一致 | `DesignTelemetryBridge` | `useTrafficData`, `useConnectionSummaryData` |
| 尺寸、圆角、阴影、边框、间距、字号、颜色 | `style.css` 原值直接复制，仅增加 route overlay 适配 | 一致 | `src/assets/design-dashboard/style.css` | 设计稿 CSS |
| 原 assets | `bg_clean.jpg`、参考图和渲染图复制到 `src/assets/design-dashboard/assets` | 一致 | Vite asset pipeline | 原 assets |
| 原动画效果 | CSS hover/pulse/modal/toast 保留；stars 与 traffic canvas 用 React 绘制，未迁移 mock sparkline/telemetry | 部分一致（无假数据动画） | `style.css` + `DesignTelemetryBridge` | `useTrafficData`, `useConnectionSummaryData` |

## 外壳替换记录

- 删除 `src/components/dashboard/custom-dashboard.tsx` 和 `src/assets/styles/custom-dashboard.scss`；它们制造了不属于设计稿的 `CLASH VERGE CUSTOM` / `Your network, at a glance.` 页面。
- `src/pages/_layout.tsx` 不再渲染上游 `the-logo`、`the-menu`、`the-bar`、MUI 外壳；只保留主题、通知、窗口缩放、事件与路由能力，并挂载 `DesignShell`。
- 首页 Outlet 不再包裹 `BasePage`；设计稿完整 shell 是首页唯一视觉根。非首页路由继续复用原页面组件，并显示在设计 shell 的 content overlay 内。
- `app.js` 的 mock subscriptions/nodes/IP/Math.random telemetry 没有迁移；模板在渲染前清空这些值，bridge 只从 Clash Verge/Mihomo hooks 写入真实数据。

## 验收备注

- 本地 Gate：`pnpm typecheck`、`pnpm lint`、`vite build --emptyOutDir=false`（标准 `pnpm web:build` 在旧 `dist/assets` 被运行中的 EXE 占用时会被 Windows `EPERM` 阻断）。
- 本轮不运行 GitHub Actions Windows build；Rust/Mihomo、profiles、proxy groups、node switching、latency、traffic、connections、Clash mode、system proxy/TUN 代码保持复用。
- Windows 原生 Tauri decorations 配置保持 baseline 不变；设计稿内的三键已绑定到真实 Tauri 窗口控制，但若系统 decorations 开启，系统标题栏仍会位于 WebView 外部。
