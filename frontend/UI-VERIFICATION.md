# UI rebuild verification

Verified on 13 November 2026. Scope: the four application routes, shared controls, navigation, collection cards, editor, settings, and 25 modal/panel components.

## Checks

- PASS: `npm run build`; TypeScript and production bundling complete. Route bundles are split; the largest emitted JavaScript chunk is approximately 221 kB.
- PASS: `npm run test:ui -- --reporter=line`; 35 tests pass, including WCAG AA checks with axe.
- PASS: production preview loads the collection, application settings, series settings, and chapter editor without page errors.
- PASS: the four routes fit 1440, 768, and 375 px widths in light and dark themes without main-content horizontal overflow.
- PASS: search, series creation, edit/move menus, settings tabs, theme persistence, source saving, keyboard pane resizing, onboarding, topbar panels, and nested dialog dismissal/focus.
- PASS: scoped ESLint checks for the new UI primitives, library cards, navigation, notifications, utilities, and tests.
- PASS: `git diff --check`; no whitespace errors.

The repository-wide lint command still reports 72 existing errors. Linting the corresponding sources from `HEAD` also reports 72 errors. The new UI modules and tests introduce zero lint errors.

Tests use an in-memory desktop API bridge with fixture data. They do not use personal collections or credentials, or make real translation/provider requests. Runtime model responses and native file picker integrations are outside these browser checks. Python application logic is unchanged.

## Antislop delivery gate

Evidence refers to this migration and the states covered by the checks above. Design decisions are recorded in `../DESIGN.md`.

- R-02 PASS: no em dashes remain in application component, page, or translation copy.
- R-03 PASS: responsive assertions cover four routes at three viewport widths in both themes.
- R-17 PASS: library counts and completion percentages derive from series/chapter data.
- R-18 PASS: no testimonials or customer claims were added.
- R-23 PASS: product naming and navigation destinations are retained; icons use the requested UI system; no generated image assets.
- R-24 PASS: navigation uses the four existing routes and existing provider documentation URLs.
- R-25 PASS: axe contrast checks pass across routes, provider/worker settings, tested dialogs, and onboarding in both themes.
- R-26 PASS: new controls have navigation, search, menu, dialog, or form handlers; migrated controls retain their application handlers.
- R-27 PASS: collection loading/error/empty states, disabled save states, notifications, and onboarding remain available.
- R-28 PASS: no FAQ or promotional sections were added.
- R-32 PASS: tests cover keyboard tabs, Escape dismissal, nested focus return, and editor resizing; focus rings are defined centrally.
- R-33 PASS: the implementation lives in application source and shared components; no runtime DOM/style patch is shipped.
- R-34 PASS: light/dark states are tested independently; saved settings synchronize theme attributes and the dark class.
- R-35 PASS: production build, four-route production smoke checks, and 35 browser tests provide recorded interaction coverage.
- R-36 PASS: validation reports measured build/test results; no security, customer, or runtime performance promises were added.
- R-37 PASS: the user selected a Material-inspired shadcn direction; palette, typography, radii, spacing, and motion are documented.
- R-38 PASS: fixture novels and chapters exist only in tests; production screens use the desktop API.
- R-39 PASS: tested controls have accessible names and keyboard support; language, page title, landmarks, zoom support, and reduced-motion handling are present.
- R-40 PASS: no new raster media or third-party head scripts; library SVG icons have dimensions and routes load in separate bundles.
- R-01 PASS: flat surfaces and a semantic palette replace neon treatments; no gradients or glows.
- R-04 PASS: document/language/folder/editor icons identify existing actions; the agent icon identifies the actual agent feature.
- R-06 PASS: local system typography supports offline Windows use; monospace remains for editable prompts and logs.
- R-07 PASS: no decorative grid, dot, or blueprint backgrounds.
- R-08 PASS: arrows identify navigation and language direction.
- R-09 PASS: badges represent progress, provider state, or batch counts; no promotional badges or glow treatment.
- R-10 PASS: solid surfaces replace layered translucent panels.
- R-12 PASS: borders separate normal surfaces; larger shadows identify floating menus and dialogs.
- R-13 PASS: no glow effects were added.
- R-14 PASS: repeated series cards expose the same metadata; compact folder cards represent collection hierarchy.
- R-19 PASS: motion is limited to short action feedback; the reduced-motion rule covers component animations.
- R-22 PASS: no decorative illustrations were added.
- Liveliness/dials PASS: ENERGY 1 / RHYTHM 2 / MOTION 1 are documented and reflected in the workspace.
- Liveliness/focal points PASS: creation, saving, and translation actions receive primary emphasis.
- Liveliness/spacing PASS: collection gutters differ from compact editor/settings panels.
- Liveliness/accent PASS: blue identifies primary actions and selections; status colors retain semantic meaning.
- Liveliness/identity PASS: language pairs, chapter progress, glossary, workers, and paired prose panes remain visible product concepts.
- Liveliness/design read PASS: direction was stated before implementation and recorded in the design file.
- C-1 PASS: palette, typography, icon relevance, radius, and elevation choices have written reasons.
- C-2 PASS: search and creation submit flows execute against the isolated bridge; existing application bindings are retained.
- C-3 PASS: the rebuild uses the existing product workflows without marketing/template filler.
- C-4 PASS: both themes, narrow layouts, keyboard navigation, nested dialogs, and reduced motion have regression coverage.
- C-5 PASS: no invented testimonials, statistics, or claims are included in production content.
- R-05 PASS: collection, configuration, and paired editor views have different structures serving their content.
- R-11 PASS: control, panel, dialog, and status radii use a small documented scale.
- R-15 PASS: creation, editing, saving, import, navigation, and translation controls identify their actions.
- R-16 PASS: no marketing buzzwords were added.
- R-20 PASS: the layout is organized around a novel translation workflow with glossary and model controls.
- R-21 PASS: the existing user-selectable theme is retained and tested.
- R-29 PASS: neutral surfaces and one primary accent are defined with separate semantic status tokens.
- R-30 PASS: this is a translation workspace using the requested shadcn components rather than a copied commercial site.
- R-31 PASS: major visual decisions and their purposes are recorded in the design file.

Screenshots and traces are available in the ignored `test-results/` directory after running the suite.
