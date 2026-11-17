import { describe, expect, it, vi } from "vitest";
import { fetchText, SourceHttpError } from "@/lib/sources/http";

describe("bounded source HTTP transport", () => {
  it("retains HTTP status as structured data for expected missing releases", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));
    try {
      await expect(fetchText("https://example.com/feed")).rejects.toMatchObject({
        name: "SourceHttpError",
        status: 404,
      });
    } finally {
      request.mockRestore();
    }
    expect(new SourceHttpError(404).message).toBe("Source returned HTTP 404");
  });
  it("rejects an oversized advertised body before reading it", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("data", { headers: { "content-length": "2000001" } }));
    try {
      await expect(fetchText("https://example.com/feed")).rejects.toThrow("too large");
    } finally {
      request.mockRestore();
    }
  });
  it("rejects a stream that exceeds the limit and cancels the reader", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(2_000_001));
      },
      cancel,
    });
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream));
    try {
      await expect(fetchText("https://example.com/feed")).rejects.toThrow("too large");
      expect(cancel).toHaveBeenCalledOnce();
    } finally {
      request.mockRestore();
    }
  });
  it("preserves a stream failure when cancellation fails too", async () => {
    const original = new Error("Read failed");
    const stream = new ReadableStream({
      start(controller) {
        controller.error(original);
      },
    });
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream));
    try {
      await expect(fetchText("https://example.com/feed")).rejects.toBe(original);
    } finally {
      request.mockRestore();
    }
  });
});
