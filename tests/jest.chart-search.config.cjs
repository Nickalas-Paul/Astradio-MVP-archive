/** One-off Jest config for chart-search-label unit tests (avoids root jest roots missing ./src). */
module.exports = {
  rootDir: '..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/chart-search-label.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
};
