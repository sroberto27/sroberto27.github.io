import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/00-tokens.css', import.meta.url), 'utf8');
const colors = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/g)].map(m => [m[1], m[2]]));
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(colors[a]), luminance(colors[b])].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test('252/180: small shared text retains 4.5:1 contrast on all workspace surfaces', () => {
  for (const foreground of ['text', 'text-muted', 'text-faint', 'warning', 'danger']) {
    for (const background of ['surface-0', 'surface-1', 'surface-2', 'surface-3', 'surface-raised']) {
      assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
    }
  }
  for (const background of ['action', 'action-hover']) {
    assert.ok(contrast('action-ink', background) >= 4.5, `primary action on ${background}`);
  }
});

test('252/180: form boundaries and focus color remain distinguishable', () => {
  for (const background of ['surface-0', 'surface-1', 'surface-2']) {
    assert.ok(contrast('line-strong', background) >= 3, `input boundary on ${background}`);
    assert.ok(contrast('accent-strong', background) >= 3, `focus on ${background}`);
  }
});
