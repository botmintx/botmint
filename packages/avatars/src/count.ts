import rules from "../rules.json" with { type: "json" };

const categories = rules.categories;
const uncommon = new Set(rules.tiers.UNCOMMON.values);
const legendaryBodies = new Set(rules.tiers.LEGENDARY.values);
const rareValues = new Set(rules.tiers.RARE.values);

export type LookCount = {
  valid: number;
  legendary: number;
  rare: number;
  uncommon: number;
  common: number;
  oneOfOnes: number;
};

export function countLooks(): LookCount {
  let legendary = 0;
  let rare = 0;
  let uncommonCount = 0;
  let common = 0;
  for (const eyewear of categories.Eyewear) {
    const eyes = eyewear === "VR Goggles" ? ["Idle"] : categories.Eyes;
    for (const _eye of eyes) {
      for (const _background of categories.Background) {
        for (const body of categories.Body) {
          for (const headwear of categories.Headwear) {
            for (const clothing of categories.Clothing) {
              for (const accessory of categories.Accessory) {
                if (clothing === "Turtleneck" && accessory === "Scarf") continue;
                if (legendaryBodies.has(body)) legendary += 1;
                else if (rareValues.has(headwear) || rareValues.has(eyewear)) rare += 1;
                else {
                  const hits = [headwear, eyewear, clothing, accessory].filter((value) =>
                    uncommon.has(value),
                  ).length;
                  if (hits >= 2) uncommonCount += 1;
                  else common += 1;
                }
              }
            }
          }
        }
      }
    }
  }
  return {
    valid: legendary + rare + uncommonCount + common,
    legendary,
    rare,
    uncommon: uncommonCount,
    common,
    oneOfOnes: rules.counts.one_of_ones,
  };
}

export function tierOf(traits: {
  Body: string;
  Headwear: string;
  Eyewear: string;
  Clothing: string;
  Accessory: string;
}): "LEGENDARY" | "RARE" | "UNCOMMON" | "COMMON" {
  if (legendaryBodies.has(traits.Body)) return "LEGENDARY";
  if (rareValues.has(traits.Headwear) || rareValues.has(traits.Eyewear)) return "RARE";
  const hits = [traits.Headwear, traits.Eyewear, traits.Clothing, traits.Accessory].filter(
    (value) => uncommon.has(value),
  ).length;
  return hits >= 2 ? "UNCOMMON" : "COMMON";
}
