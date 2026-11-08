import { describe, expect, it, vi } from "vitest";
import { createMockSender, createSlackSender, isAllowedWebhookUrl, parseRetryAfter } from "./slack";

const URL_OK = "https://hooks.slack.com/services/T000/B000/XXXX";

function fetchReturning(status: number, body = "", headers: Record<string, string> = {}) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status, headers }));
}

describe("isAllowedWebhookUrl (SSRF guard)", () => {
  it.each([
    [URL_OK, true],
    ["http://hooks.slack.com/services/x", false],
    ["https://hooks.slack.com.evil.example/services/x", false],
    ["https://evil.example/?u=https://hooks.slack.com/services/x", false],
    ["https://hooks.slack.com/api/other", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["not a url", false],
  ])("%s -> %s", (url, ok) => {
    expect(isAllowedWebhookUrl(url)).toBe(ok);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds, caps at an hour, defaults to 30", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("1.2")).toBe(2);
    expect(parseRetryAfter("99999")).toBe(3600);
    expect(parseRetryAfter(null)).toBe(30);
    expect(parseRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT")).toBe(30);
  });
});

describe("createSlackSender", () => {
  it("posts JSON and reports success", async () => {
    const f = fetchReturning(200, "ok");
    const result = await createSlackSender(URL_OK, { fetchImpl: f }).send({ text: "hello" });
    expect(result).toEqual({ outcome: "sent", httpStatus: 200 });
    const [, init] = f.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ text: "hello" });
    expect(init?.redirect).toBe("error");
  });

  it("truncates very long messages", async () => {
    const f = fetchReturning(200, "ok");
    await createSlackSender(URL_OK, { fetchImpl: f }).send({ text: "x".repeat(5000) });
    expect(JSON.parse(f.mock.calls[0]![1]?.body as string).text).toHaveLength(3000);
  });

  it("maps 429 to rate_limited with Retry-After", async () => {
    const result = await createSlackSender(URL_OK, { fetchImpl: fetchReturning(429, "rate_limited", { "Retry-After": "17" }) }).send({ text: "x" });
    expect(result).toMatchObject({ outcome: "rate_limited", retryAfterSeconds: 17 });
  });

  it("treats 5xx as retryable and 4xx as permanent", async () => {
    expect((await createSlackSender(URL_OK, { fetchImpl: fetchReturning(503) }).send({ text: "x" })).outcome).toBe("retry");
    const bad = await createSlackSender(URL_OK, { fetchImpl: fetchReturning(400, "invalid_payload") }).send({ text: "x" });
    expect(bad).toMatchObject({ outcome: "failed", httpStatus: 400 });
    expect(bad.outcome === "failed" && bad.error).toContain("invalid_payload");
  });

  it("treats network errors and timeouts as retryable", async () => {
    const network = vi.fn<typeof fetch>(async () => { throw new TypeError("fetch failed"); });
    expect(await createSlackSender(URL_OK, { fetchImpl: network }).send({ text: "x" })).toEqual({ outcome: "retry", error: "Network error" });

    const slow = vi.fn<typeof fetch>((_u, init) => new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))));
    const result = await createSlackSender(URL_OK, { fetchImpl: slow, timeoutMs: 20 }).send({ text: "x" });
    expect(result).toEqual({ outcome: "retry", error: "Timed out after 20 ms" });
  });

  it("refuses non-Slack URLs without making a request", async () => {
    const f = fetchReturning(200);
    const result = await createSlackSender("https://evil.example/hook", { fetchImpl: f }).send({ text: "x" });
    expect(result.outcome).toBe("failed");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("createMockSender", () => {
  it("never calls the network and labels itself mock", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const sender = createMockSender("rate_limited");
    expect(sender.mode).toBe("mock");
    expect(await sender.send({ text: "x" })).toMatchObject({ outcome: "rate_limited", retryAfterSeconds: 45 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("escapeSlackText", () => {
  it("neutralises mentions and links in user-supplied titles", async () => {
    const { escapeSlackText } = await import("./slack");
    expect(escapeSlackText('Fix <!channel> & <https://evil|click>')).toBe("Fix &lt;!channel&gt; &amp; &lt;https://evil|click&gt;");
    const f = vi.fn<typeof fetch>(async () => new Response("ok"));
    await createSlackSender(URL_OK, { fetchImpl: f }).send({ text: "<!here>" });
    expect(JSON.parse(f.mock.calls[0]![1]?.body as string).text).toBe("&lt;!here&gt;");
  });
});
