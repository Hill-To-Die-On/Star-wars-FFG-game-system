// Minimal valid interchange packages shared by the integration API tests.
export const FORMAT = "star-wars-ffg-interchange";

const source = () => ({
  id: "qa.builder",
  name: "QA Builder",
  version: "1.0.0",
  url: "https://builder.example/",
});

const SYSTEMS = {
  character: { line: "edge", phase: "creation", characteristics: { brawn: 2 } },
  rival: { line: "edge", phase: "play", characteristics: { brawn: 3 } },
  vehicle: {
    hullTrauma: { value: 0, max: 20 },
    systemStrain: { value: 0, max: 15 },
    armor: 3,
    silhouette: 4,
    handling: -1,
  },
};

export const actorSystem = (type) => structuredClone(SYSTEMS[type]);

export function characterPackage() {
  return {
    format: FORMAT,
    version: 1,
    kind: "character",
    source: source(),
    payload: {
      name: "Ria Vale",
      type: "character",
      system: {
        line: "edge",
        phase: "play",
        characteristics: { brawn: 2, agility: 3 },
        wounds: { value: 2, max: 12 },
        strain: { value: 1, max: 13 },
      },
      items: [
        {
          id: "AbCdEfGhIjKlMnOp",
          name: "Creator toolkit",
          type: "gear",
          system: { description: "Original guidance.", quantity: 1 },
        },
      ],
    },
  };
}

export function actorPackage(type) {
  return {
    format: FORMAT,
    version: 2,
    kind: "actor",
    source: source(),
    payload: {
      name: `Field test ${type}`,
      type,
      system: actorSystem(type),
      items: [],
    },
  };
}

export function rulePack(count = 1) {
  return {
    format: FORMAT,
    version: 2,
    kind: "rulePack",
    source: source(),
    payload: {
      id: "qa-rules",
      name: "QA rules",
      version: "2.0.0",
      rules: Array.from({ length: count }, (_, index) => ({
        key: `gear.item-${index}`,
        name: `Rule ${index}`,
        type: "gear",
        system: { description: "Guidance.", quantity: 1, price: 10, rarity: 1 },
      })),
    },
  };
}

export function bundle(...packages) {
  return {
    format: FORMAT,
    version: 2,
    kind: "bundle",
    source: source(),
    payload: { packages },
  };
}
