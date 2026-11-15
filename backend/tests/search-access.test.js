import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchAccessFilter } from '../src/services/search/search-access.js';

test('guest search is restricted to public documents', () => {
  assert.deepEqual(buildSearchAccessFilter(null), [{ bool: { should: [{ term: { visibility: 'PUBLIC' } }], minimum_should_match: 1 } }]);
});

test('authenticated user can search public, own private and matching job-role documents only', () => {
  assert.deepEqual(buildSearchAccessFilter({ id: 'user-1', role: 'USER', jobRole: 'TECHNICIAN' }), [{ bool: { should: [
    { term: { visibility: 'PUBLIC' } },
    { bool: { filter: [{ term: { visibility: 'PRIVATE' } }, { term: { ownerId: 'user-1' } }] } },
    { bool: { filter: [{ term: { visibility: 'ROLE_RESTRICTED' } }, { term: { accessJobRoles: 'TECHNICIAN' } }] } },
  ], minimum_should_match: 1 } }]);
});

test('admins are not restricted by document visibility filters', () => {
  assert.deepEqual(buildSearchAccessFilter({ id: 'admin-1', role: 'SUPER_ADMIN' }), []);
});
