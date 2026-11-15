# LWNTL interface

React 19, TypeScript, Vite, Tailwind CSS 4, and shadcn/ui with Radix primitives.

## Development

```sh
npm ci
npm run dev
npm run build
```

The desktop application exposes its Python API through `window.pywebview.api`. Open the application using `../run.bat` to use real application data. A standalone Vite tab waits for this bridge.

`npm run build` refreshes `dist/`, which the desktop application loads. Vite's relative asset paths are retained for PyWebView.

## Components and theme

- `src/components/ui/`: shadcn/ui components, plus the shared Radix modal surface.
- `src/lib/utils.ts`: class composition with `clsx` and `tailwind-merge`.
- `src/styles/globals.css`: light/dark tokens, application layouts, prose, and responsive rules.
- `src/index.css`: Tailwind theme aliases and animations.
- `components.json`: shadcn registry configuration; `@/` resolves to `src/`.
- `../DESIGN.md`: palette, typography, elevation, and interaction decisions.

Both `data-theme="dark"` and the `dark` class are synchronized with saved application settings. Use semantic theme tokens for new surfaces, text, status colors, and controls.

## Browser checks

```sh
npm run test:ui
```

The Playwright suite uses Edge on Windows. On other platforms, install Chromium with `npx playwright install chromium` first. Tests use an isolated in-memory Python bridge with fixture data. They do not read personal collections, API keys, or contact model providers.

The suite checks the four application routes at desktop/tablet/phone widths, both themes, provider and worker settings, first-run setup, common dialogs, nested dialog focus, collection search, series creation, editing, keyboard resizing, and WCAG AA checks through axe. Screenshots and failure traces are written to the ignored `test-results/` folder.
