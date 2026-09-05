import { APP_NAME } from "../src/config/app";

describe("application scaffold", () => {
  it("uses the KC3 product name", () => {
    expect(APP_NAME).toBe("KC3");
  });
});
