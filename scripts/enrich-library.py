"""Build an ignored private catalogue from a locally held structured dataset.
Descriptions can be added to this local file for play, but never enter the public package.
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
    return ET.fromstring(text.lstrip())

def text(el, key, default=""):
    return el.findtext(key, default=default).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("pdf_root", type=Path)
    parser.add_argument("--catalog", type=Path, default=Path(".local/catalog.json"))
    parser.add_argument("--include-private-talent-text", action="store_true")
    args = parser.parse_args()
    if ".local" not in args.catalog.parts:
        raise ValueError("The catalog must be in an ignored .local directory")
    bundle = json.loads(args.catalog.read_text(encoding="utf-8"))
    talents = {}
    for el in read_xml(args.dataset / "Talents.xml"):
        key = text(el, "Key")
        if key:
            talents[key] = {"name":text(el,"Name"), "ranked":text(el,"Ranked").lower()=="true", "element":el}
    # Key aliases verified against names in the supplied talent catalogue.
    for old,new in {"VAAPADCON":"VAAPADCONT","ACKLAY":"ACKLAYSCST","ALCHARTS":"ALCARTS","SIDESIDE":"SIDEBYSIDE"}.items():
        if new in talents: talents[old]=talents[new]
    skills_file = args.dataset / "Skills.xml"
    skill_names = {text(el,"Key"):text(el,"Name") for el in read_xml(skills_file)} if skills_file.exists() else {}
    skill_ids = {"ASTRO":"astrogation","ATHL":"athletics","BRAWL":"brawl","CHARM":"charm","COERC":"coercion","COMP":"computers","COOL":"cool","COORD":"coordination","DECEP":"deception","DISC":"discipline","GUNN":"gunnery","LEAD":"leadership","LTSABER":"lightsaber","MECH":"mechanics","MED":"medicine","MELEE":"melee","NEG":"negotiation","PERC":"perception","PILOTPL":"pilotingPlanetary","PILOTSP":"pilotingSpace","RANGLT":"rangedLight","RANGHVY":"rangedHeavy","RESIL":"resilience","SKUL":"skulduggery","STEAL":"stealth","STREET":"streetwise","SW":"streetwise","SURV":"survival","VIGIL":"vigilance","CORE":"coreWorlds","EDU":"education","LORE":"lore","OUTER":"outerRim","OUT":"outerRim","UND":"underworld","WAR":"warfare","XEN":"xenology"}
    canonical = ["astrogation","athletics","brawl","charm","coercion","computers","cool","coordination","deception","discipline","gunnery","leadership","lightsaber","mechanics","medicine","melee","negotiation","perception","pilotingPlanetary","pilotingSpace","rangedLight","rangedHeavy","resilience","skulduggery","stealth","streetwise","survival","vigilance","coreWorlds","education","lore","outerRim","underworld","warfare","xenology"]
    for key,name in skill_names.items():
        cleaned=norm(name).replace("knowledge", "")
        for candidate in canonical:
            if norm(candidate)==cleaned: skill_ids[key]=candidate
    def effect_count(modifier, key):
        raw=text(modifier,key)
        return int(raw) if raw.isdigit() and int(raw)>0 else 0
    def talent_effects(el):
        effects=[]
        for modifier in el.findall("DieModifiers/DieModifier"):
            selectors={}
            skill=text(modifier,"SkillKey")
            group=text(modifier,"SkillType")
            if skill: selectors["skills"]=[skill_ids.get(skill,skill)]
            if group: selectors["groups"]=[group]
            for field,target,operation,effect_type in [
                ("BoostCount","boost","add","pool"),
                ("SetbackCount","setback","remove","pool"),
                ("ForceCount","force","add","pool"),
                ("AdvantageCount","advantage","add","result"),
            ]:
                count=effect_count(modifier,field)
                if count: effects.append({"type":effect_type,"operation":operation,"target":target,"count":count,**selectors})
        attributes=el.find("Attributes")
        if attributes is not None:
            requirements={}
            requirement=attributes.find("Requirement")
            if requirement is not None:
                if text(requirement,"WearingArmor").lower()=="true": requirements["equippedArmor"]=True
                minimum_soak=text(requirement,"SoakAtLeast")
                if minimum_soak.isdigit(): requirements["minimumSoak"]=int(minimum_soak)
            for field,target in [
                ("StrainThreshold","strainThreshold"),
                ("WoundThreshold","woundThreshold"),
                ("ForceRating","forceRating"),
                ("SoakValue","soak"),
                ("DefenseMelee","meleeDefense"),
                ("DefenseRanged","rangedDefense"),
            ]:
                count=effect_count(attributes,field)
                if count: effects.append({"type":"attribute","operation":"add","target":target,"count":count,**({"requirements":requirements} if requirements else {})})
        return effects
    for talent in {id(value):value for value in talents.values()}.values():
        el=talent["element"]
        talent["activation"]=text(el,"Activation")
        talent["summary"]=text(el,"Description") if args.include_private_talent_text else ""
        talent["effects"]=talent_effects(el)
        sources=[*el.findall("Source"),*el.findall("Sources/Source")]
        if sources:
            talent["reference"]={"book":(sources[0].text or "").strip(),"page":sources[0].get("Page","")}
    motivation_guidance={"deteremine_motivation":{},"motivation":{}}
    for filename,tag,table in [
        ("Motivations.xml","Motivation","deteremine_motivation"),
        ("SpecificMotivations.xml","SpecificMotivation","motivation"),
    ]:
        path=args.dataset/filename
        if not path.exists(): continue
        for entry in read_xml(path).findall(tag):
            name=text(entry,"Name")
            if name and norm(name) not in motivation_guidance[table]:
                motivation_guidance[table][norm(name)]=entry
    motivations_enriched=0
    if args.include_private_talent_text:
        for item in bundle["documents"]["Item"]:
            table=item.get("system",{}).get("source",{}).get("table","")
            entry=motivation_guidance.get(table,{}).get(norm(item.get("name","")))
            description=text(entry,"Description") if entry is not None else ""
            if description:
                item["system"]["description"]=description
                motivations_enriched+=1
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
                node={"id":f"r{row_index}c{col}","name":talent["name"],"key":k.text,"ranked":talent["ranked"],"cost":int(text(row,"Cost","0")),"row":row_index,"col":col,"entry":row_index==0,"activation":talent.get("activation",""),"effects":copy.deepcopy(talent.get("effects",[]))}
                if talent.get("summary"): node["summary"]=talent["summary"]
                if talent.get("reference"): node["reference"]=copy.deepcopy(talent["reference"])
                nodes.append(node)
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
    # Signature abilities are separate trees attached to the bottom row of an
    # eligible career specialization. Exact guidance remains private while the
    # graph, costs, source references and link requirements are structured.
    signature_nodes={}
    signature_node_file=args.dataset/"SigAbilityNodes.xml"
    if signature_node_file.exists():
        for node in read_xml(signature_node_file):
            key=text(node,"Key")
            if key: signature_nodes[key]=node
    career_keys={}
    for path in (args.dataset/"Careers").glob("*.xml"):
        career=read_xml(path)
        if text(career,"Key"): career_keys[text(career,"Key")]=text(career,"Name")
    signature_items={
        norm(item["name"]):item
        for item in bundle["documents"]["Item"]
        if item.get("type")=="signatureAbility" or item.get("system",{}).get("source",{}).get("table")=="signature_abilities"
    }
    for item in signature_items.values():
        item["type"]="signatureAbility"
        system=item.setdefault("system",{})
        metadata=system.get("metadata",{})
        system.setdefault("eligibleCareers",[str(metadata.get("career","")).strip()] if str(metadata.get("career","")).strip() else [])
        system.setdefault("abilityCategory",str(metadata.get("career_type","")).strip())
        system.setdefault("matchingNodes",[])
        system.setdefault("linkedSpecializationId","")
        system.setdefault("tree",{"nodes":[],"edges":[],"verified":False})
        system["incomplete"]=["tree"] if not system["tree"].get("nodes") else system.get("incomplete",[])
    signature_aliases={
        "unmatcheddevastation":"unmatcheddevistation",
        "unmatchednegotiations":"unmatchednegotiation",
    }
    signature_coverage=[]; signature_matched=set(); signature_imported=0
    signature_paths=sorted((args.dataset/"SigAbilities").glob("*.xml"),key=lambda path:(path.name.startswith("Umatched "),path.name))
    for path in signature_paths:
        ability=read_xml(path); name=text(ability,"Name"); source_key=norm(name)
        target_key=source_key if source_key in signature_items else signature_aliases.get(source_key,source_key)
        if target_key in signature_matched: continue
        item=signature_items.get(target_key)
        sources=[*ability.findall("Source"),*ability.findall("Sources/Source")]
        book=(sources[0].text or "").strip() if sources else ""
        page=sources[0].get("Page","") if sources else ""
        if not item:
            item={"_id":hashlib.sha256(f"signatureAbility:{text(ability,'Key')}".encode()).hexdigest()[:16],"name":name,"type":"signatureAbility","img":"systems/star-wars-ffg/assets/item.svg","system":{"source":{"book":book,"page":page,"table":"signature-abilities-xml","id":text(ability,"Key")},"metadata":{},"description":"","eligibleCareers":[],"abilityCategory":"","matchingNodes":[],"linkedSpecializationId":""},"flags":{"star-wars-ffg":{"importKey":f"signatureAbility:{text(ability,'Key')}"}}}
            bundle["documents"]["Item"].append(item); signature_items[target_key]=item
        signature_matched.add(target_key)
        system=item["system"]
        if not book: book=system.get("source",{}).get("book","")
        if not page: page=system.get("source",{}).get("page","")
        listed_careers=[career_keys.get(node.text,node.text) for node in ability.findall("Careers/Key") if node.text]
        if listed_careers: system["eligibleCareers"]=listed_careers
        elif not system.get("eligibleCareers"):
            metadata_career=str(system.get("metadata",{}).get("career","")).strip()
            system["eligibleCareers"]=[metadata_career] if metadata_career else []
        matching=[text_node.text.strip().lower()=="true" for text_node in ability.findall("MatchingNodes/Node")]
        system["matchingNodes"]=matching
        system["linkedSpecializationId"]=""
        nodes=[]; edges=set(); errors=[]; guidance_missing=[]; slot_ids=[]; directions=[]
        rows=ability.findall("AbilityRows/AbilityRow")
        for row_index,row in enumerate(rows):
            keys=[node.text or "" for node in row.findall("Abilities/Key")]
            ds=row.findall("Directions/Direction")
            costs=[int((node.text or "0").strip() or 0) for node in row.findall("Costs/Cost")][:4]
            spans=[int((node.text or "0").strip() or 0) for node in row.findall("AbilitySpan/Span")][:4]
            if len(keys)!=4 or len(ds)!=4 or len(costs)!=4 or len(spans)!=4: errors.append(f"Non-standard row {row_index + 1}")
            row_slots=[None,None,None,None]; col=0
            while col<4:
                key=keys[col] if col<len(keys) else ""
                span=spans[col] if col<len(spans) else 0
                if span<1:
                    errors.append(f"Unclaimed signature slot {row_index + 1},{col + 1}"); col+=1; continue
                if col+span>4:
                    errors.append(f"Out-of-bounds signature span {row_index + 1},{col + 1}"); span=4-col
                node_id=f"r{row_index}c{col}"
                for slot in range(col,col+span): row_slots[slot]=node_id
                definition=signature_nodes.get(key)
                node_name=text(definition,"Name") if definition is not None else (f"{name} Base Ability" if row_index==0 else key)
                if definition is None: guidance_missing.append(key)
                definition_sources=[*definition.findall("Source"),*definition.findall("Sources/Source")] if definition is not None else []
                reference={"book":((definition_sources[0].text or "").strip() if definition_sources else book),"page":(definition_sources[0].get("Page","") if definition_sources else page)}
                node={"id":node_id,"name":node_name,"key":key,"ranked":False,"cost":costs[col] if col<len(costs) else 0,"row":row_index,"col":col,"span":span,"entry":row_index==0 and col==0,"activation":"","effects":[],"reference":reference}
                if args.include_private_talent_text:
                    summary=text(definition,"Description") if definition is not None else (text(ability,"Description") if row_index==0 else "")
                    if summary: node["summary"]=summary
                nodes.append(node)
                col+=span
            slot_ids.append(row_slots); directions.append(ds)
        for row_index,ds in enumerate(directions):
            for col,direction in enumerate(ds):
                for label,dr,dc in [("Right",0,1),("Left",0,-1),("Down",1,0),("Up",-1,0)]:
                    if text(direction,label)!="true": continue
                    rr,cc=row_index+dr,col+dc
                    if not(0<=rr<len(slot_ids) and 0<=cc<4): errors.append("Out-of-bounds signature link"); continue
                    a=slot_ids[row_index][col]; b=slot_ids[rr][cc]
                    if a!=b: edges.add(tuple(sorted((a,b))))
        verified=len(rows)==3 and len(nodes)==9 and len(matching)==4 and any(matching) and not errors
        system["tree"]={"nodes":nodes,"edges":[list(edge) for edge in sorted(edges)],"verified":verified,"provenance":"Private structured signature-ability dataset; graph validation complete, printed chart comparison pending","source":{"book":book,"page":page}}
        incomplete=[]
        if not verified: incomplete.extend(errors or ["Signature ability graph needs review"])
        if guidance_missing: incomplete.append(f"Private guidance missing for {len(set(guidance_missing))} nodes")
        system["incomplete"]=incomplete
        signature_coverage.append({"signatureAbility":item["name"],"career":", ".join(system.get("eligibleCareers",[])),"book":system.get("source",{}).get("book",book),"page":system.get("source",{}).get("page",page),"graph":"imported" if verified else "needs review","nodes":len(nodes),"links":len(edges),"guidanceMissing":len(set(guidance_missing)),"issues":errors})
        signature_imported+=int(verified)
    for key,item in signature_items.items():
        if key in signature_matched: continue
        system=item["system"]
        system["tree"]={"nodes":[],"edges":[],"verified":False}
        system["incomplete"]=["No structured signature ability chart found"]
        signature_coverage.append({"signatureAbility":item["name"],"career":", ".join(system.get("eligibleCareers",[])),"book":system.get("source",{}).get("book",""),"page":system.get("source",{}).get("page",""),"graph":"missing","nodes":0,"links":0,"guidanceMissing":0,"issues":["No structured chart found"]})
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
    signature_coverage.sort(key=lambda row:(row["book"],row["signatureAbility"]))
    report={"charts":coverage,"graphsImported":imported,"signatureAbilities":signature_coverage,"signatureGraphsImported":signature_imported,"motivationsEnriched":motivations_enriched,"vehiclesEnriched":enriched,"pdfsInventoried":len(pdfs)}
    Path(".local/source-coverage.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    Path("docs").mkdir(exist_ok=True)
    missing=[r for r in coverage if not r["pdf"]]
    lines=["# Advancement source coverage", "", "Generated from the locally supplied SQL and structured dataset. No book text or artwork is included.", "", f"{len(coverage)} specialization references; {imported} structurally validated specialization graphs; {enriched} vehicles with matching structured statistics; {motivations_enriched} private motivation guidance matches.", "", "A structurally validated graph is usable for XP path checks; it is not a claim that every node has been compared against the printed book. Four connector discrepancies have been checked against held PDF charts; complete node-by-node comparisons remain pending.", "", "## Photo request register", "", "These source PDFs were not found by normalized book title. A full, straight-on image of each listed chart, with all four columns, five rows, connecting lines and page number visible, will let the chart be checked. Include adjacent creation/exception rules only where the chart references them. Structured graphs may already be available, as shown.", "", "| Book | Printed page | Specialization | Graph |", "|---|---|---|---|"]
    lines += [f"| {r['book']} | {r['page'] or 'Check index'} | {r['specialization']} | {r['graph']}{'; standalone chart PDF found' if r.get('standaloneChart') else ''} |" for r in missing]
    if not missing: lines.append("| None identified | | | |")
    lines += ["", "## Complete register", "", "| Specialization | Book | Page | PDF present | Graph | PDF comparison |", "|---|---|---|---|---|---|"]
    lines += [f"| {r['specialization']} | {r['book']} | {r['page']} | {'Yes' if r['pdf'] else 'No'} | {r['graph']} | {'Connector correction checked' if r['pdfCompared'] else 'Pending'} |" for r in coverage]
    missing_signatures=[row for row in signature_coverage if row["graph"]=="missing"]
    lines += ["", "## Signature abilities", "", f"{len(signature_coverage)} signature-ability references; {signature_imported} structurally validated graphs. The base ability remains locked until the character owns a matching bottom-row talent in the linked career specialization.", "", "| Signature ability | Career | Book | Page | Graph | Missing private guidance |", "|---|---|---|---|---|---|"]
    lines += [f"| {row['signatureAbility']} | {row['career']} | {row['book']} | {row['page']} | {row['graph']} | {row['guidanceMissing']} |" for row in signature_coverage]
    lines += ["", "## Signature chart photo requests", ""]
    lines += [f"- {row['signatureAbility']} — {row['book']}, p. {row['page'] or 'check index'}" for row in missing_signatures] or ["- None identified."]
    lines += ["", "## Coverage limits", "", "The register covers the supplied databases, not a verified complete publication bibliography. A present PDF can still have missing or unreadable pages. Expansion crafting, mass combat, squadron and Force-power exceptions need their own reference validation; no blanket claim of complete rules automation is made.", ""]
    Path("docs/source-coverage.md").write_text("\n".join(lines),encoding="utf-8")
    print(json.dumps({"graphsImported":imported,"charts":len(coverage),"missingPDFs":len(missing),"signatureGraphsImported":signature_imported,"signatureAbilities":len(signature_coverage),"missingSignatureGraphs":[row["signatureAbility"] for row in signature_coverage if row["graph"]=="missing"],"motivationsEnriched":motivations_enriched,"vehiclesEnriched":enriched,"unresolvedGraphs":[r["specialization"] for r in coverage if r["graph"]!="imported"]},indent=2))

if __name__=="__main__": main()
