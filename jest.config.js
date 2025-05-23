export default {
  transform: {},
  moduleNameMapper: {
    "^(\.{1,2}/.*)\.js$": "$1",
  },
  testEnvironment: "node",
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!jest.config.js",
    "!src/lsplugin.user.js",
    "!src/main.js", // TODO: Remove this after finding a way to test main.js with Jest
  ],
  coverageReporters: ["text", "json-summary"],
};
