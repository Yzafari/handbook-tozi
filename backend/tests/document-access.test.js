import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessDocument } from '../src/modules/documents/access.js';
import { normalizePersian } from '../src/utils/persian-text.js';

const user = { id: 'u1', role: 'USER' };

test('public documents are visible to guests and authenticated users', () => {
  assert.equal(canAccessDocument({ isActive: true, visibility: 'PUBLIC' }, user), true);
  assert.equal(canAccessDocument({ isActive: true, visibility: 'PUBLIC' }, null), true);
});

test('private documents are visible only to their owner and administrators', () => {
  const doc = { isActive: true, visibility: 'PRIVATE', ownerId: 'u1' };
  assert.equal(canAccessDocument(doc, user), true);
  assert.equal(canAccessDocument({ ...doc, ownerId: 'u2' }, user), false);
  assert.equal(canAccessDocument({ ...doc, ownerId: 'u2' }, { id: 'a1', role: 'ADMIN' }), true);
});

test('role-restricted documents require an explicit matching role', () => {
  const doc = { isActive: true, visibility: 'ROLE_RESTRICTED', accessJobRoles: ['SIMBAN'] };
  assert.equal(canAccessDocument(doc, user), false);
  assert.equal(canAccessDocument(doc, { id: 'u2', role: 'USER', jobRole: 'SIMBAN' }), true);
});

test('inactive documents are never accessible, including by admins', () => {
  assert.equal(canAccessDocument({ isActive: false, visibility: 'PUBLIC' }, { id: 'a1', role: 'SUPER_ADMIN' }), false);
});

test('Persian text normalization unifies Arabic and Persian characters and digits', () => {
  assert.equal(normalizePersian('ي ك ۱۲۳ ١٢٣'), 'ی ک 123 123');
  assert.equal(normalizePersian('محاسبات‌فنی'), 'محاسبات فنی');
});
