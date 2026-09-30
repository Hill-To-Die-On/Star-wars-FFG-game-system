import { SYSTEM_PATH } from "./config.mjs";
import { mergeAdvancementTrees } from "./advancement-data.mjs";
import { mergeVehicleStats } from "./vehicle-data.mjs";

let publishedPromise;
async function loadJSON(name) {
  const response = await fetch(`${SYSTEM_PATH}/data/${name}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Reference catalogue could not be loaded (${response.status}).`);
  return response.json();
}

// One cached public catalogue serves sheets and compendium imports. World
// documents are created only when the GM explicitly imports the library.
export function publishedLibrary() {
  return publishedPromise ??= Promise.all([
    loadJSON("reference-library"), loadJSON("advancement-trees"), loadJSON("vehicle-stats"),
  ]).then(([source, advancement, vehicles]) =>
    mergeVehicleStats(mergeAdvancementTrees(source, advancement), vehicles)
  ).catch(error => { publishedPromise = undefined; throw error; });
}
