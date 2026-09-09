# Recovery report

## Executive Summary

This recovery returns non-visual custom behavior to the local Clash Verge Rev
v2.5.2 baseline and replaces the raw HTML/imperative dashboard bridge with a
React presentation layer fed only by upstream profile, Mihomo proxy, traffic,
connection, and system-state hooks. The reference dashboard remains a visual
archive; it is no longer parsed, injected, or used as a runtime data source.

## Root Causes

| Blocker | Root cause | Resolution |
| --- | --- | --- |
| UI stalls | One `DesignTelemetryBridge` subscribed to every high-frequency source, scanned an HTML tree, and redrew canvases from its shell effect. | Split header/sidebar/dashboard cards and localised traffic/connections. |
| Light navigation disappeared | Light theme depended on incomplete overrides mixed with global design selectors. | Added a complete scoped dark/light token set, including sidebar text and icon tokens. |
| Fake data | Runtime imported and parsed a design HTML file containing sample subscriptions, nodes, IPs and traffic. | Removed the runtime HTML import and added a production data guard. |
| Nodes appeared only inconsistently | A brittle dashboard mapper and demo dropdown replaced the upstream view model, making node availability unrelated to the normal proxy page. | Dashboard reads `useProxiesData`/`calcuProxies` directly and has no Chain state. |
| Selection could claim success early | The prior custom shell showed success after the request without reading Mihomo's selected value. | The official selection API is retained and verified by re-reading `getProxies` before success. |
| Resize/layout defects | Absolute reference-template layout was combined with DOM mutation. | CSS Grid/Flex handles layout; JavaScript resize is confined to canvases. |

## Business Layer Restore

Restored from `master` / v2.5.2 baseline: custom development service isolation,
ports and IPC changes, TUN/system-proxy blocks, service startup changes,
prebuild sidecar shortcuts, system proxy UI modification, API/delay changes,
and port randomisation. The only business-facing addition is a narrow
post-selection readback in `useProxySelection`; it calls the official
`selectNodeForGroup` and only enables a success UI once Mihomo reports the
requested `group.now`.

## Proxy Architecture

```text
Profile config -> Mihomo runtime -> getProxies/getProxyProviders
  -> calcuProxies -> AppDataProvider/useProxiesData
  -> dashboard proxy adapter -> React node selector
  -> selectNodeForGroup -> Mihomo re-read verification -> UI refresh
```

See [proxy-runtime-flow.md](proxy-runtime-flow.md) for files, hooks, and API
ownership. Chain mode remains in the upstream proxies page and cannot suppress
normal dashboard nodes.

## Upstream Reuse

- Profiles: `useProfiles`, `get_profiles`, `updateProfile` and existing profile page.
- Proxies/providers: `calcuProxies`, `AppDataProvider`, `useProxiesData`.
- Selection: `useProxySelection`, plugin `selectNodeForGroup`, tray sync, profile selection persistence.
- Delay: official delay history, delay manager, and `delayGroup`.
- System Proxy/TUN: `useSystemProxyState`, `useSystemState`, `useVerge`, upstream Rust commands.
- Mode: `patchClashMode` followed by `refreshClashConfig`.
- Traffic/connections: existing Mihomo websocket hooks.

## Runtime Data Provenance and Fake Data Removal

The dashboard has no sample values. Empty information renders `No active
profile`, `No proxy available`, `--`, `Unavailable`, or `Not provided`.
`scripts/check-runtime-data.mjs` blocks known design subscriptions, fixed IPs,
fixed quota text, and raw design-HTML imports from runtime TypeScript paths.
The full field mapping is in [runtime-data-provenance.md](runtime-data-provenance.md).

## Node Connection, Chain, System Proxy, TUN, and Mode

Node selection sends the official request, reads Mihomo up to three times, and
only then reports verified success; a mismatch or request failure refreshes the
live proxy model and surfaces an error. System Proxy retains upstream OS-state
indicator logic. TUN displays the true service/admin availability and does not
pretend unavailable service state is enabled. Mode is always re-read after a
change. Chain does not participate in dashboard data derivation.

## Performance, Theme, and Responsive Layout

Traffic updates only `TrafficChart`; connections only `ConnectionCard`. Traffic
history is capped to 60 samples, canvas work is RAF-batched and size-observed,
and the star field uses 24 particles at 30 FPS while visible only. The shell
content disables broad backdrop blur. Scoped `[data-theme='dark']` and
`[data-theme='light']` tokens cover shell/header/sidebar/card/text/input/button
states. Layout is CSS Grid with desktop bounds from 900x600 through 2560x1440;
the executable resize sequence remains a native validation step.

All eight routes retain the persistent recovered header/sidebar: `/`,
`/proxies`, `/profile`, `/connections`, `/rules`, `/logs`, `/unlock`, and
`/settings`. Header search routes the named sections and offers live proxy-node
matches; selecting a match uses the same verified selection path.

## Tests and Local Gates

PASS:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm web:build` (production Vite build, 9.33 s final run)
- `pnpm check:runtime-data`
- `pnpm test:runtime-data`
- `pnpm test:dashboard-runtime` (empty data, Mihomo mapping, stale-selection rejection, light-token contract)
- `cargo fmt --check`
- `git diff --check`

Native Windows functional testing remains required for a real profile, node
delay/selection, system proxy, TUN, exit IP, traffic, window controls, and the
full viewport matrix. The comparison plan is in
[functional-parity-matrix.md](functional-parity-matrix.md).

## Files Changed

Key presentation files: `src/components/layout/recovered-design-shell.tsx`,
`src/components/dashboard/traffic-chart.tsx`,
`src/adapters/proxy-runtime.ts`,
`src/assets/styles/design-shell.scss`, and `src/pages/_layout.tsx`.
Business restoration is documented in [full-recovery-audit.md](full-recovery-audit.md).

## Commit

This report is committed with the recovery change; use repository `HEAD` for
the immutable commit identifier.

## Remaining Blocker

Native `cargo check` cannot complete on this machine because the active
`link.exe` is `C:\Program Files\Git\usr\bin\link.exe` (GNU coreutils), not the
MSVC linker required by the installed `x86_64-pc-windows-msvc` Rust target. It
fails before compiling project code, treating Unicode workspace paths as extra
operands. Install/select Visual Studio C++ Build Tools (MSVC `link.exe`) and
run the native Windows CI/EXE matrix; no ordinary product bug is classified as
an accepted difference.
