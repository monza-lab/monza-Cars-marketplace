export class MetaPublishError extends Error {
  constructor(public stage: string, public status: number, public body: unknown) {
    super(`Meta publish failed at ${stage}: ${JSON.stringify(body)}`);
  }
}

export interface PublishConfig {
  pageId: string;
  igBusinessId: string;
  pageAccessToken: string;
  apiVersion: string; // e.g. "v19.0"
  slideUrls: string[]; // 5 public PNG URLs
  caption: string;
  reportUrl: string;
}

export interface PublishResult {
  ig_post_id: string;
  fb_post_id: string;
  ig_creation_id: string;
}

async function metaFetch(url: string, body: Record<string, unknown>, stage: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new MetaPublishError(stage, r.status, data);
  return data as { id: string };
}

export async function publishToInstagram(cfg: PublishConfig): Promise<{ ig_post_id: string; ig_creation_id: string }> {
  const base = `https://graph.facebook.com/${cfg.apiVersion}`;

  const containerIds: string[] = [];
  for (const imageUrl of cfg.slideUrls) {
    const item = await metaFetch(`${base}/${cfg.igBusinessId}/media`, {
      image_url: imageUrl,
      is_carousel_item: true,
      access_token: cfg.pageAccessToken,
    }, "ig_carousel_item");
    containerIds.push(item.id);
  }

  const carousel = await metaFetch(`${base}/${cfg.igBusinessId}/media`, {
    media_type: "CAROUSEL",
    children: containerIds.join(","),
    caption: cfg.caption,
    access_token: cfg.pageAccessToken,
  }, "ig_carousel_container");

  const published = await metaFetch(`${base}/${cfg.igBusinessId}/media_publish`, {
    creation_id: carousel.id,
    access_token: cfg.pageAccessToken,
  }, "ig_publish");

  return { ig_post_id: published.id, ig_creation_id: carousel.id };
}

export async function publishToFacebookPage(cfg: PublishConfig): Promise<{ fb_post_id: string }> {
  const base = `https://graph.facebook.com/${cfg.apiVersion}`;

  const photoIds: string[] = [];
  for (const imageUrl of cfg.slideUrls) {
    const p = await metaFetch(`${base}/${cfg.pageId}/photos`, {
      url: imageUrl,
      published: false,
      access_token: cfg.pageAccessToken,
    }, "fb_photo");
    photoIds.push(p.id);
  }

  const post = await metaFetch(`${base}/${cfg.pageId}/feed`, {
    message: cfg.caption + "\n\n" + cfg.reportUrl,
    attached_media: JSON.stringify(photoIds.map((id) => ({ media_fbid: id }))),
    access_token: cfg.pageAccessToken,
  }, "fb_feed");

  return { fb_post_id: post.id };
}

export async function publishToMeta(cfg: PublishConfig): Promise<PublishResult> {
  const ig = await publishToInstagram(cfg);
  const fb = await publishToFacebookPage(cfg);
  return { ig_post_id: ig.ig_post_id, ig_creation_id: ig.ig_creation_id, fb_post_id: fb.fb_post_id };
}
