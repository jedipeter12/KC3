module.exports = {
  // Keep real Node fetch; jest-expo's native setup installs network mocks.
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      // Read process.env at runtime rather than Expo's virtual client env module.
      { presets: ["babel-preset-expo"], caller: { isServer: true } },
    ],
  },
  testMatch: ["<rootDir>/tests/integration/**/*.smoke.ts"],
  testTimeout: 15000,
};
