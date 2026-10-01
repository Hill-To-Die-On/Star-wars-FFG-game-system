"""Publish copyright-bounded vehicle statistics from local structured XML.

Only numeric mechanics, names, stable keys and book/page references leave the
local source collection. Descriptions, artwork and filesystem paths are never
written to the public output.
"""

import argparse
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


FORMAT = "star-wars-ffg-vehicle-stats"
PRIVATE_OVERRIDE_FORMAT = "star-wars-ffg-private-vehicle-overrides"
BOUNDARY = (
    "Numeric vehicle mechanics and source references only; descriptions, "
    "artwork and private paths are excluded."
)
REQUIRED = ["Armor", "Silhouette", "Handling", "HullTrauma", "SystemStrain", "Speed"]
SHIELDS = {
    "fore": "DefFore",
    "aft": "DefAft",
    "port": "DefPort",
    "starboard": "DefStarboard",
}
STAT_FIELDS = [
    "armor",
    "handling",
    "hullTrauma",
    "shields",
    "silhouette",
    "speed",
    "systemStrain",
]
EVIDENCE_FIELDS = [
    ("Price", "Price", "price"),
    ("Rarity", "Rarity", "rarity"),
    ("HP", "HP", "hardpoints"),
    ("Passengers", "Passengers", "passengers"),
    ("Primary_Hyperdrive", "HyperdrivePrimary", "hyperdrive"),
    ("Encumbrance", "EncumbranceCapacity", "encumbrance"),
    ("Restricted", "Restricted", "restricted"),
]
SPELLING = {
    "armoured": "armored",
    "maurauder": "marauder",
    "moble": "mobile",
    "munificient": "munificent",
    "netron": "neutron",
    "pathfiner": "pathfinder",
    "preator": "praetor",
    "prsonal": "personal",
    "sealth": "stealth",
    "tole": "role",
    "ventaor": "venator",
}


def normalized(value):
    value = str(value or "").lower().replace("&", "and")
    for source, replacement in SPELLING.items():
        value = value.replace(source, replacement)
    return re.sub(r"[^a-z0-9]+", "", value)


def book_key(value):
    value = str(value or "").lower().replace("&", " and ")
    value = re.sub(r"\([^)]*\)", " ", value).replace("stongholds", "strongholds")
    value = re.sub(
        r"^(?:star wars\s*)?(?:edge of (?:the )?empire|age of rebellion|force and destiny)\s*[-:]?\s*",
        "",
        value,
    )
    return normalized(
        value.replace("core rulebook", "core")
        .replace("core book", "core")
        .replace("ffg -", "")
    )


def xml_text(element, key, default=""):
    node = element.find(key)
    return (node.text or "").strip() if node is not None else default


def read_xml(path):
    raw = path.read_text(encoding="utf-8-sig")
    if "<!DOCTYPE" in raw or "<!ENTITY" in raw:
        raise ValueError("DTD and external entities are not supported")
    return ET.fromstring(raw.lstrip())


def integer(value, field):
    value = str(value).strip()
    if not re.fullmatch(r"-?\d+", value):
        raise ValueError(f"{field} must be an integer")
    return int(value)


def source_reference(book, page):
    return {"book": str(book or "").strip(), "page": str(page or "").strip()}


def validate_source_reference(source, label):
    if set(source or {}) != {"book", "page"}:
        raise ValueError(f"{label} must contain book and page")
    book = source.get("book")
    page = source.get("page")
    if (
        not isinstance(book, str)
        or not book.strip()
        or len(book) > 200
        or re.search(r"(?:[a-z]:[\\/]|(?:^|[\\/])\.\.(?:[\\/]|$)|\.(?:xml|pdf)\b)", book, re.I)
    ):
        raise ValueError(f"{label} has an invalid book")
    if not isinstance(page, str) or len(page) > 20 or (page and not re.fullmatch(r"\d+(?:[-–]\d+)?", page)):
        raise ValueError(f"{label} has an invalid printed page")
    return source


def validate_stats(stats, label):
    if set(stats) != set(STAT_FIELDS):
        raise ValueError(f"{label} must contain exactly the seven vehicle stat fields")
    limits = {
        "hullTrauma": (0, 100000),
        "systemStrain": (0, 100000),
        "armor": (0, 100000),
        "silhouette": (0, 20),
        "speed": (0, 20),
        "handling": (-10, 10),
    }
    for field, (minimum, maximum) in limits.items():
        value = stats[field]
        if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
            raise ValueError(f"{label} has an invalid {field}")
    shields = stats["shields"]
    if set(shields or {}) != set(SHIELDS):
        raise ValueError(f"{label} must contain every shield facing")
    for side, value in shields.items():
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 4:
            raise ValueError(f"{label} has an invalid {side} shield value")
    return stats


def load_private_overrides(path, rows):
    if not any(part.lower() == ".local" for part in path.resolve().parts):
        raise ValueError("Private vehicle overrides must stay below .local")
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("format") != PRIVATE_OVERRIDE_FORMAT or data.get("version") != 1:
        raise ValueError("Unsupported private vehicle override file")
    if set(data) != {"format", "version", "vehicles"} or not isinstance(data["vehicles"], dict):
        raise ValueError("Private vehicle overrides have an invalid structure")
    rows_by_id = {str(row.get("ID")): row for row in rows}
    overrides = {}
    for record_id, override in data["vehicles"].items():
        row = rows_by_id.get(str(record_id))
        if row is None:
            raise ValueError(f"Unknown private vehicle override {record_id}")
        allowed = {"databaseName", "source", "stats", "reason", "sourceReferences"}
        if not set(override) <= allowed or not {"databaseName", "source"} <= set(override):
            raise ValueError(f"Private vehicle override {record_id} has invalid fields")
        if ("stats" in override) == ("reason" in override):
            raise ValueError(f"Private vehicle override {record_id} must contain stats or reason")
        expected_source = source_reference(row.get("Book"), row.get("Page"))
        if override.get("databaseName") != row.get("Name") or override.get("source") != expected_source:
            raise ValueError(f"Private vehicle override identity changed: {record_id}")
        if "stats" in override:
            validate_stats(override["stats"], f"Private vehicle override {record_id}")
            references = override.get("sourceReferences", [expected_source])
            if not isinstance(references, list) or not references:
                raise ValueError(f"Private vehicle override {record_id} needs source references")
            for index, source in enumerate(references):
                validate_source_reference(source, f"Private vehicle override {record_id} source {index + 1}")
            if expected_source not in references:
                raise ValueError(f"Private vehicle override {record_id} must cite its database source")
            override["sourceReferences"] = references
        elif override.get("reason") != "printed source has partial profile":
            raise ValueError(f"Private vehicle override {record_id} has an unsupported reason")
        elif "sourceReferences" in override:
            raise ValueError(f"Partial vehicle override {record_id} cannot publish stat evidence")
        overrides[str(record_id)] = override
    return overrides


def load_candidates(dataset_roots):
    candidates = defaultdict(list)
    for dataset_root in dataset_roots:
        vehicle_root = dataset_root / "Vehicles"
        if not vehicle_root.is_dir():
            vehicle_root = dataset_root
        if not vehicle_root.is_dir():
            raise ValueError("Each dataset path must contain a Vehicles directory")
        for path in sorted(vehicle_root.glob("*.xml")):
            element = read_xml(path)
            if any(
                not re.fullmatch(r"-?\d+", xml_text(element, field))
                for field in REQUIRED
            ):
                continue
            source = element.find("Source")
            name = xml_text(element, "Name")
            if not name:
                continue
            stats = {
                "hullTrauma": integer(xml_text(element, "HullTrauma"), "HullTrauma"),
                "systemStrain": integer(xml_text(element, "SystemStrain"), "SystemStrain"),
                "armor": integer(xml_text(element, "Armor"), "Armor"),
                "silhouette": integer(xml_text(element, "Silhouette"), "Silhouette"),
                "speed": integer(xml_text(element, "Speed"), "Speed"),
                "handling": integer(xml_text(element, "Handling"), "Handling"),
                "shields": {
                    side: integer(xml_text(element, field, "0"), field)
                    for side, field in SHIELDS.items()
                },
            }
            record = {
                "name": name,
                "key": xml_text(element, "Key") or name,
                "source": source_reference(
                    (source.text or "") if source is not None else "",
                    source.get("Page", "") if source is not None else "",
                ),
                "stats": stats,
                "fields": {
                    field: xml_text(element, field)
                    for _, field, _ in EVIDENCE_FIELDS
                },
            }
            candidates[normalized(name)].append(record)
    return candidates


def stat_signature(candidate):
    stats = candidate["stats"]
    return (
        stats["hullTrauma"],
        stats["systemStrain"],
        stats["armor"],
        stats["silhouette"],
        stats["speed"],
        stats["handling"],
        *(stats["shields"][side] for side in SHIELDS),
    )


def evidence_for(database_row, candidates, method):
    database_book = book_key(database_row.get("Book"))
    database_page = str(database_row.get("Page") or "")
    comparisons = []
    for candidate in candidates:
        matched = {"name"} if method == "exact-name" else set()
        conflicting = set()
        if database_book and database_book == book_key(candidate["source"]["book"]):
            matched.add("book")
            if database_page and database_page == candidate["source"]["page"]:
                matched.add("page")
        for database_field, dataset_field, label in EVIDENCE_FIELDS:
            left = str(database_row.get(database_field) or "").strip().lower()
            right = str(candidate["fields"].get(dataset_field) or "").strip().lower()
            if not left or not right:
                continue
            if left == right:
                matched.add(label)
            else:
                conflicting.add(label)
        comparisons.append((matched, conflicting, candidate))
    matched, conflicting, best_candidate = max(
        comparisons,
        key=lambda comparison: (
            len(comparison[0]) - len(comparison[1]),
            "page" in comparison[0],
            len(comparison[0]),
        ),
    )
    if method == "reviewed-alias":
        database_name = normalized(database_row.get("Name"))
        dataset_name = normalized(best_candidate["name"])
        similarity = SequenceMatcher(None, database_name, dataset_name).ratio()
        contained = database_name in dataset_name or dataset_name in database_name
        corroborated = any(
            ({"book", "page"} <= candidate_matched and len(candidate_matched - {"book", "page"}) >= 2 and len(candidate_conflicting) <= 1)
            or (len(candidate_matched) >= 5 and not candidate_conflicting)
            or (contained and len(candidate_matched) >= 3 and not candidate_conflicting)
            or (similarity >= 0.8 and len(candidate_matched) >= 4 and not candidate_conflicting)
            for candidate_matched, candidate_conflicting, _ in comparisons
        )
        if not corroborated:
            raise ValueError(
                f"Reviewed alias lacks corroborating fields: {database_row.get('Name')}"
            )
    sources = {
        (candidate["source"]["book"], candidate["source"]["page"])
        for candidate in candidates
        if candidate["source"]["book"]
    }
    sources.add((str(database_row.get("Book") or ""), database_page))
    return {
        "method": method,
        "datasetNames": sorted({candidate["name"] for candidate in candidates}),
        "datasetKeys": sorted({candidate["key"] for candidate in candidates}),
        "structuredSources": [
            source_reference(book, page)
            for book, page in sorted(sources)
            if book
        ],
        "matchedFields": sorted(matched or {"reviewed alias"}),
    }


def page_sort(value):
    match = re.match(r"\d+", str(value))
    return int(match.group()) if match else 10**9


def coverage_markdown(output):
    methods = Counter(record["evidence"]["method"] for record in output["records"])
    reasons = Counter(record["reason"] for record in output["unresolved"])
    books = Counter(record["source"]["book"] for record in output["unresolved"])
    lines = [
        "# Vehicle source coverage",
        "",
        "The public vehicle overlay contains only numeric mechanics and book/page references. Local XML descriptions, artwork and filesystem paths are excluded.",
        "",
        f"{output['report']['matched']} of {output['report']['databaseVehicles']} database vehicles have a verified complete stat profile. {output['report']['unresolved']} remain incomplete, including {output['report']['conflicts']} records with conflicting structured profiles that require a printed-page check.",
        "",
        f"The complete profiles comprise {methods['exact-name']} exact structured matches, {methods['reviewed-alias']} reviewed aliases and {methods['printed-page']} profiles checked directly against held printed pages. The unresolved set comprises {reasons['no complete structured record']} missing profiles, {reasons['conflicting structured records']} conflicts and {reasons['printed source has partial profile']} partial printed profile.",
        "",
        "## Missing authoritative sources",
        "",
        "| Book | Profiles still needed |",
        "|---|---:|",
    ]
    for book, count in sorted(books.items()):
        lines.append(f"| {book.replace('|', '\\|')} | {count} |")
    lines.extend([
        "",
        "Every unresolved row except the Foot Speeder needs a complete printed stat block from a book that is not fully available in the held PDF library. The held Endless Vigil page gives only part of the Foot Speeder profile, so that record needs another authoritative complete profile or an explicit GM ruling rather than another copy of the same page.",
        "",
        "## Requested profiles",
        "",
        "A row is a precise request for the authoritative stat block. Repeated pages indicate more than one vehicle on that page.",
        "",
        "| Vehicle | Book | Printed page | Reason |",
        "|---|---|---:|---|",
    ])
    for record in sorted(
        output["unresolved"],
        key=lambda entry: (
            entry["source"]["book"],
            page_sort(entry["source"]["page"]),
            entry["name"],
        ),
    ):
        lines.append(
            f"| {record['name'].replace('|', '\\|')} | {record['source']['book'].replace('|', '\\|')} | {record['source']['page'] or '—'} | {record['reason']} |"
        )
    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("datasets", type=Path, nargs="+")
    parser.add_argument("--database", type=Path, default=Path("data/reference-database.json"))
    parser.add_argument("--library", type=Path, default=Path("data/reference-library.json"))
    parser.add_argument("--aliases", type=Path, default=Path("data/vehicle-stat-aliases.json"))
    parser.add_argument(
        "--private-overrides",
        type=Path,
        default=Path(".local/vehicle-source-overrides.json"),
        help="Ignored numeric profiles transcribed from held printed source pages.",
    )
    parser.add_argument("--output", type=Path, default=Path("data/vehicle-stats.json"))
    parser.add_argument("--coverage", type=Path, default=Path("docs/vehicle-source-coverage.md"))
    args = parser.parse_args()

    database = json.loads(args.database.read_text(encoding="utf-8"))
    library = json.loads(args.library.read_text(encoding="utf-8"))
    aliases = json.loads(args.aliases.read_text(encoding="utf-8"))
    if aliases.get("format") != "star-wars-ffg-vehicle-stat-aliases" or aliases.get("version") != 1:
        raise ValueError("Unsupported vehicle alias file")
    rows = database["tables"]["vehicles"]
    private_overrides = load_private_overrides(args.private_overrides, rows)
    actors = {
        str(actor["system"]["source"]["id"]): actor
        for actor in library["documents"]["Actor"]
        if actor.get("type") == "vehicle"
    }
    if len(rows) != len(actors):
        raise ValueError("Vehicle database and native actor identities differ")
    alias_by_id = {}
    for alias in aliases["matches"]:
        record_id = str(alias["recordId"])
        if record_id in alias_by_id:
            raise ValueError(f"Duplicate vehicle alias {record_id}")
        row = next((row for row in rows if str(row.get("ID")) == record_id), None)
        if row is None or row.get("Name") != alias.get("databaseName"):
            raise ValueError(f"Vehicle alias identity changed: {record_id}")
        alias_by_id[record_id] = alias

    candidates = load_candidates(args.datasets)
    records = []
    unresolved = []
    used_aliases = set()
    used_overrides = set()
    for row in rows:
        record_id = str(row.get("ID"))
        actor = actors[record_id]
        override = private_overrides.get(record_id)
        source = source_reference(row.get("Book"), row.get("Page"))
        base = {"_id": actor["_id"], "name": actor["name"], "source": source}
        if override:
            used_overrides.add(record_id)
            if "stats" in override:
                records.append(
                    {
                        **base,
                        "stats": override["stats"],
                        "evidence": {
                            "method": "printed-page",
                            "sourceReferences": override["sourceReferences"],
                            "matchedFields": STAT_FIELDS,
                        },
                    }
                )
            else:
                unresolved.append({**base, "reason": override["reason"]})
            continue
        alias = alias_by_id.get(record_id)
        method = "reviewed-alias" if alias else "exact-name"
        target_name = alias["datasetName"] if alias else row.get("Name")
        matches = candidates.get(normalized(target_name), [])
        signatures = {stat_signature(candidate) for candidate in matches}
        if not matches:
            unresolved.append({**base, "reason": "no complete structured record"})
            continue
        if len(signatures) != 1:
            unresolved.append({**base, "reason": "conflicting structured records"})
            continue
        evidence = evidence_for(row, matches, method)
        records.append(
            {
                **base,
                "stats": matches[0]["stats"],
                "evidence": evidence,
            }
        )
        if alias:
            used_aliases.add(record_id)
    unused_aliases = sorted(set(alias_by_id) - used_aliases)
    if unused_aliases:
        raise ValueError(f"Unused vehicle aliases: {unused_aliases}")
    unused_overrides = sorted(set(private_overrides) - used_overrides)
    if unused_overrides:
        raise ValueError(f"Unused private vehicle overrides: {unused_overrides}")

    output = {
        "format": FORMAT,
        "version": 1,
        "boundary": BOUNDARY,
        "records": sorted(records, key=lambda record: record["name"]),
        "unresolved": sorted(unresolved, key=lambda record: record["name"]),
    }
    output["report"] = {
        "databaseVehicles": len(rows),
        "matched": len(records),
        "unresolved": len(unresolved),
        "conflicts": sum(
            record["reason"] == "conflicting structured records"
            for record in unresolved
        ),
    }
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    args.coverage.write_text(coverage_markdown(output), encoding="utf-8")
    print(json.dumps(output["report"], indent=2))


if __name__ == "__main__":
    main()
