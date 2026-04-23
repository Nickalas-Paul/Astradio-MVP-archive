/**
 * Jest config for identity export write-contract tests (Node, vnext imports).
 * Default jest.config.js uses jsdom + roots that may omit vnext.
 */
const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.join(__dirname, '..'),
  testMatch: ['<rootDir>/tests/identity-export-write-contract.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@public/(.*)$': '<rootDir>/public/$1',
  },
};
