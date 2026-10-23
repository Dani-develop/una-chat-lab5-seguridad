module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/', '/original/'],
  clearMocks: true,
  restoreMocks: true,
  verbose: true
};
