# Responsive Layout Specification

The dashboard uses 1024 x 683 as the parity baseline. It is a real responsive
application surface, not a scaled artboard. `--header-height`,
`--sidebar-width`, `--content-gap`, `--shell-padding`, and `--footer-height`
are the shell layout contract for both the dashboard and routed pages.

| Range | Sidebar and header | Dashboard grid | Content and footer |
| --- | --- | --- | --- |
| Compact: 900-1023 px | 142 px sidebar; slogan is hidden before it can collide with tools; search clamps to available width. | Two columns; node/status may span beside the primary stack. | Cards use bounded profile scrolling; routed content has one vertical scroll area. |
| Standard: 1024-1439 px | Exact baseline sidebar/header dimensions at 1024 x 683. | Primary 1.8fr column plus 1fr auxiliary column. | Dashboard footer occupies normal grid flow below cards. |
| Wide: 1440-1919 px | Sidebar remains fixed; header expands and search gains a capped width. | Same two-column information hierarchy with larger, bounded gaps. | Cards grow until their content-friendly limits; typography does not scale freely. |
| Ultra-wide: 1920 px and above | Fixed sidebar, full-width header. | Same information hierarchy with a centered readable dashboard max width. | Extra width becomes surrounding breathing room rather than elongated cards. |

At all ranges, CSS Grid/Flexbox controls layout; no global transform scaling,
viewport-width arithmetic, or JavaScript resize state is used for layout.
Windows/WebView2 handles display scale. Fixed pixel controls remain only where
they guarantee accessible hit targets; text and spacing use rem/clamp/minmax.
