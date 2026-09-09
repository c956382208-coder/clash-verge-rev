# Full product recovery audit

## Scope and baselines

- **Functional baseline:** the repository's `master` commit `ae69938` (the
  locally established Clash Verge Rev v2.5.2 baseline).
- **Visual baseline:** `src/assets/design-dashboard/index.html` and
  `src/assets/design-dashboard/css/style.css`. They are reference material,
  not an application data source.
- **Recovery branch at audit start:** `custom-dashboard` at `0e2f448`.

The audit was completed before the recovery changes below. `master..HEAD`
contained 35 paths: the custom shell and styling, design reference assets,
documentation/CI files, and several Rust/TypeScript business-layer changes.

## Findings and recovery plan

| Area | Current implementation at audit | Upstream v2.5.2 implementation | Root cause | Recovery strategy | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Profile | `DesignTelemetryBridge` copied profile data into a parsed HTML document. | `useProfiles` reads `get_profiles`; profile page owns create/update/activate/delete. | A presentation DOM became a second, stale profile view model. | Render from `useProfiles` directly; profile mutations remain upstream. | 0/1/multiple profile empty and active-state checks. | Recovered |
| Subscription metadata | Design template supplied subscription names, quota, and expiry before the bridge replaced some fields. | `IProfileItem.extra` is the source. | Demo markup could flash or be used accidentally. | Never import template HTML at runtime; show `--`/`Not provided` for absent metadata. | Static fake-data gate and dashboard adapter checks. | Recovered |
| Proxy provider | Dashboard inferred nodes from HTML dropdowns and a hand-written mapper. | `calcuProxies` merges Mihomo `/proxies` and official provider data. | Two node models, one presentation-only. | Consume `useProxiesData` only and keep providers in the upstream provider. | Group/provider/node counts from the same object. | Recovered |
| Proxy groups and nodes | The raw-DOM shell mixed `groups`, `records`, and demo dropdowns. | `calcuProxies` creates ordered groups with live `all`, `now`, and records. | Node availability depended on a brittle DOM bridge rather than the normal proxy model. | A typed dashboard adapter derives nodes from live groups; no Chain condition exists. | Chain off/on regression and real-profile check. | Recovered |
| Node selection | The shell called `useProxySelection`, immediately displayed a success toast, and did not verify `now`. | `selectNodeForGroup` is the official selection path. | UI could claim success before Mihomo state was observed. | Retain the official selector; add post-write Mihomo selection verification before success. | Success, API failure, and mismatched-current-node rollback checks. | Recovered |
| Latency | Bridge read only the final history entry. | Official delay manager and `delayGroup` own the requests/history. | No explicit unavailable/test-in-progress semantics in dashboard. | Render the official record history only; unavailable remains `--`. | Existing proxy delay action plus dashboard display. | Recovered |
| Chain | Chain page has separate rendering, but the custom dashboard was independently derived. | `ProxyGroups` selects normal or chain renderer while shared proxy data remains outside that conditional. | Presentation path made it easy to confuse chain UI with node loading. | Dashboard never reads chain state; it always reads `useProxiesData`. | Toggle chain while dashboard proxy data remains present. | Recovered |
| Clash mode | Raw DOM button patched mode and manually toggled classes. | `patchClashMode` plus `refreshClashConfig`. | Optimistic visual class was not tied to a re-read. | Use live config as selected state and revalidate after mutation. | Rule/Global/Direct success and failure. | Recovered |
| System proxy | Custom hook added a partial rollback; custom shell directly set DOM checkbox state. | `useSystemProxyState` is the official source and mutation path. | Imperative checkbox could disagree with OS/config state. | Restore upstream business implementation; dashboard reads its indicator and only displays its result. | OFF → ON → OFF in native validation. | Recovered |
| TUN/service | Custom branch disabled service/TUN operations under `verge-dev` and disabled controls in UI. | Upstream service/status lifecycle. | Custom build behavior diverged from production semantics. | Restore upstream service, config, and control code. | Unavailable/disabled/enabled native validation. | Recovered |
| Traffic | High-frequency traffic updated the bridge effect, markup, and a second canvas renderer. | `useTrafficData` owns the real Mihomo websocket. | Full shell effect and canvas resizing on every traffic update. | Isolate traffic to `TrafficCard`; cap history at 60 and draw through one RAF/ResizeObserver. | 60-sample cap and WebSocket traffic observation. | Recovered |
| Connections | Bridge updated dashboard-wide state from connection summary. | `useConnectionSummaryData` is a throttled external store. | Connection updates forced shell work. | Subscribe inside `ConnectionCard` only. | Active count matches the connection stream. | Recovered |
| Exit IP | Shell used existing `getIpInfo` but rendered a template location as a fallback. | Existing IP service returns data or fails. | Design fallback masqueraded as runtime value. | Real result or `--`/`Unavailable` only. | Network failure displays unavailable. | Recovered |
| Theme | Custom global stylesheet suppression and design-specific light overrides competed with MUI. | `useCustomTheme` controls palette/theme setting. | Token ownership was split; light sidebar tokens were incomplete. | Scoped `.design-shell` token sets for dark/light; theme changes do not key/remount runtime data. | Dark → Light → Dark → Light visual regression. | Recovered |
| Shell and routes | A 889-line shell parsed HTML, attached many DOM listeners, and contained all dashboard state. | Layout renders persistent app providers and routed pages. | One high-churn component and non-React event lifecycle. | Split shell, header/sidebar, dashboard adapter/cards; keep routed content intact. | All eight routes, no duplicate navigation/scrollbars. | Recovered |
| Resize/window | Custom window constants/decorations were changed together with the raw shell. | Official close-to-tray/window lifecycle. | Layout was partly JS/DOM-driven and the custom header had no component boundary. | Keep only the required undecorated Windows frame; use CSS grid and real window controls. | Continuous resize and titlebar controls. | Recovered |
| Performance | Stars rendered continuously; traffic canvas resized on each draw; broad effects depended on all runtime data. | Upstream data providers are individually throttled. | Rendering and canvas work were coupled to shell render frequency. | Local cards; 30 FPS stars paused when hidden/reduced motion; canvas resizes only on observed size change. | Resize, idle, and traffic profiling. | Recovered |

## Business-layer diff disposition

The following non-presentation custom changes are not required for the design
and are restored to `master`: `scripts/prebuild.mjs`, `src/services/api.ts`,
`src/services/delay.ts`, `src/hooks/use-system-proxy-state.ts`,
`src/components/shared/proxy-control-switches.tsx`,
`src/components/setting/mods/clash-port-viewer.tsx`, and the custom changes in
`src-tauri/src/{cmd/service.rs,config/clash.rs,config/verge.rs,constants.rs,core/service.rs,feat/config.rs,feat/proxy.rs,utils/dirs.rs,utils/resolve/mod.rs}`.

`src-tauri/src/utils/resolve/window.rs` is retained only insofar as Windows
needs the undecorated custom titlebar and the 900 x 600 tested minimum. Its
close action still uses the upstream window lifecycle.

## Explicit non-goals

No production runtime reads the design template's sample subscriptions, sample
nodes, IP address, traffic totals, or notification text. The reference files
remain archived so visual comparisons are reproducible.
