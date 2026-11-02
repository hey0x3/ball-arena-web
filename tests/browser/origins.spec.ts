import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

test('origin filters compose with search and the contender selector stays above Run', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const origins = page.getByRole('group', { name: 'Character origins', exact: true });
  await expect(origins.getByRole('button', { name: 'Ball Arena 9', exact: true })).toBeVisible();
  await origins.getByRole('button', { name: 'League of Legends 5', exact: true }).click();
  await expect(page.locator('.roster-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Assign Aatrox to A', exact: true }).click();
  await page.getByLabel('Search characters').fill('ekko'); await expect(page.locator('.roster-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Assign Ekko to A', exact: true })).toBeVisible();
  await page.getByLabel('Search characters').fill('pudge'); await expect(page.locator('.roster-card')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toContainText('another name or origin'); await page.getByLabel('Search characters').clear();
  const dock = page.getByRole('region', { name: 'Choose contenders', exact: true });
  await dock.getByRole('button', { name: 'B Sawblade', exact: true }).click();
  await origins.getByRole('button', { name: 'Dota 2 1', exact: true }).click(); await expect(page.locator('.roster-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Assign Pudge to B', exact: true }).click(); await expect(dock.getByRole('button', { name: 'B Pudge', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await origins.getByRole('button', { name: 'All origins 15', exact: true }).click(); await expect(page.locator('.roster-card')).toHaveCount(15);
  await expect(page.locator('.simulation-status')).toHaveText('Ready to collide');
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 720], [820, 680]]) {
    await page.setViewportSize({ width, height });
    const selector = (await dock.boundingBox())!, run = (await page.getByRole('button', { name: 'Run', exact: true }).boundingBox())!, roster = (await page.locator('.sidebar-scroll').boundingBox())!;
    expect(selector.y).toBeGreaterThanOrEqual(roster.y + roster.height); expect(run.y).toBeGreaterThan(selector.y + selector.height); expect(run.y + run.height).toBeLessThan(height);
    await page.locator('.sidebar-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect((await dock.boundingBox())!.y).toBeCloseTo(selector.y, 0);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.locator('.sidebar-scroll').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: 'test-results/origin-categories-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.screenshot({ path: 'test-results/origin-categories-light.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('creators can add new origin categories and older packs still work', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Create a new ball', exact: true }).click();
  await expect(page.getByLabel('Character origin', { exact: true })).toHaveValue('Original creations');
  await page.getByLabel('Name', { exact: true }).fill('Hyrule Orb'); await page.getByLabel('Character origin', { exact: true }).fill('The Legend of Zelda');
  await page.getByRole('button', { name: 'Save & use ball', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Hyrule Orb saved');
  await page.getByRole('button', { name: 'My creations 1', exact: true }).click();
  const origins = page.getByRole('group', { name: 'Character origins', exact: true });
  await origins.getByRole('button', { name: 'The Legend of Zelda 1', exact: true }).click(); await expect(page.locator('.roster-card')).toHaveCount(1);
  await page.reload(); await page.getByRole('button', { name: 'My creations 1', exact: true }).click();
  await page.getByRole('button', { name: 'Assign Hyrule Orb to A', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ball', exact: true }).click();
  const files = unzipSync(readFileSync((await (await downloadPromise).path())!));
  expect(JSON.parse(strFromU8(files['character.json'])).origin).toBe('The Legend of Zelda');
  const legacy = JSON.parse(readFileSync('templates/character/character.json', 'utf8')); delete legacy.origin; legacy.id = 'test:legacy'; legacy.name = 'Legacy Ball';
  await page.getByLabel('Import character pack').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect(page.getByRole('button', { name: 'My creations 2', exact: true })).toBeVisible();
  await origins.getByRole('button', { name: 'Original creations 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assign Legacy Ball to A', exact: true })).toBeVisible(); await expect(page.locator('.roster-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'All balls 17', exact: true }).click(); await expect(page.locator('.roster-card')).toHaveCount(17);
});
