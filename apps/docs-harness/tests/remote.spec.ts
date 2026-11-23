import { expect, type Page, test } from '@playwright/test'

const DOCS = 'http://localhost:4310'

/** Every URL the page requests from the guide's origin, in order. */
function docsRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith(DOCS)) urls.push(request.url().slice(DOCS.length))
  })
  return urls
}

const drawer = (page: Page) =>
  page.getByRole('dialog', { name: /Как это устроено|How this was built|Cómo se construyó/ })

async function openDocs(page: Page) {
  await page.getByRole('button', { name: 'Docs', exact: true }).click()
  await expect(drawer(page)).toBeVisible()
}

test('nothing is loaded from the guide before the first click, and React is not loaded twice', async ({ page }) => {
  const requests = docsRequests(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(requests).toEqual([])

  await openDocs(page)
  await page.waitForLoadState('networkidle')
  expect(requests[0]).toMatch(/^\/remote\/v1\/mf-manifest\.json\?v=\w+$/)
  expect(requests.some((url) => /\/remoteEntry-[\w-]+\.js$/.test(url))).toBe(true)
  // The remote ships fallback copies of React for hosts that do not share one; this host does, so none is fetched.
  expect(requests.filter((url) => /react/i.test(url))).toEqual([])
})

test('the drawer opens on the topic, speaks the host language and follows a change of it', async ({ page }) => {
  await page.goto('/')
  await openDocs(page)
  await expect(drawer(page).getByRole('heading', { level: 1 })).toHaveText('Как это устроено')
  await expect(page.getByTestId('events')).toContainText('ready 1.0.0')
  await expect(page.getByTestId('events')).toContainText('open {"topicId":"planner/widgets/week-grid"}')

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByTestId('events')).toContainText('language en')
  await openDocs(page)
  await expect(drawer(page).getByRole('heading', { level: 1 })).toHaveText('How this was built')
  await expect(drawer(page)).toHaveAttribute('lang', 'en')
})

test('links move the drawer, not the host page', async ({ page }) => {
  await page.goto('/')
  await openDocs(page)
  await drawer(page)
    .getByRole('link', { name: /Direct manipulation/ })
    .first()
    .click()
  await expect(drawer(page).getByRole('heading', { level: 1, name: 'Direct manipulation' })).toBeVisible()
  await expect(page.getByTestId('events')).toContainText('navigate {"chapterId":"direct-manipulation"}')
  expect(new URL(page.url()).pathname).toBe('/')

  await drawer(page).getByRole('button', { name: 'Назад' }).click()
  await expect(drawer(page).getByRole('heading', { name: 'Главы об этом экране' })).toBeVisible()
})

test('a chapter can be opened directly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Chapter 11' }).click()
  await expect(drawer(page).getByRole('heading', { level: 1, name: 'Build-time microfrontends' })).toBeVisible()
})

test('the theme follows the host page', async ({ page }) => {
  await page.goto('/')
  await openDocs(page)
  const background = () => drawer(page).evaluate((element) => getComputedStyle(element).backgroundColor)
  const light = await background()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Dark' }).click()
  await openDocs(page)
  const dark = await background()
  expect(light).toBe('rgb(237, 241, 246)')
  expect(dark).toBe('rgb(18, 23, 34)')
})

test('styles leak in neither direction', async ({ page }) => {
  await page.goto('/')
  const probe = page.getByTestId('probe')
  const look = () =>
    probe.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.outlineStyle, style.borderRadius, style.backgroundColor, style.padding, style.boxShadow].join('|')
    })
  const before = await look()
  await openDocs(page)
  expect(await look()).toBe(before)

  // The host colours every heading and paragraph red, upper-cases them and spaces the letters out.
  const heading = drawer(page).getByRole('heading', { level: 1 })
  const style = await heading.evaluate((element) => {
    const computed = getComputedStyle(element)
    return { color: computed.color, transform: computed.textTransform, spacing: computed.letterSpacing }
  })
  expect(style.color).not.toBe('rgb(200, 0, 0)')
  expect(style.transform).toBe('none')
  expect(style.spacing).toBe('normal')
})

test('keys typed in the guide do not reach the host shortcuts', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('host-input').focus()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('t')
  await expect(page.getByTestId('shortcuts')).toHaveText('shortcuts: 1')

  await openDocs(page)
  await drawer(page).getByRole('link').first().focus()
  await page.keyboard.press('t')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByTestId('shortcuts')).toHaveText('shortcuts: 1')

  await page.keyboard.press('Escape')
  await expect(drawer(page)).toBeHidden()
  await expect(page.getByTestId('events')).toContainText('close user')
})

test('an unreachable guide shows the fallback link', async ({ page }) => {
  await page.goto('/?remote=http://localhost:4399/remote/v1/mf-manifest.json&timeout=3000')
  await page.getByRole('button', { name: 'Docs', exact: true }).click()
  const fallback = page.getByTestId('fallback')
  await expect(fallback).toBeVisible()
  await expect(page.getByTestId('status')).toHaveText('status: failed')
  await expect(fallback.getByRole('link')).toHaveAttribute('href', 'http://localhost:4310/ru/chapters/first-screen/')
})
