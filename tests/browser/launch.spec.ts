import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function dragArrow(page: Page, slot: 'A' | 'B', angle: number) {
  const arrow = page.getByRole('slider', { name: `Contender ${slot} starting direction` });
  const origin = await arrow.locator('line').evaluate(element => {
    const line = element as SVGLineElement, svg = line.ownerSVGElement!, bounds = svg.getBoundingClientRect();
    return { x: bounds.x + line.x1.baseVal.value / svg.viewBox.baseVal.width * bounds.width, y: bounds.y + line.y1.baseVal.value / svg.viewBox.baseVal.height * bounds.height };
  });
  const handle = (await arrow.locator('.launch-grip').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(origin.x + Math.cos(angle * Math.PI / 180) * 65, origin.y - Math.sin(angle * Math.PI / 180) * 65, { steps: 6 });
  await page.mouse.up(); await expect(arrow).toHaveAttribute('aria-valuenow', String(angle));
}

test('in-arena arrows drag independently, support keyboard input, persist, and export with setup', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const status = page.locator('.simulation-status'), clock = page.locator('.arena-meta');
  await expect(status).toHaveText('Ready to collide'); await page.waitForTimeout(350);
  await expect(clock).toContainText('00:00');
  const a = page.getByRole('slider', { name: 'Contender A starting direction' }), b = page.getByRole('slider', { name: 'Contender B starting direction' });
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await dragArrow(page, 'A', 90); await a.focus(); await page.keyboard.press('ArrowUp'); await expect(a).toHaveAttribute('aria-valuenow', '95');
  await dragArrow(page, 'A', 0); await dragArrow(page, 'B', 180);
  await expect(a).toHaveAttribute('aria-valuenow', '0');
  await page.screenshot({ path: 'test-results/launch-directions-ready.png', fullPage: true });
  await page.reload(); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await expect(a).toHaveAttribute('aria-valuenow', '0'); await expect(b).toHaveAttribute('aria-valuenow', '180'); await expect(status).toHaveText('Ready to collide');
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save setup snapshot' }).click();
  const setup = JSON.parse(readFileSync((await (await downloadPromise).path())!, 'utf8'));
  expect(setup.settings.launchAngles).toEqual([0, 180]);
});

test('only Run starts a round and all configuration changes return to ready', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ball-arena-settings', JSON.stringify({ repeat: true, launchAngles: [null, 'invalid'] })));
  await page.goto('/'); const run = page.getByRole('button', { name: 'Run', exact: true }), status = page.locator('.simulation-status');
  await expect(run).toBeEnabled(); await expect(page.getByRole('slider', { name: 'Contender A starting direction' })).toHaveAttribute('aria-valuenow', '45');
  await page.waitForTimeout(350); await expect(status).toHaveText('Ready to collide');
  await run.click(); await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Assign Dartling to A', exact: true }).click();
  await expect(status).toHaveText('Ready to collide');
  const cooldown = await page.locator('[data-contender="0"] .live-skills').innerText();
  await page.waitForTimeout(300); expect(await page.locator('[data-contender="0"] .live-skills').innerText()).toBe(cooldown);
  await run.click(); await expect(page.getByRole('slider')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset arena', exact: true }).click(); await dragArrow(page, 'B', 90);
  await expect(status).toHaveText('Ready to collide'); await expect(page.locator('.arena-meta')).toContainText('00:00');
  await run.click(); await page.getByRole('button', { name: 'Reset arena', exact: true }).click();
  await expect(status).toHaveText('Ready to collide');
  await run.click(); await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(status).toHaveText('Paused'); await page.waitForTimeout(250); await expect(status).toHaveText('Paused');
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Round time limit' }).selectOption('30');
  await expect(status).toHaveText('Ready to collide');
  await page.getByRole('button', { name: 'Randomize seed' }).click(); await expect(status).toHaveText('Ready to collide');
});
