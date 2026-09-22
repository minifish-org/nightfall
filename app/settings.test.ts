import { DEFAULT_CONNECTION, resolveConnection } from "./settings.js";

describe("agentd connection settings", () => {
  it("defaults to a local endpoint without a built-in credential", () => {
    expect(resolveConnection().baseUrl).toBe("http://127.0.0.1:8080");
    expect(DEFAULT_CONNECTION.token).toBe("");
  });

  it("preserves an operator-supplied endpoint, token and tenant", () => {
    const stored = { baseUrl: "https://agentd.example.org", token: "test-token", tenant: "demo" };
    expect(resolveConnection(stored)).toEqual(stored);
  });
});
