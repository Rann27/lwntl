import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { installMockApi } from './mock-api'

const screens = [
  { name: 'library', path: '/' },
  { name: 'settings', path: '/settings' },
  { name: 'series', path: '/series/series-1/settings' },
  { name: 'chapter', path: '/series/series-1/chapter/chapter-1' },
]

for (const theme of ['light', 'dark']) {
  for (const screen of screens) {
    test(`${screen.name}: ${theme} layout and accessibility`, async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await installMockApi(page, theme)
      await page.goto('/#' + screen.path)
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByText('RENDER ERROR', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath(`${screen.name}-${theme}.png`), fullPage: true })
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
      expect(errors).toEqual([])
      for (const width of [768, 375]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
        const overflow = await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth + 2)
        expect(overflow, `${screen.name} overflows at ${width}px`).toBeFalsy()
      }
    })
  }
}

test('library search, create series, and keyboard dialog dismissal', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/')
  const search = page.getByRole('textbox', { name: 'Cari series atau grup' })
  await search.fill('Apothecary')
  await expect(page.getByRole('button', { name: 'The Apothecary Diaries', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lord of the Mysteries', exact: true })).toHaveCount(0)
  await search.clear()
  const add = page.getByRole('button', { name: /tambah series/i, exact: true })
  await add.click()
  await expect(page.getByLabel('Judul Series', { exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(add).toBeFocused()
  await add.click()
  await page.getByLabel('Judul Series', { exact: true }).fill('New translation project')
  await page.getByRole('button', { name: /^buat$/i }).click()
  await expect(page.getByRole('button', { name: 'New translation project', exact: true })).toBeVisible()
})

test('series dropdown opens edit and move dialogs', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Menu series: The Apothecary Diaries' })
  await menu.click()
  await page.getByRole('menuitem', { name: /edit/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await menu.click()
  await page.getByRole('menuitem', { name: /pindah ke grup/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('settings persist theme and switch tabs by keyboard', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/#/settings')
  await page.getByRole('button', { name: /dark mode/i }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('tab', { name: 'Umum' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Provider & API' })).toHaveAttribute('data-state', 'active')
  await expect(page.getByText('Continue with ChatGPT', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Worker', exact: true }).click()
  await expect(page.getByRole('button', { name: /simpan workers/i })).toBeVisible()
})

test('topbar panels open and close by Escape', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/')
  for (const label of ['Batch aktif', 'Log worker', 'Ganti profil', 'Template prompt']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('empty library and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page, 'light', true)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /tambah series/i })).toHaveCount(2)
  await page.getByRole('button', { name: /tambah series/i }).first().click()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([])
})

for (const tab of ['Provider & API', 'Worker']) {
  for (const theme of ['light', 'dark']) {
    test(`${tab}: ${theme} accessibility`, async ({ page }) => {
      await installMockApi(page, theme)
      await page.goto('/#/settings')
      await page.getByRole('tab', { name: tab, exact: true }).click()
      await expect(page.getByRole('tabpanel')).toBeVisible()
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
    })
  }
}

for (const theme of ['light', 'dark']) {
  for (const name of ['Run agent', 'QA Scan', 'Pre-pass terms', 'Image source', 'All terms', 'Rolling memory', 'Template DOCX', 'Tambah bab']) {
    test(`${name}: ${theme} dialog controls and accessibility`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await installMockApi(page, theme)
      await page.goto('/#/series/series-1/settings')
      await page.locator('button').filter({ hasText: new RegExp(name, 'i') }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
}

test('chapter editor saves source and resizes panes by keyboard', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/#/series/series-1/chapter/chapter-1')
  const source = page.getByRole('textbox', { name: /konten raw/i })
  await source.fill('A revised source paragraph.')
  await expect(page.getByRole('button', { name: /^simpan$/i })).toBeEnabled()
  await page.getByRole('button', { name: /^simpan$/i }).click()
  await expect(page.getByRole('button', { name: /^simpan$/i })).toBeDisabled()
  await expect(source).toHaveValue('A revised source paragraph.')
  const divider = page.getByRole('separator', { name: 'Resize source and translation panes' })
  const before = Number(await divider.getAttribute('aria-valuenow'))
  await divider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(divider).toHaveAttribute('aria-valuenow', String(before + 2))
  await page.getByRole('button', { name: /^terjemahkan$/i }).click()
  await expect(page.getByRole('button', { name: /terjemahkan ulang/i })).toBeVisible()
  await page.getByRole('button', { name: /^batal$/i }).click()
})

test('nested preset dialog stays above its parent and restores focus', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Template prompt', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Preset', exact: true }).click()
  const library = page.getByRole('dialog', { name: 'Prompt preset library' })
  await expect(library).toBeVisible()
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Prompt templates' })).toBeVisible()
  await expect(library).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const theme of ['light', 'dark']) {
  test(`first-run onboarding: ${theme}`, async ({ page }) => {
    await installMockApi(page, theme)
    await page.addInitScript(() => { Reflect.get(window, '__uiFixture').config.openaiApiKey = '' })
    await page.goto('/')
    const welcome = page.getByRole('dialog', { name: 'Welcome to LWNTL' })
    await expect(welcome).toBeVisible()
    const first = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(first.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
    await welcome.getByRole('button', { name: /mulai/i }).click()
    await welcome.locator('input').fill('fixture-key')
    const second = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(second.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([])
    await welcome.getByRole('button', { name: /mulai/i }).click()
    await expect(welcome).toHaveCount(0)
  })
}

test('docx template modal: pick a template for the series', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/#/series/series-1/settings')
  await page.getByRole('button', { name: /pilih template word/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Template DOCX' })
  await expect(dialog.getByText(/mengikuti default/)).toBeVisible()
  await dialog.getByRole('button', { name: /novel a5/i }).click()
  await expect(dialog.getByText('A5', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Pakai untuk series ini' }).click()
  await expect(dialog.getByRole('button', { name: 'Dipakai series ini' })).toBeDisabled()
  await expect(dialog.getByText('Series ini memakai')).toContainText('Novel A5')
  await dialog.getByRole('button', { name: /ikuti default/i }).click()
  await expect(dialog.getByText(/mengikuti default/)).toBeVisible()
})

test('mark chapters done by copying the raw text', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/#/series/series-1/settings')
  // single chapter from its menu (pending, so no confirmation)
  const row = page.locator('div.group').filter({ hasText: 'Between the lines' })
  await row.hover()
  await row.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: 'Tandai selesai (salin raw)' }).click()
  await expect(page.getByText(/1 bab ditandai selesai/)).toBeVisible()
  const calls = await page.evaluate(() => (window as any).__uiFixture.calls.filter((c: any) => c.method === 'mark_chapters_raw_done'))
  expect(calls[0].args[1]).toEqual(['chapter-5'])

  // several chapters in select mode; one is already translated, so a confirm appears
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /^pilih$/i }).click()
  await page.getByText('A quiet morning').click()
  await page.getByText('The next journey').click()
  await page.getByRole('button', { name: /salin raw/i }).click()
  await expect(page.getByText(/2 bab ditandai selesai/)).toBeVisible()
})

test('glossary delete confirms without a countdown, chapter delete keeps it', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/#/series/series-1/settings')
  await page.getByRole('button', { name: 'Hapus 薬屋' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm deletion' })
  await expect(dialog.getByRole('button', { name: 'Hapus', exact: true })).toBeEnabled({ timeout: 300 })
  await dialog.getByRole('button', { name: 'Batal' }).click()

  const row = page.locator('div.group').filter({ hasText: 'The next journey' })
  await row.hover()
  await row.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: 'Hapus' }).click()
  await expect(page.getByRole('dialog', { name: 'Confirm deletion' }).getByRole('button', { name: 'Hapus', exact: true })).toBeDisabled()
})

test('all terms: grouped inconsistencies ignore other terms\' names and can be unified or accepted', async ({ page }) => {
  await installMockApi(page)
  await page.addInitScript(() => {
    const w = window as any, fx = w.__uiFixture
    const glossary = [
      { id: 'g1', sourceTerm: '薬屋', translatedTerm: 'Apoteker', notes: '', aliases: [] },
      { id: 'g2', sourceTerm: 'ルナ', translatedTerm: 'Runa', notes: '', aliases: [] },
    ]
    fx.chapters[0].translatedContent = 'Apoteker itu menyapa Runa.'
    fx.chapters[0].glossaryUpdates = { entries: [{ sourceTerm: '薬屋', translatedTerm: 'Apoteker', notes: '' }, { sourceTerm: 'るなっち', translatedTerm: 'Runa', notes: 'nama panggilan' }] }
    fx.chapters[1].translatedContent = 'Toko obat itu sepi. Runa-chi tersenyum.'
    fx.chapters[1].glossaryUpdates = { entries: [{ sourceTerm: '薬屋', translatedTerm: 'Toko obat', notes: '' }, { sourceTerm: 'るなっち', translatedTerm: 'Runa-chi', notes: '' }] }
    const base = w.pywebview.api
    w.pywebview.api = new Proxy({}, { get: (_t, name: string) => name === 'get_glossary' ? async () => glossary : base[name] })
  })
  await page.goto('/#/series/series-1/settings')
  await page.locator('button').filter({ hasText: /all terms/i }).first().click()
  const dialog = page.getByRole('dialog')
  // only 薬屋 counts: "Runa" for the nickname is the heroine's own name, not a rendering
  await expect(dialog.getByText('1 inconsistency')).toBeVisible()
  await dialog.locator('button').filter({ hasText: /inconsistent/i }).first().click()
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await expect(dialog.getByText('Glossary', { exact: true })).toBeVisible()

  page.once('dialog', d => d.accept())
  await dialog.getByRole('button', { name: 'Samakan ke "Apoteker"' }).click()
  const call = await page.evaluate(() => (window as any).__uiFixture.calls.find((c: any) => c.method === 'unify_term_variants'))
  expect(call.args.slice(1)).toEqual(['薬屋', 'Apoteker', ['Toko obat']])

  await dialog.getByRole('button', { name: 'Abaikan' }).click()
  await expect(dialog.getByText(/No inconsistencies found/i)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /薬屋/ })).toBeVisible()
})

test('library loads even when the pywebview bridge binds its methods late', async ({ page }) => {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await installMockApi(page)
  // pywebview creates `api: {}` first and fills in the methods afterwards.
  await page.addInitScript(() => {
    const w = window as any
    const real = w.pywebview.api
    w.pywebview.api = {}
    setTimeout(() => {
      w.pywebview.api = real
      window.dispatchEvent(new CustomEvent('pywebviewready'))
    }, 800)
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'The Apothecary Diaries', exact: true })).toBeVisible()
  await expect(page.getByText('Gagal memuat series')).toHaveCount(0)
  // the app's own start-up (config, profiles) must not have failed either
  expect(errors.filter(e => e.includes('Failed to initialize'))).toEqual([])
  await page.getByRole('button', { name: 'Muat ulang daftar' }).click()
  await expect(page.getByRole('button', { name: 'The Apothecary Diaries', exact: true })).toBeVisible()
})

test('chapter list and library cards follow translation events live', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/#/series/series-1/settings')
  const row = page.locator('div.group').filter({ hasText: 'Between the lines' })
  await expect(row.locator('[title="Menunggu"]')).toHaveCount(1)

  // the backend marks the chapter processing, then tells the UI
  await page.evaluate(() => {
    const w = window as any
    w.__uiFixture.chapters.find((c: any) => c.id === 'chapter-5').status = 'processing'
    w.onTranslationStatus({ status: 'processing', seriesId: 'series-1', chapterId: 'chapter-5' })
  })
  await expect(row.locator('[title="Memproses"]')).toHaveCount(1)

  await page.evaluate(() => {
    const w = window as any
    w.__uiFixture.chapters.find((c: any) => c.id === 'chapter-5').status = 'done'
    w.onTranslationDone({ status: 'done', seriesId: 'series-1', chapterId: 'chapter-5', translation: 'x', iterations: 1 })
  })
  await expect(row.locator('[title="Selesai"]')).toHaveCount(1)

  // the library card's progress follows without reloading
  await page.goto('/')
  const card = page.locator('[data-slot="card"]').filter({ hasText: 'The Apothecary Diaries' })
  await expect(card.getByText('4 / 6 bab')).toBeVisible()
  await page.evaluate(() => {
    const w = window as any
    w.__uiFixture.chapters.find((c: any) => c.id === 'chapter-5').status = 'done'
    w.onBatchStatus({ status: 'translating', seriesId: 'series-1', completed: 1, total: 2 })
  })
  await expect(card.getByText('5 / 6 bab')).toBeVisible()
})
