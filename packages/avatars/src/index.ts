import { initGeo, releaseAll } from "./geo.ts";
import { blueprint, fullBloom, spacewalk } from "./oneofones.ts";
import { invalidateBases, resetIds } from "./paint.ts";
import { pfp } from "./traits.ts";

await initGeo();

export type PfpTraits = {
  background: string;
  body: string;
  eyes: string;
  headwear: string;
  eyewear: string;
  clothing: string;
  accessory: string;
};

export type OneOfOneId = "full-bloom" | "spacewalk" | "blueprint";

function draw(render: () => string): string {
  resetIds();
  try {
    return render();
  } finally {
    invalidateBases();
    releaseAll();
  }
}

export function renderPfp(traits: PfpTraits): string {
  return draw(() =>
    pfp({
      Background: traits.background,
      Body: traits.body,
      Eyes: traits.eyes,
      Headwear: traits.headwear,
      Eyewear: traits.eyewear,
      Clothing: traits.clothing,
      Accessory: traits.accessory,
    }).svg(),
  );
}

/** Blueprint omits Geist sheet labels; those fonts are not in this repo. */
export function renderOneOfOne(id: OneOfOneId): string {
  return draw(() => {
    if (id === "full-bloom") return fullBloom().svg();
    if (id === "spacewalk") return spacewalk().svg();
    return blueprint().svg();
  });
}
