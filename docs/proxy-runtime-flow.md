# Proxy runtime flow

```text
Active profile (useProfiles / get_profiles)
  -> Rust profile activation and Mihomo runtime config
  -> tauri-plugin-mihomo-api getProxies + getProxyProviders
  -> services/cmds.ts calcuProxies
       - merges provider proxy records
       - builds ordered groups with group.now and group.all
  -> AppDataProvider / useProxiesData
  -> Proxies page and custom dashboard adapter
  -> useProxySelection
  -> selectNodeForGroup(group, node)
  -> Mihomo /proxies current selection
  -> refetch live proxy data and verify group.now
```

## Sources and responsibilities

| Step | File / API | Responsibility |
| --- | --- | --- |
| Profile source | `src/hooks/use-profiles.ts`, `get_profiles` | Gets the actual active profile and its metadata. |
| Runtime proxies | `tauri-plugin-mihomo-api:getProxies` | Reads Mihomo proxy groups, selections, and node records. |
| Providers | `tauri-plugin-mihomo-api:getProxyProviders` | Reads provider-backed node data. |
| Normalisation | `src/services/cmds.ts:calcuProxies` | Merges provider records and exposes `groups`, `records`, and `proxies`. |
| Shared state | `src/providers/app-data-provider.tsx` | Caches and refreshes proxy data independent of Chain mode. |
| Selection | `src/hooks/use-proxy-selection.ts` | Uses the official plugin `selectNodeForGroup`, persists selection, syncs tray, and verifies the re-read selection. |
| Delay | `src/services/delay.ts`, `delayGroup` | Owns latency tests and delay history. |

Chain mode is confined to `src/pages/proxies.tsx` and
`src/components/proxy/proxy-groups.tsx`; it chooses a different proxy-page
renderer only. It must never gate `calcuProxies`, `useProxiesData`, or the
dashboard's group/node derivation.
