import test from 'node:test';
import assert from 'node:assert/strict';
// Node strips the TypeScript types on import (Node >= 22.18). The registry only
// exists as `registry.ts`; a sibling `.js` would shadow it inside Metro.
import { createModuleRegistry, getHomeModules, MODULE_REGISTRY } from '../src/core/modules/registry.ts';

test('home module registry contains the agreed modules without standalone search or camera cards', () => {
  const labels = getHomeModules().map(module => module.label);
  assert.ok(labels.includes('پرداخت قبض'));
  assert.ok(labels.includes('استانداردها و دستورالعمل‌ها'));
  assert.ok(labels.includes('محاسبات فنی'));
  assert.ok(labels.includes('پیام‌ها و اصول ایمنی'));
  assert.ok(labels.includes('پروژه های من'));
  assert.ok(!labels.includes('جستجو'));
  assert.ok(!labels.includes('دوربین'));
  assert.equal(new Set(labels).size, labels.length, 'home tiles must not repeat a label');
});

test('module registry rejects duplicate ids, duplicate routes and active modules without routes', () => {
  assert.throws(() => createModuleRegistry([{ id: 'same', label: 'A', icon: 'A', status: 'disabled' }, { id: 'same', label: 'B', icon: 'B', status: 'disabled' }]), /Duplicate module id/);
  assert.throws(() => createModuleRegistry([{ id: 'module-a', label: 'A', icon: 'A', status: 'active', route: '/same' }, { id: 'module-b', label: 'B', icon: 'B', status: 'active', route: '/same' }]), /Duplicate module route/);
  assert.throws(() => createModuleRegistry([{ id: 'module-a', label: 'A', icon: 'A', status: 'active' }]), /requires an absolute route/);
});

test('the production module registry has unique ids and keeps only the notebook route active', () => {
  assert.equal(new Set(MODULE_REGISTRY.map(module => module.id)).size, MODULE_REGISTRY.length);
  assert.deepEqual(MODULE_REGISTRY.filter(module => module.status === 'active').map(module => module.id), ['notebook']);
});

test('home keeps colleague chats in the middle and quick-access options before departments', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/app/index.tsx', import.meta.url), 'utf8');
  const chat = source.indexOf("t('chat')");
  const quick = source.indexOf("t('quickAccessTitle')");
  const departments = source.indexOf("t('departments')");
  assert.ok(chat > 0 && quick > chat && departments > quick);
  assert.ok(source.includes("t('colleaguesFive')"));
  assert.ok(source.includes("key: 'quickTender'"));
  assert.ok(source.includes("key: 'quickMarket'"));
  assert.ok(source.includes("key: 'quickJobs'"));
  assert.ok(!MODULE_REGISTRY.some(module => ['tenders', 'marketplace', 'colleagues-chat'].includes(module.id)));
});
