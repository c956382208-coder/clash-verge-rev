# Runtime data provenance

| UI field | React variable / adapter | Hook or store | Service/API | Final source |
| --- | --- | --- | --- | --- |
| Profile name/count | `current`, `profiles.items` | `useProfiles` | `getProfiles` | Rust profile config |
| Subscription used/total/expiry | `current.extra` | `useProfiles` | `getProfiles` | Profile subscription metadata |
| Proxy group/current node/protocol | `selectedGroup`, `selectedNode` | `useProxiesData` | `calcuProxies` / Mihomo API | Mihomo `/proxies` |
| Provider count | `proxyProviders` | `useProxiesData` | `calcuProxyProviders` | Mihomo `/providers/proxies` |
| Latency | node `history` | `useProxiesData` | official delay manager / Mihomo API | Mihomo delay history |
| Exit IP | `ipInfo` | query cache | `getIpInfo` | External IP service, otherwise unavailable |
| Clash mode | `clashConfig.mode` | `useClashConfigData` | `getBaseConfig` | Mihomo config |
| System proxy | `indicator` | `useSystemProxyState` | `getSystemProxy` / `getAutotemProxy` | Operating-system proxy state |
| TUN | `verge.enable_tun_mode`, availability | `useVerge`, `useSystemState` | Rust Verge/service state | Verge configuration and service |
| Download/upload | `traffic` | `useTrafficData` | Mihomo traffic websocket | Mihomo runtime stream |
| Connections | `activeConnectionCount` | `useConnectionSummaryData` | Mihomo connections websocket | Mihomo runtime stream |
| Memory/core | `--` | -- | -- | Unavailable: not fabricated |

Missing traffic metadata is `--`; missing expiry is `Not provided`; missing
profile is `No active profile`; and an empty group has `No proxy available`.
