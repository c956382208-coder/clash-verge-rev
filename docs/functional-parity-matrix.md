# Functional parity matrix

`master` (`ae69938`, Clash Verge Rev v2.5.2 baseline) remains the authority for
all business behavior. “Code gate” means the custom UI delegates to that
implementation and static/build checks pass; it does not claim a real Windows
network operation has already passed.

| Capability | Official path reused by Custom | Code gate | Native runtime validation |
| --- | --- | --- | --- |
| Load/update/activate/delete profile | `useProfiles`, profile page and Rust commands | PASS | Required with real subscription |
| Proxy groups, nodes, providers | `calcuProxies` → `AppDataProvider` → `useProxiesData` | PASS | Required after active profile |
| Proxy selection | `selectNodeForGroup`, `useProxySelection`, tray/profile persistence | PASS; re-read verification added | Required: selected node changes in Mihomo |
| Delay | Official proxy history and delay manager | PASS | Required: real delay test |
| Chain mode | Existing proxy-page-only Chain renderer | PASS; dashboard has no Chain dependency | Required: off/on/off regression |
| Clash mode | `patchClashMode`, `refreshClashConfig` | PASS | Required Rule/Global/Direct |
| System proxy | `useSystemProxyState` and upstream Rust system proxy | PASS | Required OFF → ON → OFF |
| TUN/service | `useSystemState`, `useVerge`, upstream Rust service lifecycle | PASS | Required unavailable/disabled/enabled |
| Traffic | `useTrafficData` Mihomo websocket | PASS | Required idle and active traffic |
| Connections | `useConnectionSummaryData` Mihomo websocket | PASS | Required connection count match |
| Rules/logs/settings/unlock | Existing routed pages | PASS build/type/lint | Required route click-through |
| Theme | Verge theme config plus scoped design tokens | PASS unit/static gate | Required Dark/Light repeat sequence |
| Window lifecycle | Existing `useWindowControls`; custom undecorated Windows frame | PASS build/type/lint | Required minimize/maximize/close-to-tray |
| Search | Route navigation plus live proxy-node result selection | PASS build/type/lint | Required interactive search |

## Route and viewport regression plan

The CSS grid has explicit responsive behavior from the accepted 900 x 600
minimum through 2560 x 1440. The following must be checked in the packaged
Windows application: 900x600, 1024x683, 1280x720, 1366x768, 1440x900,
1600x900, 1920x1080, and 2560x1440, including continuous drag-resize,
maximize, restore, and repeat theme switching. No native result is marked PASS
until that executable validation can run.
