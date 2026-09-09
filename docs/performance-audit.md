# Performance audit

## Root cause

The old `DesignTelemetryBridge` parsed the reference HTML and ran one broad
effect over profiles, proxies, Clash config, traffic, connections, IP, theme,
and Verge state. Traffic and connection changes therefore caused DOM scans,
string signatures, and canvas work in the shell root. The star canvas also ran
unconditionally at display refresh rate; traffic canvas backing dimensions were
reset on every draw.

## Recovery

| Surface | Before | After |
| --- | --- | --- |
| Shell/Header/Sidebar | Coupled to raw-DOM telemetry effect. | Pure layout/navigation; no traffic or connection subscription. |
| Subscription and node cards | Imperative `querySelector` writes. | Typed React data from the upstream profile/proxy provider. |
| Traffic | Shell update plus canvas resize each render. | `TrafficChart` is the sole traffic subscriber, caps history at 60 samples, batches drawing in one RAF, and resizes only when `ResizeObserver` reports a real size change. |
| Connections | Shell effect depended on connection summary. | `ConnectionCard` alone subscribes to the already throttled summary external store. |
| Stars | 35 particles at an unrestricted RAF. | 24 particles at 30 FPS; paused when hidden and disabled for reduced motion. |
| Layout | Raw template absolute positioning and JS bridge. | Scoped CSS Grid/Flex responsive layout; no JavaScript resize-layout state. |
| GPU effects | Large reference blur rules could affect the shell. | Recovery scope disables backdrop blur on shell/content and preserves only local visual primitives. |

## Acceptance evidence

- `pnpm web:build`: PASS (Vite production build, 21.42 s).
- Static review confirms no traffic/connection hook in `RecoveredDesignShell`,
  `DesignHeader`, or `DesignSidebar`.
- The traffic chart testable invariant is a fixed `MAX_SAMPLES = 60` buffer and
  a single scheduled RAF.

Native CPU, continuous resize, and WebView2 frame-time measurements remain a
Windows EXE validation item because the local MSVC linker is unavailable (see
the recovery report); they are not represented as passed by this audit.
