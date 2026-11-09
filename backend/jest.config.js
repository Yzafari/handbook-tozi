export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  transform: {},
  setupFiles: ['<rootDir>/tests/setup.env.cjs'],
  clearMocks: true,
  testTimeout: 15000,
};