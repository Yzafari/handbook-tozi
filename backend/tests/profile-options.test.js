import test from 'node:test';
import assert from 'node:assert/strict';
import { JOB_ROLES, JOB_ROLE_VALUES } from '../src/config/job-roles.js';
import { PROVINCES, PROVINCE_VALUES } from '../src/config/provinces.js';

test('all 13 approved job roles have unique stable codes and Persian labels', () => {
  assert.equal(JOB_ROLES.length, 13);
  assert.equal(new Set(JOB_ROLE_VALUES).size, 13);
  assert.ok(JOB_ROLES.every(item => item.value && item.label));
});

test('all 31 provinces have unique stable codes and Persian labels', () => {
  assert.equal(PROVINCES.length, 31);
  assert.equal(new Set(PROVINCE_VALUES).size, 31);
  assert.ok(PROVINCES.every(item => item.value && item.label));
});
