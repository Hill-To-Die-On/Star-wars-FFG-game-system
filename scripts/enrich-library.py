"""Read a private OggDude-style dataset as data; import names, graphs and statistics only.
Never copy descriptions, illustrations, or source files into the public package.
"""
import argparse, copy, hashlib, json, re, xml.etree.ElementTree as ET
from pathlib import Path

def norm(value):
    text = str(value).lower().replace("&", "and").replace("duellist", "duelist").replace("beserker", "berserker").replace("specialisation", "specialization")
    return re.sub(r"[^a-z0-9]", "", text)

def book_key(value):
    text = str(value).lower().replace("&", "and")
    for token in ["edge of the empire", "age of rebellion", "force and destiny", "core rulebook", "core book"]:
        text = text.replace(token, {"edge of the empire":"eote", "age of rebellion":"aor", "force and destiny":"fad", "core rulebook":"core", "core book":"core"}[token])
    text = re.sub(r"\([^)]*\)", "", text).replace("ffg -", "")
    return norm(text)

def read_xml(path):
    text = path.read_text(encoding="utf-8-sig")
    if "<!DOCTYPE" in text or "<!ENTITY" in text:
        raise ValueError("DTD and external entities are not supported")
    return ET.fromstring(text)

def text(el, key, default=""):
    return el.findtext(key, default=default).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("pdf_root", type=Path)
    parser.add_argument("--catalog", type=Path, default=Path(".local/catalog.json"))
    args = parser.parse_args()
    if ".local" not in args.catalog.parts:
        raise ValueError("The catalog must be in an ignored .local directory")
    bundle = json.loads(args.catalog.read_text(encoding="utf-8"))
    talents = {}
    for el in read_xml(args.dataset / "Talents.xml"):
        key = text(el, "Key")
        if key:
            talents[key] = {"name":text(el,"Name"), "ranked":text(el,"Ranked").lower()=="true"}
    # Key aliases verified against names in the supplied talent catalogue.
    for old,new in {"VAAPADCON":"VAAPADCONT","ACKLAY":"ACKLAYSCST","ALCHARTS":"ALCARTS","SIDESIDE":"SIDEBYSIDE"}.items():
        if new in talents: talents[old]=talents[new]
    skills_file = args.dataset / "Skills.xml"
    skill_names = {text(el,"Key"):text(el,"Name") for el in read_xml(skills_file)} if skills_file.exists() else {}
    skill_ids = {"ASTRO":"astrogation","ATHL":"athletics","BRAWL":"brawl","CHARM":"charm","COERC":"coercion","COMP":"computers","COOL":"cool","COORD":"coordination","DECEP":"deception","DISC":"discipline","GUNN":"gunnery","LEAD":"leadership","LTSABER":"lightsaber","MECH":"mechanics","MED":"medicine","MELEE":"melee","NEG":"negotiation","PERC":"perception","PILOTPL":"pilotingPlanetary","PILOTSP":"pilotingSpace","RANGLT":"rangedLight","RANGHVY":"rangedHeavy","RESIL":"resilience","SKUL":"skulduggery","STEAL":"stealth","STREET":"streetwise","SURV":"survival","VIGIL":"vigilance","CORE":"coreWorlds","EDU":"education","LORE":"lore","OUTER":"outerRim","UND":"underworld","WAR":"warfare","XEN":"xenology"}
    canonical = ["astrogation","athletics","brawl","charm","coercion","computers","cool","coordination","deception","discipline","gunnery","leadership","lightsaber","mechanics","medicine","melee","negotiation","perception","pilotingPlanetary","pilotingSpace","rangedLight","rangedHeavy","resilience","skulduggery","stealth","streetwise","survival","vigilance","coreWorlds","education","lore","outerRim","underworld","warfare","xenology"]
    for key,name in skill_names.items():
        cleaned=norm(name).replace("knowledge", "")
        for candidate in canonical:
            if norm(candidate)==cleaned: skill_ids[key]=candidate
    pdfs = [p for p in args.pdf_root.rglob("*.pdf") if "Map Assets" not in str(p)]
    def match_pdf(book):
        key=book_key(book)
        matches=[p for p in pdfs if book_key(p.stem)==key]
        if not matches:
            # Some database book names include a rule-line prefix absent from the filename.
            stripped=re.sub(r"^(?:eote|aor|fad)","",key)
            if stripped!="core": matches=[p for p in pdfs if re.sub(r"^(?:eote|aor|fad)","",book_key(p.stem))==stripped]
        return matches
    specs={norm(i["name"]):i for i in bundle["documents"]["Item"] if i["type"]=="specialization"}
    coverage=[]; matched=set(); imported=0
    for path in sorted((args.dataset/"Specializations").glob("*.xml")):
        el=read_xml(path); name=text(el,"Name"); key=norm(name)
        targets=[i for i in specs.values() if norm(re.sub(r"\s+\([^)]*\)$", "", i["name"]))==key]
        item=targets[0] if targets else specs.get(key)
        sources=el.findall("Source")
        book=(sources[0].text or "").strip() if sources else ""
        page=sources[0].get("Page","") if sources else ""
        if not item:
            item={"_id":hashlib.sha256(f"specialization:{text(el,'Key')}".encode()).hexdigest()[:16],"name":name,"type":"specialization","img":"systems/star-wars-ffg/assets/item.svg","system":{"source":{"book":book,"page":page,"table":"specializations-xml","id":text(el,"Key")},"metadata":{},"careerSkills":[]},"flags":{"star-wars-ffg":{"importKey":f"specialization:{text(el,'Key')}"}}}
            bundle["documents"]["Item"].append(item)
        for target in targets or [item]: matched.add(norm(target["name"]))
        if not book: book=item["system"]["source"]["book"]
        if not page: page=item["system"]["source"]["page"]
        nodes=[]; edges=set(); errors=[]; rows=el.findall("TalentRows/TalentRow")
        directions=[]
        for row_index,row in enumerate(rows):
            keys=row.findall("Talents/Key"); ds=row.findall("Directions/Direction")
            if len(keys)!=4 or len(ds)!=4: errors.append("Non-standard row width")
            for col,k in enumerate(keys):
                talent=talents.get(k.text)
                if not talent: errors.append(f"Missing talent name: {k.text}"); talent={"name":k.text,"ranked":True}
                nodes.append({"id":f"r{row_index}c{col}","name":talent["name"],"key":k.text,"ranked":talent["ranked"],"cost":int(text(row,"Cost","0")),"row":row_index,"col":col,"entry":row_index==0})
            directions.append(ds)
        for r,ds in enumerate(directions):
            for c,d in enumerate(ds):
                for direction,dr,dc,reverse in [("Right",0,1,"Left"),("Left",0,-1,"Right"),("Down",1,0,"Up"),("Up",-1,0,"Down")]:
                    if text(d,direction)!="true": continue
                    rr,cc=r+dr,c+dc
                    if not(0<=rr<len(rows) and 0<=cc<4): errors.append("Out-of-bounds link"); continue
                    if text(directions[rr][cc],reverse)!="true": errors.append(f"Asymmetric link {r},{c} {direction}")
                    edges.add(tuple(sorted((f"r{r}c{c}",f"r{rr}c{cc}"))))
        # Four one-sided dataset links were checked visually against the held charts.
        # The three removed links have no printed connector. Sharpshooter has one.
        compared={"Ambassador":("r3c2","r4c2"),"Scoundrel":("r3c1","r4c1"),"Protector":("r3c0","r4c0"),"Sharpshooter":None}
        if name in compared:
            if compared[name]: edges.discard(tuple(sorted(compared[name])))
            errors=[e for e in errors if not e.startswith("Asymmetric link")]
        verified=len(nodes)==20 and len(rows)==5 and not errors
        item["system"]["tree"]={"nodes":nodes,"edges":[list(e) for e in sorted(edges)],"verified":verified,"provenance":"Structured graph with PDF connector correction" if name in compared else "Private structured dataset; graph validated, PDF comparison pending","source":{"book":book,"page":page}}
        item["system"]["incomplete"]=[] if verified else errors or ["Missing graph"]
        keys=[k.text for k in el.findall("CareerSkills/Key")]
        item["system"]["careerSkills"]=[skill_ids[k] for k in keys if k in skill_ids]
        item["system"]["universal"]=text(el,"Universal")=="true"
        item["system"]["grantedForceRating"]=int(text(el,"Attributes/ForceRating","0"))
        if len(item["system"]["careerSkills"])!=len(keys): errors.append("Unmapped career skills")
        for target in targets or [item]:
            for field in ["tree", "incomplete", "careerSkills", "universal", "grantedForceRating"]: target["system"][field]=copy.deepcopy(item["system"][field])
            target_book=target["system"]["source"]["book"] or book
            target_page=target["system"]["source"]["page"] or page
            matches=match_pdf(target_book)
            standalone=[p for p in pdfs if re.sub(r"^(?:eote|aor|fad)","",book_key(p.stem))==norm(name)]
            coverage.append({"specialization":target["name"],"career":target["system"].get("career",""),"book":target_book,"page":target_page,"pdf":bool(matches),"pdfFile":matches[0].name if matches else "","standaloneChart":standalone[0].name if standalone else "","graph":"imported" if verified else "needs review","nodes":len(nodes),"links":len(edges),"issues":errors,"pdfCompared":name in compared})
            imported+=int(verified)
    for key,item in specs.items():
        if key in matched: continue
        ref=item["system"]["source"]
        matches=match_pdf(ref["book"])
        coverage.append({"specialization":item["name"],"career":item["system"].get("career",""),"book":ref["book"],"page":ref["page"],"pdf":bool(matches),"pdfFile":matches[0].name if matches else "","graph":"missing","nodes":0,"links":0,"issues":["No structured chart found"],"pdfCompared":False})
    # Fill vehicle statistics only on an exact normalized name match.
    vehicles={norm(text(read_xml(p),"Name")):p for p in (args.dataset/"Vehicles").glob("*.xml")}
    enriched=0
    for item in bundle["documents"]["Actor"]:
        path=vehicles.get(norm(item["name"]))
        if not path: continue
        el=read_xml(path); system=item["system"]
        mapping={"armor":"Armor","silhouette":"Silhouette","handling":"Handling"}
        required=[*mapping.values(),"HullTrauma","SystemStrain","Speed"]
        if any(not re.fullmatch(r"-?\d+",text(el,k)) for k in required): continue
        for field,key in mapping.items(): system[field]=int(text(el,key))
        system.update({"hullTrauma":{"value":0,"max":int(text(el,"HullTrauma"))},"systemStrain":{"value":0,"max":int(text(el,"SystemStrain"))},"speed":{"value":0,"max":int(text(el,"Speed"))},"shields":{side:int(text(el,key,"0")) for side,key in [("fore","DefFore"),("aft","DefAft"),("port","DefPort"),("starboard","DefStarboard")]},"incomplete":[]})
        system["metadata"]["statProvenance"]="Private structured dataset; compare with printed source"
        enriched+=1
    coverage.sort(key=lambda row:(row["book"],row["specialization"]))
    args.catalog.write_text(json.dumps(bundle,ensure_ascii=False,indent=2),encoding="utf-8")
    report={"charts":coverage,"graphsImported":imported,"vehiclesEnriched":enriched,"pdfsInventoried":len(pdfs)}
    Path(".local/source-coverage.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    Path("docs").mkdir(exist_ok=True)
    missing=[r for r in coverage if not r["pdf"]]
    lines=["# Specialization source coverage", "", "Generated from the locally supplied SQL and structured dataset. No book text or artwork is included.", "", f"{len(coverage)} specialization references; {imported} structurally validated graphs; {enriched} vehicles with matching structured statistics.", "", "A structurally validated graph is usable for XP path checks; it is not a claim that every node has been compared against the printed book. Four connector discrepancies have been checked against held PDF charts; complete node-by-node comparisons remain pending.", "", "## Photo request register", "", "These source PDFs were not found by normalized book title. A full, straight-on image of each listed chart, with all four columns, five rows, connecting lines and page number visible, will let the chart be checked. Include adjacent creation/exception rules only where the chart references them. Structured graphs may already be available, as shown.", "", "| Book | Printed page | Specialization | Graph |", "|---|---|---|---|"]
    lines += [f"| {r['book']} | {r['page'] or 'Check index'} | {r['specialization']} | {r['graph']}{'; standalone chart PDF found' if r.get('standaloneChart') else ''} |" for r in missing]
    if not missing: lines.append("| None identified | | | |")
    lines += ["", "## Complete register", "", "| Specialization | Book | Page | PDF present | Graph | PDF comparison |", "|---|---|---|---|---|---|"]
    lines += [f"| {r['specialization']} | {r['book']} | {r['page']} | {'Yes' if r['pdf'] else 'No'} | {r['graph']} | {'Connector correction checked' if r['pdfCompared'] else 'Pending'} |" for r in coverage]
    lines += ["", "## Coverage limits", "", "The register covers the supplied databases, not a verified complete publication bibliography. A present PDF can still have missing or unreadable pages. Expansion crafting, mass combat, squadron, Force-power and signature-ability exceptions need their own reference validation; no blanket claim of complete rules automation is made.", ""]
    Path("docs/source-coverage.md").write_text("\n".join(lines),encoding="utf-8")
    print(json.dumps({"graphsImported":imported,"charts":len(coverage),"missingPDFs":len(missing),"vehiclesEnriched":enriched,"unresolvedGraphs":[r["specialization"] for r in coverage if r["graph"]!="imported"]},indent=2))

if __name__=="__main__": main()
