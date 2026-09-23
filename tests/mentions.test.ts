import { describe, expect, it } from "vitest";
import { getModel } from "@/lib/catalog";
import {
  filterMentionAssets,
  findMentionQuery,
  findUnknownMentions,
  getMentionAssets,
  insertMention,
} from "@/lib/catalog/mentions";

const seedance = getModel("seedance-2-5/reference-to-video")!;
const cinema = getModel("cinema-studio-4/generate")!;
const media = {
  image_urls: ["https://cdn.test/a.png", "https://cdn.test/b.png"],
  video_urls: ["https://cdn.test/v.mp4"],
};

describe("asset tags", () => {
  it("numbers tags in upload order per media kind", () => {
    expect(getMentionAssets(seedance, media).map((asset) => `${asset.tag}=${asset.url}`)).toEqual([
      "@image1=https://cdn.test/a.png",
      "@image2=https://cdn.test/b.png",
      "@video1=https://cdn.test/v.mp4",
    ]);
  });

  it("uses Cinema Studio's <<<kind_n>>> syntax", () => {
    expect(getMentionAssets(cinema, media).map((asset) => asset.tag)).toEqual(["<<<image_1>>>", "<<<image_2>>>", "<<<video_1>>>"]);
  });

  it("flags tags that name no attached file", () => {
    const assets = getMentionAssets(seedance, media);
    expect(findUnknownMentions("@image2 meets @image3 and @Video1", seedance.mentions!, assets)).toEqual(["@image3"]);
    expect(findUnknownMentions("<<<audio_1>>>", cinema.mentions!, getMentionAssets(cinema, media))).toEqual(["<<<audio_1>>>"]);
  });

  it("is off for models without tag support", () => {
    expect(getMentionAssets(getModel("kling-3/pro-image-to-video")!, media)).toEqual([]);
  });
});

describe("mention editing", () => {
  it("finds the query being typed", () => {
    expect(findMentionQuery("a dancer from @ima", 18)).toEqual({ start: 14, query: "ima" });
    expect(findMentionQuery("mail me@example.com", 19)).toBeNull();
  });

  it("filters by kind and number", () => {
    const assets = getMentionAssets(seedance, media);
    expect(filterMentionAssets(assets, "vid").map((asset) => asset.tag)).toEqual(["@video1"]);
    expect(filterMentionAssets(assets, "image2").map((asset) => asset.tag)).toEqual(["@image2"]);
  });

  it("inserts a tag with spacing and returns the caret", () => {
    expect(insertMention("from @ima now", 5, 9, "@image1")).toEqual({ text: "from @image1 now", caret: 13 });
    expect(insertMention("dancer", 6, 6, "@image1")).toEqual({ text: "dancer @image1 ", caret: 15 });
  });
});
