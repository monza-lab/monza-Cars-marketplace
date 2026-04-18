import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishToMeta, MetaPublishError } from "./metaPublisher";

const originalFetch = global.fetch;
beforeEach(() => { global.fetch = originalFetch; vi.restoreAllMocks(); });

describe("publishToMeta", () => {
  it("sequences IG containers then publish, plus FB post", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    global.fetch = vi.fn(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, body });

      if (url.includes("/media") && body?.is_carousel_item) {
        return new Response(JSON.stringify({ id: "item-" + calls.length }), { status: 200 });
      }
      if (url.includes("/media") && body?.media_type === "CAROUSEL") {
        return new Response(JSON.stringify({ id: "carousel-1" }), { status: 200 });
      }
      if (url.includes("/media_publish")) {
        return new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 });
      }
      if (url.includes("/photos")) {
        return new Response(JSON.stringify({ id: "fb-photo-" + calls.length }), { status: 200 });
      }
      if (url.includes("/feed")) {
        return new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    }) as unknown as typeof fetch;

    const res = await publishToMeta({
      pageId: "PAGE", igBusinessId: "IG", pageAccessToken: "TOK", apiVersion: "v19.0",
      slideUrls: ["a.png", "b.png", "c.png", "d.png", "e.png"],
      caption: "test caption",
      reportUrl: "https://monzahaus.com/x",
    });

    expect(res.ig_post_id).toBe("ig-post-1");
    expect(res.fb_post_id).toBe("fb-post-1");
    expect(res.ig_creation_id).toBe("carousel-1");
    expect(calls.length).toBeGreaterThanOrEqual(7);
  });

  it("throws MetaPublishError on IG container failure", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 400 })) as unknown as typeof fetch;
    await expect(publishToMeta({
      pageId: "P", igBusinessId: "I", pageAccessToken: "T", apiVersion: "v19.0",
      slideUrls: ["a.png", "b.png", "c.png", "d.png", "e.png"],
      caption: "x", reportUrl: "https://x.com",
    })).rejects.toBeInstanceOf(MetaPublishError);
  });
});
