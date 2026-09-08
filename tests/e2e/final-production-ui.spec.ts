import { expect, test, type Page } from '@playwright/test';

async function answerText(page: Page, value: string) {
  await page.getByLabel('Your answer').fill(value);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
}

async function reachObjectSelection(page: Page) {
  await page.goto('/visual-qa/experience');
  await expect(page.getByText('01 / 07')).toBeVisible();
  await answerText(page, 'The Master and Margarita');
  await answerText(page, 'a quiet cabin above a valley');
  await page.getByLabel('4 a.m.').check();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await answerText(page, 'quiet does not mean uncertain');
  await answerText(page, 'a song that feels older than it is');
  await answerText(page, 'literal portraits');
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.getByRole('button', { name: 'UNLOCK FORM' }).click();
  await expect(page.getByRole('heading', { name: 'Pick the shape your issue lives on.' })).toBeVisible();
}

function rgbEquals(value: string, r: number, g: number, b: number) {
  return value === `rgb(${r}, ${g}, ${b})` || value === `rgba(${r}, ${g}, ${b}, 1)`;
}

test('approved homepage stays cream, sparse, ordered, and overflow-free at every acceptance width', async ({ page }) => {
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width <= 390 ? 800 : 900 });
    await page.goto('/');

    const metrics = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      headerHeight: document.querySelector('header')?.getBoundingClientRect().height ?? 0,
      ledgerCount: document.querySelectorAll('[data-issue-ledger]').length,
    }));
    expect(rgbEquals(metrics.background, 243, 238, 230)).toBe(true);
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.headerHeight).toBe(width <= 720 ? 58 : 64);
    expect(metrics.ledgerCount).toBe(0);

    const orderedText = ['questions are enough.', 'design.', 'exists once.', 'HIDDEN', '1 / 1', 'AVAILABLE', 'BEGIN.'];
    const body = await page.locator('body').innerText();
    let cursor = -1;
    for (const phrase of orderedText) {
      const next = body.indexOf(phrase, cursor + 1);
      expect(next, `${phrase} should appear after the previous scene at ${width}px`).toBeGreaterThan(cursor);
      cursor = next;
    }
  }
});

test('approved object gallery keeps exact geometry, loaded studies, and mode cycling without card growth', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reachObjectSelection(page);

  const cards = page.locator('[data-object-card]');
  await expect(cards).toHaveCount(3);
  const desktop = await cards.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const img = node.querySelector('img') as HTMLImageElement | null;
    return { width: rect.width, height: rect.height, src: img?.getAttribute('src') ?? '', naturalWidth: img?.naturalWidth ?? 0 };
  }));
  expect(desktop.every((item) => Math.abs(item.height - 380) <= 1)).toBe(true);
  expect(Math.max(...desktop.map((item) => item.width)) - Math.min(...desktop.map((item) => item.width))).toBeLessThanOrEqual(1);
  expect(desktop.every((item) => item.naturalWidth > 0)).toBe(true);
  expect(desktop.map((item) => item.src)).toEqual([
    '/assets/issued-once/asset-form-tee.jpg',
    '/assets/issued-once/asset-form-cap.jpg',
    '/assets/issued-once/asset-form-tote.jpg',
  ]);

  const tee = page.getByRole('radio', { name: 'TEE' });
  const before = await cards.nth(0).boundingBox();
  await tee.click();
  const after = await cards.nth(0).boundingBox();
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  await expect(cards.nth(0)).toHaveAttribute('data-mode', 'FORM');

  await tee.click();
  await expect(cards.nth(0)).toHaveAttribute('data-mode', 'MATERIAL');
  await expect(cards.nth(0).locator('img')).toHaveAttribute('src', '/assets/issued-once/asset-macro-tee.jpg');
  await tee.click();
  await expect(cards.nth(0)).toHaveAttribute('data-mode', 'TECHNICAL');
  await tee.click();
  await expect(cards.nth(0)).toHaveAttribute('data-mode', 'DISPLAY');
  await tee.click();
  await expect(cards.nth(0)).toHaveAttribute('data-mode', 'FORM');

  const inactiveOpacity = Number.parseFloat(await cards.nth(1).evaluate((node) => getComputedStyle(node).opacity));
  expect(inactiveOpacity).toBeGreaterThanOrEqual(0.55);
  expect(inactiveOpacity).toBeLessThanOrEqual(0.61);
});

test('ritual ledger and object gallery hit the approved tablet and mobile breakpoints', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await reachObjectSelection(page);
  const desktopLedger = page.locator('[data-issue-ledger]');
  await expect(desktopLedger).toBeVisible();
  expect((await desktopLedger.boundingBox())?.width).toBeCloseTo(184, 0);
  const tabletCards = page.locator('[data-object-card]');
  const tabletHeights = await tabletCards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(tabletHeights.every((height) => Math.abs(height - 300) <= 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(desktopLedger).toBeHidden();
  const mobileLedger = page.locator('details').filter({ hasText: 'ISSUE / NOT YET' });
  await expect(mobileLedger).toBeVisible();
  const mobileBoxes = await tabletCards.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, top: rect.top };
  }));
  expect(mobileBoxes.every((item) => Math.abs(item.height - 240) <= 1)).toBe(true);
  expect(mobileBoxes[1].top).toBeGreaterThan(mobileBoxes[0].top + mobileBoxes[0].height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('object selection is keyboard-usable and reduced motion disables scanning and tilt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1024, height: 900 });
  await reachObjectSelection(page);
  const tee = page.getByRole('radio', { name: 'TEE' });
  await tee.focus();
  await page.keyboard.press('Space');
  await expect(tee).toBeChecked();
  const card = page.locator('[data-object-card]').first();
  const reduced = await card.evaluate((node) => {
    const img = node.querySelector('img');
    const afterAnimation = getComputedStyle(node, '::after').animationName;
    return {
      transform: img ? getComputedStyle(img).transform : '',
      animation: afterAnimation,
    };
  });
  expect(reduced.transform).toBe('none');
  expect(reduced.animation).toBe('none');
  await expect(page.getByRole('button', { name: 'LOCK FORM' })).toBeEnabled();
});

test('pre-purchase public DOM contains no generated artwork URL or hidden creative payload', async ({ page }) => {
  await reachObjectSelection(page);
  const html = await page.locator('body').evaluate((node) => node.outerHTML);
  expect(html).not.toMatch(/artworkUrl|generatedDesign|designPayload|signedArtwork|openai.*image/i);
  for (const image of await page.locator('[data-object-card] img').all()) {
    const src = await image.getAttribute('src');
    expect(src).toMatch(/^\/assets\/issued-once\/asset-(form|macro|tech|museum)-(tee|cap|tote)\.jpg$/);
  }
});

test('homepage, first-question, and merchant routes emit no browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });

  for (const path of ['/', '/begin', '/store-info', '/contact', '/terms', '/returns']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }

  expect(errors).toEqual([]);
});
