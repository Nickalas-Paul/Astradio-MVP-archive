/** Jest config for community posts UI / helper tests. */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/community-posts-ui.test.js'],
  transformIgnorePatterns: ['/node_modules/(?!bad-words|badwords-list)/'],
};
