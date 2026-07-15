import { DEFAULT_CONNECTION, resolveConnection } from "./settings.js";

describe("agentd connection migration", () => {
  it("defaults to the minifish-home deployment", () => {
    expect(resolveConnection().baseUrl).toBe(DEFAULT_CONNECTION.baseUrl);
    expect(DEFAULT_CONNECTION.baseUrl).toBe("https://minifish-home.taila2cd17.ts.net");
  });

  it("moves the retired Mac endpoint without losing token or tenant", () => {
    expect(resolveConnection({
      baseUrl: "https://macbook-air-for-home.taila2cd17.ts.net/",
      token: "kept-locally",
      tenant: "werewolf",
    })).toEqual({
      baseUrl: "https://minifish-home.taila2cd17.ts.net",
      token: "kept-locally",
      tenant: "werewolf",
    });
  });

  it("preserves an operator-supplied endpoint", () => {
    expect(resolveConnection({ baseUrl: "http://127.0.0.1:8080" }).baseUrl)
      .toBe("http://127.0.0.1:8080");
  });
});
