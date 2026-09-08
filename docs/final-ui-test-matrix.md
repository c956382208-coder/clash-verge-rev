# Final UI Test Matrix

Static implementation checks and the local production web build are complete.
The native Tauri visual smoke test is blocked: `pnpm dev` cannot fetch the
pinned `clash-verge-logger` Git revision before the desktop process starts.
The matrix therefore records static/build coverage, not a claim that an
unlaunched EXE was visually verified. The native title bar and close-to-tray
behaviour were inspected in the Tauri configuration and existing Rust lifecycle
handler.

| Inner size | Header / sidebar | Home grid / cards | Footer / scrolling | Chart / modal / navigation | Status |
| --- | --- | --- | --- | --- | --- |
| 900 x 600 | Compact controls, no overlap | Two columns with bounded profile list | Routed content only scrolls | Resize-aware | PASS — static/build; native blocked |
| 1024 x 683 | Design baseline | Baseline proportions | Footer after dashboard flow | Resize-aware | PASS — static/build; native blocked |
| 1280 x 720 | Standard | Two-column hierarchy | Normal flow | Resize-aware | PASS — static/build; native blocked |
| 1366 x 768 | Standard | Two-column hierarchy | Normal flow | Resize-aware | PASS — static/build; native blocked |
| 1440 x 900 | Wide | Bounded expansion | Normal flow | Resize-aware | PASS — static/build; native blocked |
| 1600 x 900 | Wide | Bounded expansion | Normal flow | Resize-aware | PASS — static/build; native blocked |
| 1920 x 1080 | Ultra-wide | Centered readable maximum | Normal flow | Resize-aware | PASS — static/build; native blocked |
| 2560 x 1440 | Ultra-wide | Centered readable maximum | Normal flow | Resize-aware | PASS — static/build; native blocked |

For every row: open `/`, `/proxies`, `/profile`, `/connections`, `/rules`,
`/logs`, `/unlock`, and `/settings`; confirm the same shell, no duplicate
navigation, no horizontal overflow, the expected theme, and normal page scroll.
