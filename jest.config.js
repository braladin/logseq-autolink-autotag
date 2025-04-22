export default {
  transform: {},
  moduleNameMapper: {
    "^(\.{1,2}/.*)\.js$": "$1",
  },
  testEnvironment: "node",
  resetMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!jest.config.js",
    "!lsplugin.user.js"
  ],
  coverageReporters: ["text", "lcov", "clover"],
};
