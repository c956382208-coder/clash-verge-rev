# Final UI Product Audit

## Scope and source of truth

The visual baseline is `../clash-verge-dashboard/index.html` and its paired
`css/style.css`, at an inner window size of 1024 x 683. This audit covers the
React `DesignShell`, every routed page, the Tauri window builder, and live
Mihomo/Verge bindings. The supplied production observation (native Windows
title bar above the design header) is treated as a release blocker.

## Findings before the final pass

| Area | Finding | Resolution in this pass |
| --- | --- | --- |
| Window | The Windows builder used native decorations and 940 x 700 / 520 x 520 sizing. | Use one undecorated Tauri window on Windows, a 1024 x 683 default, and a 900 x 600 usable minimum. |
| Window controls | The design controls had a second listener that only emitted demo toasts. | Bind one real Tauri control path; errors are logged and surfaced through the app notice system. |
| Drag | A narrow overlay was marked as a drag region but did not support restore/maximize by double click. | Keep a native Tauri drag region over header whitespace and add native maximize/restore on double click. |
| Responsive layout | `transform: scale()` shrank a fixed 1024 x 683 artboard. | Remove scaling and lay out dashboard cards with CSS Grid/Flex and breakpoint tokens. |
| Dashboard data | The selected node defaulted to the first flattened proxy and selection did not call Mihomo. | Derive group/node/latency from live proxy records and send selection through the existing proxy-selection integration. |
| Profiles | A long real profile list could expand beyond the fixed card. | Keep the card bounded; its live profile list owns the only card-level scroll. |
| Traffic | The visual chart had a fixed 20-point history and only listened to the window resize event. | Retain 60 live samples and measure the chart container with `ResizeObserver`. |
| Search and notification | Search only hid subscription rows; notification was a decorative empty toast. | Search supports page navigation plus live node/profile filtering; notification opens current live status/empty state. |
| Routes | Routed content used fixed insets tied to the 1024 artboard. | Route content uses the shared responsive shell tokens and has the sole page scroll area. |
| Assets | Design-reference images were in the design asset folder. | Runtime CSS uses only `bg_clean.jpg`; reference/rendered images are not imported by the runtime bundle. |

## Intentional constraints

* The existing application-level close request handler still prevents close and
  hides the main window, preserving close-to-tray behavior.
* The existing window builder does not persist geometry: it creates and centres
  the main window with its configured defaults. This pass changes only those
  defaults and minimums; it does not add a conflicting persistence layer.
* Transparent/native shadow window modes are not enabled. An undecorated Windows
  window lets the design shell supply the visible header and surface treatment
  while avoiding platform-specific transparent-window artifacts.
* Mihomo does not provide all provider metadata, egress geo-data, or process
  CPU data through the dashboard sources. Those fields remain `--` / unavailable
  rather than inventing telemetry.
* Existing routed pages stay upstream components. The shell provides shared
  background, color, spacing, and scroll integration without rewriting their
  business behavior.

## Regression checklist used after implementation

* One title bar only; min/max/restore/close and header drag work without
  blocking search or any header control.
* No page creates a second header/sidebar; routed content is the only normal
  scroll container.
* Dashboard has no mocked profile, proxy, traffic, IP, or subscription values.
* CSS, rather than resize event state, determines the structural breakpoint.
