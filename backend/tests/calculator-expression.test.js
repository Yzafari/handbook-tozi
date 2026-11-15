import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpression, normalizeExpression } from '../../mobile/src/core/calculations/expression.js';

test('calculator handles precedence, parentheses, unary operators and exponentiation', () => {
  assert.equal(evaluateExpression('2+3*4'), 14);
  assert.equal(evaluateExpression('(2+3)*4'), 20);
  assert.equal(evaluateExpression('-2^2'), -4);
  assert.equal(evaluateExpression('2^3^2'), 512);
});

test('calculator normalizes Persian digits and common mathematical symbols', () => {
  assert.equal(normalizeExpression('۱۲ × ۳ ÷ ۲'), '12 * 3 / 2');
  assert.equal(evaluateExpression('۱۲ × ۳ ÷ ۲'), 18);
});

test('calculator supports percent, constants and safe functions', () => {
  assert.equal(evaluateExpression('50%'), 0.5);
  assert.equal(evaluateExpression('sqrt(81)'), 9);
  assert.ok(Math.abs(evaluateExpression('sin(pi/2)') - 1) < 1e-12);
});

test('calculator rejects division by zero, malformed expressions and excessive values', () => {
  assert.throws(() => evaluateExpression('4/0'), /تقسیم بر صفر/);
  assert.throws(() => evaluateExpression('(2+3'), /پرانتز بسته/);
  assert.throws(() => evaluateExpression('2+'), /عبارت ناقص/);
  assert.throws(() => evaluateExpression('2^1000'), /دامنه/);
  assert.throws(() => evaluateExpression('alert(1)'), /نماد نامعتبر/);
});
