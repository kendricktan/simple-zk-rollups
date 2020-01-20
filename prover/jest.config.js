module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  modulePaths: ["<rootDir>", "<rootDir>/../operator/src"],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|js)x?$",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "src/**/*.{ts,tsx,js,jsx}",
    "!src/**/*.d.ts"
  ],
  preset: "ts-jest",
  rootDir: process.cwd()
};
