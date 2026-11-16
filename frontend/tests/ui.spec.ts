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
