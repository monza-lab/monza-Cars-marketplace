import { describe, expect, it } from "vitest";

import { deriveSourceId, extractAutoScout24ListingUuid } from "./id";

describe("AutoScout24 listing identity", () => {
  it("extracts the native offer UUID from decorated search slugs", () => {
    expect(
      extractAutoScout24ListingUuid(
        "porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950ge282va266-04631d26-6ed8-4c2f-b094-51f66294fada",
      ),
    ).toBe("04631d26-6ed8-4c2f-b094-51f66294fada");
  });

  it("uses the same source id for AS24 filter-decorated URL variants", () => {
    const plain = deriveSourceId({
      sourceId:
        "porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-04631d26-6ed8-4c2f-b094-51f66294fada",
      sourceUrl:
        "https://www.autoscout24.com/offers/porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-04631d26-6ed8-4c2f-b094-51f66294fada",
    });
    const categoryDecorated = deriveSourceId({
      sourceId:
        "porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950-04631d26-6ed8-4c2f-b094-51f66294fada",
      sourceUrl:
        "https://www.autoscout24.com/offers/porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950-04631d26-6ed8-4c2f-b094-51f66294fada",
    });
    const modelDecorated = deriveSourceId({
      sourceId:
        "porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950ge282va266-04631d26-6ed8-4c2f-b094-51f66294fada",
      sourceUrl:
        "https://www.autoscout24.com/offers/porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950ge282va266-04631d26-6ed8-4c2f-b094-51f66294fada",
    });

    expect(plain).toBe("as24-04631d26-6ed8-4c2f-b094-51f66294fada");
    expect(categoryDecorated).toBe(plain);
    expect(modelDecorated).toBe(plain);
  });
});
