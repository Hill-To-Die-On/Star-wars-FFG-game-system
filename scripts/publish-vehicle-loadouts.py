"""Publish mechanical vehicle loadout candidates; only page-reviewed records auto-equip.

Local XML and private review files are inputs, never release artefacts. Empty
weapon lists in unreviewed datasets do not establish that a vehicle is unarmed.
"""
import argparse
import importlib.util
import json
import re
from collections import defaultdict
from pathlib import Path

spec = importlib.util.spec_from_file_location("vehicle_stats", Path(__file__).with_name("publish-vehicle-stats.py"))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
read_xml, txt = helpers.read_xml, helpers.xml_text


def book(value):
    value = re.sub(r"\([^)]*\)", "", value).lower().replace("&", "and").replace("stongholds", "strongholds")
    value = value.replace("core rulebook", "core").replace("core book", "core")
    if "core" not in value:
        value = re.sub(r"^(?:edge of (?:the )?empire|age of rebellion|force and destiny)\s*[-:]?\s*", "", value)
    return helpers.normalized(value)


def numeric(value, default=None):
    if value == "" and default is not None: return default
    if not re.fullmatch(r"\d+", value): raise ValueError("unresolved numeric weapon field")
    return int(value)


def weapon_mount(element, index, weapons, descriptors):
    key = txt(element, "Key")
    base = weapons.get(key)
    if base is None: raise ValueError("missing base weapon")
    qualities = {}
    for parent in [base, element]:
        for quality in parent.findall("./Qualities/Quality"):
            qkey = txt(quality, "Key")
            if qkey not in descriptors: raise ValueError("unknown weapon quality")
            qualities[qkey] = {"name": descriptors[qkey], "rank": numeric(txt(quality, "Count"), 0)}
    location = txt(element, "Location").lower()
    location = {"forward": "fore", "rear": "aft"}.get(location, location)
    if location not in ["fore", "aft", "port", "starboard", "dorsal", "ventral"]:
        location = "dorsal" if txt(element, "FiringArcs/Dorsal") == "true" else "ventral" if txt(element, "FiringArcs/Ventral") == "true" else "unspecified"
    arcs = [k.lower() for k in ["Fore", "Aft", "Port", "Starboard"] if txt(element, f"FiringArcs/{k}") == "true"]
    if not arcs: raise ValueError("missing weapon arcs")
    skill = {"GUNN": "gunnery", "RANGHVY": "rangedHeavy", "RANGLT": "rangedLight"}.get(txt(base, "SkillKey"))
    if not skill: raise ValueError("unknown weapon skill")
    # Missing damage/critical is not assumed to mean zero (tractor profiles need review).
    return {"key": f"{index + 1}-{key.lower()}", "name": txt(base, "Name"),
      "count": numeric(txt(element, "Count"), 1), "location": location, "arcs": arcs,
      "damage": numeric(txt(base, "Damage")), "critical": numeric(txt(base, "Crit")),
      "range": txt(base, "RangeValue").removeprefix("wr").lower(),
      "scale": "personal" if txt(base, "Scale") == "wsPersonal" else "vehicle", "skill": skill,
      "qualities": sorted(qualities.values(), key=lambda q: q["name"])}


def systems(element):
    result = {}
    sensor = txt(element, "SensorRange").lower()
    if sensor in ["close", "short", "medium", "long", "extreme"]: result["sensorRange"] = sensor
    backup = txt(element, "HyperdriveBackup")
    if re.fullmatch(r"\d+(?:\.\d+)?", backup) and float(backup) > 0: result["backupHyperdrive"] = float(backup)
    if txt(element, "NaviComputer") == "true": result["navigation"] = "navcomputer"
    duration = txt(element, "Consumables").lower()
    numbers = {"one":"1", "two":"2", "three":"3", "four":"4", "five":"5", "six":"6", "seven":"7", "eight":"8", "nine":"9", "ten":"10"}
    for word, digit in numbers.items(): duration = re.sub(rf"\b{word}\b", digit, duration)
    if re.fullmatch(r"\d+(?:\.\d+)? (?:hours?|days?|weeks?|months?|years?)", duration): result["consumables"] = duration
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("datasets", nargs="+")
    parser.add_argument("--reviews", default=".local/vehicle-loadout-reviews.json")
    args = parser.parse_args()
    database = json.loads(Path("data/reference-database.json").read_text(encoding="utf-8"))
    stat_data = json.loads(Path("data/vehicle-stats.json").read_text(encoding="utf-8"))
    candidates = defaultdict(list)
    failures = defaultdict(set)
    for dataset in args.datasets:
        root = Path(dataset)
        weapons = {txt(e, "Key"): e for e in read_xml(root / "Weapons.xml")}
        descriptors = {txt(e, "Key"): txt(e, "Name").removesuffix(" Quality") for e in read_xml(root / "ItemDescriptors.xml") if txt(e, "IsQuality") == "true"}
        for path in sorted((root / "Vehicles").glob("*.xml")):
            element = read_xml(path)
            identity = txt(element, "Key")
            refs = [(book(s.text or ""), s.get("Page", "")) for s in element.findall(".//Source")]
            try:
                mounts = [weapon_mount(w, i, weapons, descriptors) for i, w in enumerate(element.findall("./VehicleWeapons/VehicleWeapon"))]
                candidates[identity].append({"refs": refs, "weapons": mounts, "systems": systems(element)})
            except ValueError as exc:
                failures[identity].add(str(exc))
    reviewed_path = Path(args.reviews)
    if ".local" not in reviewed_path.resolve().parts: raise ValueError("Private source reviews must stay under .local")
    reviewed = json.loads(reviewed_path.read_text(encoding="utf-8")) if reviewed_path.exists() else {"records": []}
    reviews = {str(r["vehicleId"]): r for r in reviewed["records"]}
    records, pending = [], []
    for row in database["tables"]["vehicles"]:
        rid = str(row["ID"])
        source = {"book": row["Book"], "page": str(row["Page"])}
        if rid in reviews:
            review = reviews[rid]
            if review["name"] != row["Name"] or review["source"] != source or review["method"] != "printed-page":
                raise ValueError(f"Reviewed vehicle identity changed: {rid}")
            records.append(review)
            continue
        stat = next((r for r in stat_data["records"] if r["name"] == row["Name"] and r["source"] == source), {})
        keys = stat.get("evidence", {}).get("datasetKeys", [])
        same = [c for k in keys for c in candidates[k] if (book(row["Book"]), str(row["Page"])) in c["refs"]]
        signatures = {json.dumps(c["weapons"], sort_keys=True) for c in same}
        if len(signatures) != 1:
            pending.append({"id":rid, "name":row["Name"], "source":source,
              "reason": "conflicting loadout candidates" if signatures else "no complete candidate at the cited source"})
            continue
        consensus = {}
        for field in ["sensorRange", "backupHyperdrive", "navigation", "consumables"]:
            values = {c["systems"][field] for c in same if field in c["systems"]}
            if len(values) == 1: consensus[field] = next(iter(values))
        records.append({"vehicleId":rid, "name":row["Name"], "source":source, "method":"structured-source",
          "weapons":same[0]["weapons"], "systems":consensus})
    if set(reviews) - {str(row["ID"]) for row in database["tables"]["vehicles"]}: raise ValueError("Unknown reviewed vehicle identity")
    output = {"format":"star-wars-ffg-vehicle-loadouts", "version":1, "records":records}
    Path("data/vehicle-loadouts.json").write_text(json.dumps(output, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    Path(".local/vehicle-loadout-pending.json").write_text(json.dumps(pending, indent=2),encoding="utf-8")
    print(json.dumps({"records":len(records),"reviewed":len(reviews),"pending":len(pending),"mounts":sum(len(r['weapons']) for r in records)}))


if __name__ == "__main__": main()
