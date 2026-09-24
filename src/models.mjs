import { CHARACTERISTICS, SKILLS, THEMES } from "./config.mjs";
const f = foundry.data.fields;
const number = (initial = 0, max = 100000) =>
  new f.NumberField({
    required: true,
    nullable: false,
    integer: true,
    min: 0,
    max,
    initial,
  });
const text = (initial = "") =>
  new f.StringField({ required: true, nullable: false, initial });
const bool = (initial = false) => new f.BooleanField({ initial });
const list = () => new f.ArrayField(text());
const resource = (max = 10) =>
  new f.SchemaField({ value: number(), max: number(max) });
const source = () =>
  new f.SchemaField({ book: text(), page: text(), table: text(), id: text() });
const customSkills = (rankMax = 5) =>
  new f.ArrayField(
    new f.SchemaField({
      id: text(),
      label: text(),
      characteristic: new f.StringField({
        required: true,
        nullable: false,
        initial: "intellect",
        choices: Object.keys(CHARACTERISTICS),
      }),
      type: new f.StringField({
        required: true,
        nullable: false,
        initial: "general",
        choices: ["general", "melee", "ranged"],
      }),
      rank: number(0, rankMax),
      career: bool(),
      group: bool(),
    }),
    { initial: [] },
  );
const motivations = () =>
  new f.ArrayField(
    new f.SchemaField({
      id: text(),
      name: text(),
      category: text(),
      description: text(),
      active: bool(true),
      source: source(),
    }),
    { initial: [] },
  );
export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      theme: new f.StringField({
        initial: "auto",
        choices: ["auto", ...Object.keys(THEMES)],
      }),
      line: new f.StringField({
        initial: "edge",
        choices: ["edge", "age", "force"],
      }),
      phase: new f.StringField({
        initial: "creation",
        choices: ["creation", "play"],
      }),
      species: text(),
      career: text(),
      motivation: text(),
      motivations: motivations(),
      biography: text(),
      characteristics: new f.SchemaField(
        Object.fromEntries(
          Object.keys(CHARACTERISTICS).map((k) => [k, number(2, 7)]),
        ),
      ),
      skills: new f.SchemaField(
        Object.fromEntries(
          Object.keys(SKILLS).map((k) => [
            k,
            new f.SchemaField({
              rank: number(0, 5),
              career: bool(),
              group: bool(),
              characteristic: text(SKILLS[k].characteristic),
            }),
          ]),
        ),
      ),
      customSkills: customSkills(),
      wounds: resource(),
      strain: resource(),
      soak: number(2),
      defense: new f.SchemaField({ melee: number(0, 4), ranged: number(0, 4) }),
      credits: number(0, 1000000000000),
      xp: new f.SchemaField({ available: number(), total: number() }),
      forceRating: number(0, 10),
      committedForce: number(0, 10),
      obligation: new f.SchemaField({ value: number(10, 100), label: text() }),
      duty: new f.SchemaField({
        value: number(0, 100),
        label: text(),
        contribution: number(),
      }),
      morality: new f.SchemaField({
        value: number(50, 100),
        conflict: number(),
        strength: text(),
        weakness: text(),
      }),
      groupSize: number(1, 100),
      criticals: new f.ArrayField(new f.ObjectField()),
      advancement: new f.ArrayField(new f.ObjectField()),
      creation: new f.ObjectField({ initial: {} }),
      source: source(),
      incomplete: list(),
    };
  }
}
export class AdversaryData extends CharacterData {
  static defineSchema() {
    const schema = super.defineSchema();
    // Published NPC statistics may exceed player advancement caps.
    schema.skills = new f.SchemaField(
      Object.fromEntries(
        Object.keys(SKILLS).map((key) => [
          key,
          new f.SchemaField({
            rank: number(0, 10),
            career: bool(),
            group: bool(),
            characteristic: text(SKILLS[key].characteristic),
          }),
        ]),
      ),
    );
    schema.customSkills = customSkills(10);
    return schema;
  }
}
export class VehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      theme: new f.StringField({
        initial: "auto",
        choices: ["auto", ...Object.keys(THEMES)],
      }),
      hullTrauma: resource(20),
      systemStrain: resource(15),
      armor: number(1),
      silhouette: number(3, 20),
      speed: new f.SchemaField({ value: number(0, 20), max: number(3, 20) }),
      handling: new f.NumberField({
        integer: true,
        min: -10,
        max: 10,
        initial: 0,
      }),
      shields: new f.SchemaField({
        fore: number(0, 4),
        aft: number(0, 4),
        port: number(0, 4),
        starboard: number(0, 4),
      }),
      model: text(),
      manufacturer: text(),
      crew: text(),
      passengers: text(),
      hyperdrive: text(),
      cargo: text(),
      notes: text(),
      source: source(),
      incomplete: list(),
      metadata: new f.ObjectField({ initial: {} }),
    };
  }
}
export class GroupData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      theme: new f.StringField({
        initial: "auto",
        choices: ["auto", ...Object.keys(THEMES)],
      }),
      base: new f.SchemaField({
        name: text(),
        location: text(),
        description: text(),
      }),
      members: new f.TypedObjectField(
        new f.SchemaField({
          actorId: text(),
          playerName: text(),
          characterName: text(),
          obligation: number(0, 100),
          obligationType: text(),
          description: text(),
          motivation: text(),
          duty: number(0, 100),
          dutyType: text(),
          morality: number(50, 100),
        }),
        { initial: {} },
      ),
      credits: number(0, 1000000000000),
      resources: text(),
      possessions: text(),
      contacts: text(),
      notes: text(),
    };
  }
}
export class ItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: text(),
      quantity: number(1),
      price: number(0, 1000000000000),
      rarity: number(0, 20),
      encumbrance: number(),
      hardpoints: number(),
      restricted: bool(),
      equipped: bool(),
      skill: text("rangedLight"),
      damage: text("0"),
      critical: number(0, 10),
      range: text("short"),
      qualities: text(),
      scale: text("personal"),
      soak: number(),
      defense: number(0, 4),
      rank: number(1, 100),
      ranked: bool(),
      activation: text(),
      career: text(),
      careerSkills: list(),
      forceRating: number(0, 10),
      universal: bool(),
      grantedForceRating: number(0, 10),
      eligibleCareers: list(),
      abilityCategory: text(),
      matchingNodes: new f.ArrayField(bool(), { initial: [] }),
      linkedSpecializationId: text(),
      tree: new f.ObjectField({
        initial: { nodes: [], edges: [], verified: false },
      }),
      source: source(),
      metadata: new f.ObjectField({ initial: {} }),
      incomplete: list(),
    };
  }
}
