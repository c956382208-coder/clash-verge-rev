# Custom UI Mapping

## Scope and source baseline

- Upstream source: Clash Verge Rev `v2.5.2` from the supplied GitHub source archive.
- Working branch: `custom-dashboard`.
- Goal: rebuild the supplied dashboard as native React and TypeScript components inside the existing application.  The static design files are a visual reference only; their mock data, timers, fake toggles, and fake connection state are not application logic.

The implementation keeps the existing page router, Tauri commands, stores, Mihomo API client, and Rust backend.  It does not embed the supplied `index.html` or execute its `app.js`.

## Application integration

| New dashboard area | Existing Clash Verge implementation | State / hook | API or Tauri command | Backend / transport | Reuse plan |
| --- | --- | --- | --- | --- | --- |
| App shell, route, and navigation | `src/pages/_routers.tsx`, `src/pages/_layout.tsx`, `src/pages/_navigation.tsx` | React Router | N/A | Tauri window | Replace the home-page content with React components while retaining the existing layout, routing, shortcuts, and page routes. |
| Home dashboard composition | `src/pages/home.tsx` | `AppDataProvider` in `src/providers/app-data-provider.tsx` | Query hooks backed by `src/services/cmds.ts` | Commands and Mihomo client | Introduce dashboard-specific TypeScript components under `src/components/dashboard/`, and compose them from `home.tsx`. |

## Functional mapping

| Dashboard function | Clash Verge original component(s) | Store / hook | API / Tauri command | Backend implementation | Planned reuse |
| --- | --- | --- | --- | --- | --- |
| Home | `src/pages/home.tsx`; `home-profile-card.tsx`, `current-proxy-card.tsx`, `proxy-tun-card.tsx`, `clash-mode-card.tsx`, `enhanced-traffic-stats.tsx`, `ip-info-card.tsx` | `useAppRefreshers`, app-data contexts | Aggregates the commands below | Existing frontend composition | Replace the visual composition only. Retain the original data sources and error/loading paths. |
| System Proxy | `src/components/shared/proxy-control-switches.tsx`, `src/components/home/proxy-tun-card.tsx` | `useSystemProxyState` (`src/hooks/use-system-proxy-state.ts`), `useSystemData`, `useVerge` | `patch_verge_config`, `get_sys_proxy`, `get_auto_proxy` | `src-tauri/src/feat/config.rs` processes `SYS_PROXY`; `src-tauri/src/core/sysopt.rs` calls Windows `sysproxy`; `src-tauri/src/cmd/network.rs` reads OS settings | Bind the dashboard switch to `toggleSystemProxy`; preserve the app/OS-state mismatch indicator. Never simulate the toggle. |
| TUN | `proxy-control-switches.tsx`, `proxy-tun-card.tsx`; settings TUN views | `useSystemState`, `useVerge` | `patch_verge_config`; service commands including `is_service_available` | `feat/config.rs`; `core/service.rs`; service IPC and Windows service lifecycle | Reuse the existing switch and availability checks. In isolated development, keep it unavailable; test it only in a dedicated, user-approved Windows test environment. |
| Clash Mode | `src/components/home/clash-mode-card.tsx` | `useClashConfigData`, `useRuntimeConfig`, `useClashMode`, `useClash` | `get_clash_config`, `get_runtime_config`, `get_clash_mode`, `patch_clash_mode` | `src-tauri/src/cmd/clash.rs`; `src-tauri/src/feat/clash.rs::change_clash_mode`, which patches Mihomo and refreshes tray/connections | Reuse the existing optimistic update with error rollback for Rule / Global / Direct mode pills. |
| Current Proxy | `src/components/home/current-proxy-card.tsx` | `useProxiesData`, `useClashConfigData`, `useProxySelection`, delay state | `get_proxies` through `tauri-plugin-mihomo-api`; `sync_tray_proxy_selection` | Mihomo API plugin; `src-tauri/src/cmd/proxy.rs`; tray sync | Display real selected proxy and group state in the dashboard hero card. |
| Proxy Groups | `src/pages/proxies.tsx`, `src/components/proxy/proxy-groups.tsx` | `useProxiesData`, proxy polling / refreshers | `calcuProxies` in `src/services/cmds.ts` | Mihomo API `getProxies`, `getProxyProviders`; profile group-order data | Use the calculated group ordering and existing proxy page as the authoritative source; dashboard gets a compact group summary / link. |
| Proxy Node Selection | Proxy group views and `current-proxy-card.tsx` | `useProxySelection` (`src/hooks/use-proxy-selection.ts`) | Mihomo `selectNodeForGroup`; `sync_tray_proxy_selection` | Mihomo API changes the active group node; Rust command refreshes tray selection | Route every dashboard selection through `selectNodeForGroup`, persist the selection as the existing hook does, and retain optional connection cleanup. |
| Latency | Proxy node views; delay controls on `current-proxy-card.tsx` | `useProxyDelayState`, `useDelayManager` | Mihomo `delayProxyByName`, provider health check | `src/services/delay.ts`; Rust `test_delay` command also exists in `cmd/clash.rs` / `feat/clash.rs` | Use the shared delay manager/cache and show pending/failure states. No random latency values. |
| Traffic WebSocket | `src/components/home/enhanced-traffic-stats.tsx` | `useTrafficData` (`src/hooks/use-traffic-data.ts`), `useMihomoWsSubscription` | `MihomoWebSocket.connect_traffic()` | Mihomo WebSocket over the running core IPC endpoint | Feed dashboard charts and total counters from the existing throttled 200 ms stream. |
| Connections | `src/pages/connections.tsx`; traffic card | `useConnectionData`, `useConnectionSummaryData` (`src/hooks/use-connection-data.ts`) | `MihomoWebSocket.connect_connections`; Mihomo connection operations | Mihomo WebSocket with 500 ms throttling; plugin supports closing connections | Use actual active-count and connection history. Keep the existing Connections page for full inspection and controls. |
| IP Information | `src/components/home/ip-info-card.tsx` | `useIPInfo` in that component | `getIpInfo` (`src/services/api.ts`) | Existing IP-service fallback list in the frontend | Reuse the existing 300-second cached lookup and its loading/error UI. Do not add a second IP source or hard-code an address. |
| Profiles / subscriptions | `src/pages/profiles.tsx`, `src/components/home/home-profile-card.tsx` | `useProfiles` (`src/hooks/use-profiles.ts`), refreshers | `get_profiles`, `patch_profiles_config`, profile update/import commands | `src-tauri/src/cmd/profile.rs`, `src-tauri/src/feat/profile.rs`, persisted profile config | Dashboard subscription card shows the real current profile and real usage / expiry metadata only. Full import, update, ordering, and deletion stay on Profiles. |
| Settings | `src/pages/settings.tsx`; `setting-system.tsx`, `setting-clash.tsx`, `setting-verge-basic.tsx`, `setting-verge-advanced.tsx` | Existing setting hooks and form state | `get_verge_config`, `patch_verge_config`, Clash config commands | `src-tauri/src/cmd/verge.rs`, `feat/config.rs`, system and core managers | Preserve Settings routes/components for detailed editing. Dashboard controls call the same commands instead of duplicating configuration forms. |
| Rules | `src/pages/rules.tsx` and rule components | Existing rules data hooks | Mihomo rules API | Mihomo API client | Retain the existing page and navigate to it from the redesigned sidebar. |
| Logs | `src/pages/logs.tsx` and log components | Existing log state | Existing log stream / commands | Tauri log integration | Retain the existing page and navigate to it from the redesigned sidebar. |
| Tray synchronisation | Proxy and mode hooks | `useProxySelection`, `useClash` | `sync_tray_proxy_selection` | `src-tauri/src/cmd/proxy.rs`, `src-tauri/src/core/tray/mod.rs` | Do not reimplement a dashboard-only state: every relevant action continues to update the native tray. |

## Dashboard design asset audit

The supplied design archive contains usable visual material in `css/style.css`, `assets/`, and layout ideas in `index.html`.  It also contains prototype-only behavior in `js/app.js`, including:

- hard-coded subscription, node, current-proxy, latency, and IP values;
- fake connected state and fake System Proxy / TUN toggles;
- `setTimeout`-based subscription refresh;
- `setInterval` and random traffic, connection, CPU, and ping values.

Only styles, non-functional markup patterns, and suitable assets may migrate.  All of the above prototype behavior is excluded from the production React implementation.

## Safe development baseline

`verge-dev` already gives the Rust application a separate data directory: `io.github.clash-verge-rev.clash-verge-rev.dev` (see `src-tauri/src/utils/dirs.rs`).  That isolates generated Verge configuration, profiles, logs, and data from the installed production application's normal data directory.

It is not sufficient on Windows by itself:

1. the original code uses the production Mihomo named pipe `\\.\pipe\verge-mihomo` even under `verge-dev`;
2. defaults for proxy and controller ports overlap the installed application;
3. startup can probe the shared Clash Verge Service and use it to start a core;
4. startup calls Windows system-proxy reconciliation, which could change the live OS proxy setting;
5. TUN and the Windows service are host-wide resources, not application-data resources.

Before running `pnpm dev`, this branch adds **development-feature-only** guards and endpoint names to ensure that a development process:

- uses a distinct Mihomo IPC pipe and ports;
- never connects to or starts the installed Clash Verge Service;
- never reconciles or changes the Windows System Proxy;
- reports TUN unavailable and rejects System Proxy / TUN enablement rather than pretending that it worked.

The implementation is intentionally confined to `verge-dev`:

- `src-tauri/src/constants.rs` provides development-only controller and proxy ports `19097`, `17897`, `17898`, and `17899`.
- `src-tauri/src/utils/dirs.rs` uses `\\.\pipe\verge-mihomo-dev` instead of the production pipe.
- `src-tauri/src/utils/resolve/mod.rs`, `core/service.rs`, and `cmd/service.rs` bypass or reject shared Clash Verge Service operations.
- `src-tauri/src/feat/config.rs` rejects System Proxy and TUN changes before they can update host-wide state.
- `src/components/shared/proxy-control-switches.tsx` disables these host-wide controls in the Vite development runtime, instead of showing a fake successful toggle.

The official prebuild script in `scripts/prebuild.mjs` was also made reproducible when sidecars already exist: it now skips an online "latest" version lookup before deciding whether a sidecar must be downloaded.  For this local baseline, the ignored `src-tauri/sidecar/` and `src-tauri/resources/` inputs were copied read-only from the installed official v2.5.2 package and SHA-256 checked against the source files.  The installed package itself was not modified.

This permits safe work on the React dashboard and real, isolated Mihomo data flows.  System Proxy and TUN cannot be proven end-to-end on this host while the production application is in use: both intentionally modify host-wide state.  Those two integration tests require a separate Windows VM / test account, or an explicit, controlled maintenance window after the user has stopped the production application and approved the host-wide change.

## Delivery gates

1. **Inspect and map** — this document and the upstream baseline commit.
2. **Safe baseline** — apply and review dev-only isolation, then install dependencies, run prebuild, and launch the isolated development app.
3. **Implement** — transform the design into React/TypeScript dashboard components, binding every displayed datum and action to the mapping above.
4. **Test and fix** — typecheck/lint/build and manually verify real core data paths; System Proxy/TUN only in the dedicated test environment described above.
