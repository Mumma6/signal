import { describe, expect, it } from "vitest";
import { unpublishedArticles } from "@/lib/editorial/novelty";
import { article } from "../support/fixtures";

describe("publication history", () => {
  const previous = article("previous", {
    title: "OpenAI releases Codex terminal workflow support",
  });
  it("blocks repeat URLs even if their IDs, tracking tags or dates changed", () => {
    expect(
      unpublishedArticles(
        [
          article("new-id", {
            url: previous.url + "?utm_source=today",
            title: "An edited headline",
            publishedAt: "2026-11-17T07:00:00Z",
          }),
        ],
        [previous],
      ),
    ).toEqual([]);
  });
  it("blocks reworded coverage from a different publisher", () => {
    const duplicate = article("other", {
      sourceId: "devto",
      title: "Codex terminal workflow support released by OpenAI",
    });
    expect(unpublishedArticles([duplicate], [previous])).toEqual([]);
  });
  it("allows distinct releases and unrelated new developments", () => {
    const old = article("old", {
      sourceId: "codex",
      title: "Codex releases terminal support in 1.2.0",
    });
    const update = article("new", {
      sourceId: "codex",
      title: "Codex releases terminal support in 1.3.0",
    });
    expect(unpublishedArticles([update], [old])).toEqual([update]);
    expect(
      unpublishedArticles(
        [article("different", { title: "Mistral releases image embeddings for local retrieval" })],
        [previous],
      ),
    ).toHaveLength(1);
  });
  it("does not confuse bare version numbers from different products", () => {
    const old = article("old", { sourceId: "codex", title: "v1.2.3" });
    expect(
      unpublishedArticles([article("other", { sourceId: "claude-code", title: "v1.2.3" })], [old]),
    ).toHaveLength(1);
  });
});
