/**
 * Localisation helpers shared by runtime dialogs and settings.
 *
 * Foundry loads the language selected in Configure Settings from the files
 * declared by system.json. Keeping the fallback beside each call means the
 * system remains usable while Foundry is still booting and when an optional
 * translation has not supplied a newer key yet.
 */

/**
 * Static UI copy is kept in one catalogue so templates and HTML dialogs can
 * share the same translation keys.  Values rendered from actors, items,
 * sourcebooks, or player notes are deliberately not included here: those are
 * content and must remain exactly as entered.
 */
export const UI_PHRASES = Object.freeze({
  "STAR WARS FFG": "Brand",
  "NARRATIVE TOOLKIT": "NarrativeToolkit",
  "GROUP RECORD": "GroupRecord",
  "Sheet theme": "SheetTheme",
  "Portrait": "Portrait",
  "Portrait front. Click to unlock and turn.": "PortraitFront",
  "Edit token image and facing": "EditTokenFacing",
  "Name": "Name",
  "Model": "Model",
  "Choose vehicle model…": "ChooseVehicleModel",
  "Show model choices": "ShowModelChoices",
  "Model choices": "ModelChoices",
  "No valid model matches that search.": "NoModelMatches",
  "Use homebrew model": "UseHomebrewModel",
  "Choose a model to fill its recorded profile. The ship's name stays editable.": "ModelHelp",
  "Manufacturer": "Manufacturer",
  "Find a manufacturer…": "FindManufacturer",
  "Show manufacturer choices": "ShowManufacturerChoices",
  "Manufacturer choices": "ManufacturerChoices",
  "No valid manufacturer matches that search.": "NoManufacturerMatches",
  "Use homebrew manufacturer": "UseHomebrewManufacturer",
  "Filter models by manufacturer; choosing a model sets both.": "ManufacturerHelp",
  "Show all manufacturers": "ShowAllManufacturers",
  "Registration": "Registration",
  "Assigned when a model is chosen": "RegistrationPlaceholder",
  "Species": "Species",
  "Choose species…": "ChooseSpecies",
  "Show species choices": "ShowSpeciesChoices",
  "Species choices": "SpeciesChoices",
  "No valid species matches that search.": "NoSpeciesMatches",
  "Use homebrew species": "UseHomebrewSpecies",
  "Career": "Career",
  "Choose career…": "ChooseCareer",
  "Show career choices": "ShowCareerChoices",
  "Career choices": "CareerChoices",
  "No valid career matches that search.": "NoCareerMatches",
  "Use homebrew career": "UseHomebrewCareer",
  "Campaign rules": "CampaignRules",
  "Chosen by the GM for this adventure.": "CampaignRulesHelp",
  "Homebrew setup": "HomebrewSetup",
  "Homebrew identity": "HomebrewIdentity",
  "Finish homebrew setup · GM": "FinishHomebrew",
  "Choose missing species skills": "ChooseMissingSpeciesSkills",
  "Review the abilities marked “Apply when relevant” before finishing creation.": "ReviewSpeciesAbilities",
  "The catalogue's species ability shorthand has not been checked against the book. Review the source before applying its effects.": "SpeciesReviewHelp",
  "Catalogue shorthand:": "CatalogueShorthand",
  "Create this character": "CreateCharacter",
  "Choose every option, or start with a few questions.": "CreateCharacterHelp",
  "Manual creation": "ManualCreation",
  "Guide me": "GuidedCreation",
  "Build an enemy": "BuildEnemy",
  "Choose a role and review an original NPC preset.": "BuildEnemyHelp",
  "Enemy guide": "EnemyGuide",
  "Finish character creation": "FinishCharacterCreation",
  "Spend XP using + XP and the talent trees, review species exceptions and finish starting funds.": "FinishCharacterCreationHelp",
  "Ready for play": "ReadyForPlay",
  "Character sections": "CharacterSections",
  "Source check needed": "SourceCheckNeeded",
  "Confirm source checks": "ConfirmSourceChecks",
  "Characteristics": "Characteristics",
  "Purchase next characteristic rating with XP": "PurchaseCharacteristic",
  "Purchase next": "PurchaseNext",
  "with XP": "WithXp",
  "Condition": "Condition",
  "Vitals": "Vitals",
  "Current": "Current",
  "Threshold": "Threshold",
  "Threshold exceeded": "ThresholdExceeded",
  "Apply damage": "ApplyDamage",
  "Damage accumulates. A threshold is exceeded only when the current value is greater.": "DamageHelp",
  "Damage appearance": "DamageAppearance",
  "Impairment": "Impairment",
  "Flight profile": "FlightProfile",
  "Readiness": "Readiness",
  "Speed": "Speed",
  "Maximum speed": "MaximumSpeed",
  "Soak": "Soak",
  "Melee defense": "MeleeDefense",
  "Ranged defense": "RangedDefense",
  "Force rating": "ForceRating",
  "Committed dice": "CommittedDice",
  "Credits": "Credits",
  "Finish starting funds": "FinishStartingFunds",
  "Roll d100 after the starting loadout is final.": "FinishStartingFundsHelp",
  "Roll Force": "RollForce",
  "Cool": "Cool",
  "Vigilance": "Vigilance",
  "Deflector shields": "DeflectorShields",
  "Crew": "Crew",
  "Passengers": "Passengers",
  "Hyperdrive": "Hyperdrive",
  "Cargo": "Cargo",
  "Canvas footprint": "CanvasFootprint",
  "The token badge fills its occupied width and length, with the hull symbol centred inside it. Characters can stand on or board ground vehicles.": "CanvasFootprintHelp",
  "Hull symbol": "HullSymbol",
  "Sizing": "Sizing",
  "Length (m)": "LengthMeters",
  "Width (m)": "WidthMeters",
  "Use exact dimensions when the craft's published measurements are known. Manual token resizing disables later automatic rescaling for that placed token.": "FootprintHelp",
  "A place in the galaxy": "PlaceInGalaxy",
  "Obligation": "Obligation",
  "Duty": "Duty",
  "Type": "Type",
  "Value": "Value",
  "Contribution": "Contribution",
  "Morality": "Morality",
  "Conflict": "Conflict",
  "Minion group": "MinionGroup",
  "Starting members": "StartingMembers",
  "Enter the wound threshold of one member above. Mark trained group skills on the Skills tab.": "MinionGroupHelp",
  "Skills": "Skills",
  "Click a skill to build and roll its pool": "SkillsHelp",
  "Skill / pool": "SkillPool",
  "Char": "CharacteristicShort",
  "Rank": "Rank",
  "Career ·": "CareerMarker",
  "Roll": "Roll",
  "Add a custom skill": "AddCustomSkill",
  "Custom skill actions": "CustomSkillActions",
  "Career skill": "CareerSkill",
  "Not a career skill": "NotCareerSkill",
  "Minion group skill": "MinionGroupSkill",
  "Not a minion group skill": "NotMinionGroupSkill",
  "Equipment": "Equipment",
  "Add item": "AddItem",
  "Weapons, armor, gear, and attachments. Drag more from the local compendiums.": "EquipmentHelp",
  "Source statistics needed": "SourceStatisticsNeeded",
  "No summary recorded; open to review.": "NoSummaryRecorded",
  "No equipment recorded yet.": "NoEquipment",
  "Abilities": "Abilities",
  "GM source notes": "GmSourceNotes",
  "Purchased talents, species traits, and other granted abilities appear here with their attached source records.": "AbilitiesHelp",
  "Learned and granted": "LearnedAndGranted",
  "Source details need review": "SourceDetailsReview",
  "View": "View",
  "Open": "Open",
  "Edit": "Edit",
  "Remove": "Remove",
  "on": "On",
  "Attached records and paths": "AttachedRecords",
  "No abilities recorded yet.": "NoAbilities",
  "Build a character. Follow a path.": "AdvancementIntro",
  "Available XP": "AvailableXp",
  "Total earned XP": "TotalEarnedXp",
  "Advancement phase": "AdvancementPhase",
  "Character creation": "CharacterCreation",
  "Campaign play": "CampaignPlay",
  "Starting species and career locked": "OriginsLocked",
  "Manual creation": "ManualCreation",
  "Guide me": "GuidedCreation",
  "Refresh owned talent guidance from local library": "RefreshTalentGuidance",
  "Add the chart with the private PDF tree importer. A list of talent names alone does not define a valid upgrade path.": "MissingTalentTree",
  "Add a specialization or signature ability from the library to see its upgrade paths.": "MissingSpecialization",
  "Advancement record": "AdvancementRecord",
  "No XP purchases yet.": "NoXpPurchases",
  "Logbook": "Logbook",
  "Story hooks": "StoryHooks",
  "Roll missing story hooks": "RollStoryHooks",
  "The rolled categories and source references remain available to the GM and connected tools.": "StoryHooksHelp",
  "Background story": "BackgroundStory",
  "Notes": "Notes",
  "Motivations": "Motivations",
  "Add": "Add",
  "Add as many active or dormant motivations as the character needs. Director of Realms receives their category, guidance and source reference.": "MotivationsHelp",
  "Dormant": "Dormant",
  "No structured motivations yet. Use Add or drag a motivation reference from the library.": "NoMotivations",
  "Freeform motivation summary": "MotivationSummary",
  "Species background": "SpeciesBackground",
  "Background text": "BackgroundText",
  "Career background": "CareerBackground",
  "Bio Notes": "BioNotes",
  "Describe personality, choices and development in your own words.": "BioNotesPlaceholder",
  "Freeform notes for the character owner and GM. Add details as the character develops; the background story above stays separate.": "BioNotesHelp",
  "Move generated background out of Bio Notes": "TidyBioNotes",
  "Emotional strength": "EmotionalStrength",
  "Emotional weakness": "EmotionalWeakness",
  "Source reference": "SourceReference",
  "Book": "Book",
  "Page": "Page",
  "Independent tooling · Keep the rulebooks at the table": "FooterRulebooks",
  "GROUP RECORD": "GroupRecord",
  "Shared Destiny": "SharedDestiny",
  "Dice & Destiny": "DiceDestiny",
  "Group obligation": "GroupObligation",
  "Group duty": "GroupDuty",
  "Shared credits": "SharedCredits",
  "Base of Operations": "BaseOfOperations",
  "Location": "Location",
  "Description": "Description",
  "Group members": "GroupMembers",
  "Sync linked characters": "SyncLinkedCharacters",
  "Add member": "AddMember",
  "Link a character and sync to copy their current story scores and motivation. Changes here stay in the group record.": "GroupMembersHelp",
  "Linked character": "LinkedCharacter",
  "Manual record": "ManualRecord",
  "Player": "Player",
  "Character": "Character",
  "Obligation value": "ObligationValue",
  "Obligation type": "ObligationType",
  "Remove member": "RemoveMember",
  "No members recorded yet.": "NoMembers",
  "Starting group asset": "StartingGroupAsset",
  "Choose or edit asset": "ChooseGroupAsset",
  "Choose the party's shared starting ship, base, holocron, or mentor from the enabled campaign line.": "StartingGroupAssetHelp",
  "Shared resource ledger": "SharedResourceLedger",
  "Record change": "RecordResourceChange",
  "No shared changes recorded yet.": "NoSharedChanges",
  "Other shared resources": "OtherSharedResources",
  "Group possessions notes": "GroupPossessionsNotes",
  "Group contacts": "GroupContacts",
  "Group notes": "GroupNotes",
  "Equipped": "Equipped",
  "Restricted": "Restricted",
  "Skill": "Skill",
  "Damage (+N adds Brawn)": "DamageAddsBrawn",
  "Critical rating": "CriticalRating",
  "Range": "Range",
  "Scale": "Scale",
  "Qualities": "Qualities",
  "Firing arcs override": "FiringArcsOverride",
  "Use recorded arcs": "UseRecordedArcs",
  "Leave blank to use imported arcs. Enter fore, aft, port, starboard or all; combine arcs with commas. Dorsal and ventral mounts retain their elevation restriction.": "FiringArcsHelp",
  "Defense": "Defense",
  "Personal notes": "PersonalNotes",
  "Look it up": "LookItUp",
  "This entry is a reference. The source book explains the rule.": "ReferenceHelp",
  "Eligible career:": "EligibleCareer",
  "Imported facts": "ImportedFacts",
  "Save item": "SaveItem",
  "The campaign's bookshelf": "CampaignBookshelf",
  "This selection filters the catalogue and reference API for GMs and players, starting choices, item drops and future compendium imports. Existing characters and compendium documents are preserved.": "BookshelfHelp",
  "Book filter": "BookFilter",
  "All books": "AllBooks",
  "Only selected books": "OnlySelectedBooks",
  "Include entries without a book reference when filtering": "IncludeUnreferenced",
  "Find a book": "FindBook",
  "Select all": "SelectAll",
  "Clear all": "ClearAll",
  "Additional source titles, one per line": "AdditionalSourceTitles",
  "Only selected books + no selection shows no book-sourced entries.": "BookFilterHelp",
  "Save owned books": "SaveOwnedBooks",
  "Find it. Bring the book.": "ReferenceTagline",
  "Roll tables": "RollTables",
  "Owned books": "OwnedBooks",
  "Populate compendiums": "PopulateCompendiums",
  "Search names, notes and statistics": "SearchReferences",
  "Category": "Category",
  "All categories": "AllCategories",
  "All allowed books": "AllAllowedBooks",
  "Search": "Search",
  "Name / category": "NameCategory",
  "No matching references. Check the search and the GM's owned-book selection.": "NoReferences",
  "Previous": "Previous",
  "Next": "Next",
  "A reference at the table": "ReferenceAtTable",
  "Select a result to see its statistics, notes and book page. The catalogue retains the creator's database fields; blank values remain unknown.": "ReferenceHelpLong",
  "Roll with the book in view.": "RollTablesIntro",
  "Only tables with checked dice, ranges and result labels are available. Other rules and special outcomes remain in their source book.": "RollTablesHelp",
  "Table": "Table",
  "Result": "Result",
  "The table supplies the result label. Use the cited page for its explanation and any follow-up roll.": "RollTableResultHelp",
  "No roll tables are enabled": "NoRollTables",
  "Ask the GM to select the relevant source book in Owned books.": "RollTablesNoneHelp",
  "Start here": "SupportStart",
  "Player quick start": "PlayerQuickStart",
  "GM quick start": "GmQuickStart",
  "Tabletop tools and undo": "TabletopToolsUndo",
  "Known limits and release gates": "KnownLimits",
  "Implemented workflows": "ImplementedWorkflows",
  "Learned talent and signature effects": "LearnedEffects",
  "Choose an accessible actor": "ChooseActor",
  "Find an effect": "FindEffect",
  "Status": "Status",
  "Refresh coverage": "RefreshCoverage",
  "No matching learned effects. This is not a claim that every ability is automated.": "NoLearnedEffects",
  "Select an actor to inspect recorded effects. Only actors available to this account are listed.": "EffectInspectorHelp",
  "Support diagnostics": "SupportDiagnostics",
  "Download diagnostic JSON": "DownloadDiagnostics",
  "Items needing data review": "ItemsNeedingReview",
  "Rule data editor": "RuleDataEditor",
  "Book title": "BookTitle",
  "Passive, Action, Maneuver…": "ActivationPlaceholder",
  "Record a concise, original rule summary for this item.": "ParaphrasePlaceholder",
  "No items match this filter.": "NoItemsMatch",
  "Review points": "ReviewPoints",
  "No missing points detected.": "NoMissingPoints",
  "GM paraphrase / description": "GmParaphrase",
  "Structured effects JSON": "StructuredEffectsJson",
  "Declarative effects only; no scripts or executable text.": "StructuredEffectsHelp",
  "Abilities JSON": "AbilitiesJson",
  "Each ability needs a name; add summary, activation and structured effects when verified.": "AbilitiesJsonHelp",
  "Review flags JSON": "ReviewFlagsJson",
  "Remove a flag only after the corresponding source point has been checked.": "ReviewFlagsHelp",
  "Talent tree JSON": "TalentTreeJson",
  "Use the source reference and validate the whole tree before saving.": "TalentTreeHelp",
  "Validate fields": "ValidateFields",
  "Save reviewed data": "SaveReviewedData",
  "Select an item": "SelectItem",
  "World items and actor-owned talents, specializations and equipment appear here when they have missing or unverified data.": "DataReviewHelp",
  "+ XP": "AddXp",
  "Add a motivation": "AddMotivation",
  "An impairment adds one setback die to the relevant checks until repaired.": "ImpairmentHelp",
  "DoR shows sparks for damaged droids and blood for damaged actors that bleed. Override this for a character that does not bleed.": "DamageAppearanceHelp",
  "HILL TO DIE ON": "PublisherMark",
  "Purchase connected talents with available XP. Structured passive effects marked Auto feed the dice pool; use the cited book for every node whose wording is not supplied by a private library.": "AdvancementHelp",
  "Set homebrew starting statistics, skills, abilities, XP and equipment manually. The GM completes this setup using the Homebrew identity panel above.": "HomebrewAdvancementHelp",
  "Skill order": "SkillOrder",
  "Species abilities": "SpeciesAbilities",
  "Activation": "Activation",
  "All items": "AllItems",
  "Name / type": "NameType",
  "Needs review": "NeedsReview",
  "Owner": "Owner",
  "Refresh": "Refresh",
  "STAR WARS FFG / GM DATA REVIEW": "DataReviewTitle",
  "Show": "Show",
  "Source book": "SourceBook",
  "Stun, Pierce, Accurate…": "WeaponQualitiesPlaceholder",
  "Validate the rules that play": "DataReviewTagline",
  "Weapon qualities": "WeaponQualities",
  "Duty type": "DutyType",
  "Duty value": "DutyValue",
  "Group name": "GroupName",
  "Open character": "OpenCharacter",
  "Unofficial fan system · Keep the rulebooks at the table": "FooterUnofficial",
  "Attach this ability to an eligible owned specialization. Its base node unlocks after a matching bottom-row talent is learned.": "AttachAbilityHelp",
  "Attach this specialization to a character to view and purchase its connected talents.": "AttachSpecializationHelp",
  "Item name": "ItemName",
  "Core, Force, Republic…": "BookSearchPlaceholder",
  "Blaster, pilot, planet…": "ReferenceSearchPlaceholder",
  "Book-verified species abilities": "VerifiedSpeciesAbilities",
  "Reference details": "ReferenceDetails",
  "Result pages": "ResultPages",
  "STAR WARS FFG / REFERENCE LIBRARY": "ReferenceTitle",
  "Search results": "SearchResults",
  "Species ability details still require a book check; the catalogue's Special field is shorthand only.": "SpeciesDetailsReview",
  "Summary from recorded fields; consult the book for descriptions and effects.": "SummaryHelp",
  "Roll table": "RollTable",
  "STAR WARS FFG / REVIEWED ROLL TABLES": "RollTablesTitle",
  "Actor": "Actor",
  "Declare intent, review the dice pool, roll, agree the result, then apply reviewed changes. Recorded conditions and narrative choices do not silently apply every mechanical effect.": "SupportStartHelp",
  "Diagnostic export preview": "DiagnosticPreview",
  "Help documents": "HelpDocuments",
  "Review the complete export below. It contains versions, two integration states and document counts. It excludes names, world IDs, settings, source notes, chat content, URLs and credentials. Nothing is uploaded.": "DiagnosticHelp",
  "These packaged guides open as Markdown documents. Books remain the authority for rules. A printed-chart check validates the graph; it does not certify every effect.": "SupportLimitsHelp",
  "Star Wars FFG · Session console": "SessionConsole",
  "Shared Destiny:": "SharedDestinyLabel",
  "These controls persist world state. The GM manages Destiny flips for the table.": "SessionConsoleHelp",
  "Roll pool": "RollPool",
  "Use light": "UseLight",
  "Use dark": "UseDark",
  "Seed Destiny": "SeedDestiny",
  "Default sheet theme": "DefaultSheetTheme",
  "Automatic matches each character's creation rules and uses the campaign's first enabled ruleset for vehicles and groups. A sheet's own theme control can override this setting.": "DefaultSheetThemeHint",
  "Foundry interface theme": "FoundryInterfaceTheme",
  "Style the space backdrop, sidebar, chat, combat tracker, journals, windows, scene controls, player list and hotbar. Automatic follows the first enabled campaign ruleset; choose a scheme here to override it.": "FoundryInterfaceThemeHint",
  "Compact dice tray by chat": "CompactDiceTray",
  "Show a minimal seven-die pool beside the chat bar. It uses the active chat visibility button for public, GM, blind or self rolls.": "CompactDiceTrayHint",
  "Transaction authority": "TransactionAuthority",
  "Use this GM tab": "UseThisGmTab",
  "Select the single GM tab that processes XP, turn, crew and tabletop transactions.": "TransactionAuthorityHint",
  "GM source key": "GmSourceKey",
  "Backup or restore key": "BackupRestoreKey",
  "Keep a private backup to unlock encrypted source notes on another GM browser.": "GmSourceKeyHint",
  "GM source library": "GmSourceLibrary",
  "Search private sources": "SearchPrivateSources",
  "Search imported descriptions, abilities and rules in this GM browser.": "GmSourceLibraryHint",
  "Campaign rules & adventure state": "CampaignRulesAdventure",
  "Choose campaign rules": "ChooseCampaignRules",
  "Enable one or more rule lines, combine their story mechanics, and lock completed character origins when play begins.": "CampaignRulesHint",
  "Private library": "PrivateLibrary",
  "Import database": "ImportDatabase",
  "Populate world compendiums from a local Star Wars FFG library JSON.": "PrivateLibraryHint",
  "External tools & community rules": "ExternalToolsRules",
  "Import character or rules": "ImportCharacterRules",
  "Review a versioned interchange package from a character builder or community-rules site.": "ExternalToolsHint",
  "SW Adversaries": "SwAdversaries",
  "Import adversaries": "ImportAdversaries",
  "Read a local swa.stoogoff.com JSON export into this world's actor compendium.": "ImportAdversariesHint",
  "Help & rules coverage": "HelpRulesCoverage",
  "Open help": "OpenHelp",
  "Quick starts, automation limits, learned effects and privacy-safe diagnostics.": "HelpRulesCoverageHint",
  "Show altitude shadows": "ShowAltitudeShadows",
  "Project elevated actor artwork onto level surfaces and lower actors. Disable on this device if preferred.": "AltitudeShadowsHint",
  "Altitude shadows": "AltitudeShadows",
  "Allow homebrew identities": "AllowHomebrewIdentities",
  "GM override: let actor owners use custom species, careers, vehicle models and manufacturers. Database search remains available. Custom entries retain the current stats for manual setup and GM review; character-creation locks still apply.": "AllowHomebrewIdentitiesHint",
});

export const UI_TRANSLATION_ENTRIES = Object.freeze(
  Object.fromEntries(
    Object.entries(UI_PHRASES).map(([phrase, suffix]) => [
      `SWFFG.UI.${suffix}`,
      phrase,
    ]),
  ),
);

const UI_PHRASE_KEYS = Object.freeze(
  Object.fromEntries(
    Object.entries(UI_PHRASES).map(([phrase, suffix]) => [
      phrase,
      `SWFFG.UI.${suffix}`,
    ]),
  ),
);

export const REQUIRED_TRANSLATION_KEYS = Object.freeze([
  "TYPES.Actor.character",
  "TYPES.Actor.minion",
  "TYPES.Actor.rival",
  "TYPES.Actor.nemesis",
  "TYPES.Actor.vehicle",
  "TYPES.Actor.group",
  "TYPES.Item.weapon",
  "TYPES.Item.armor",
  "TYPES.Item.gear",
  "TYPES.Item.talent",
  "TYPES.Item.forcePower",
  "TYPES.Item.species",
  "TYPES.Item.career",
  "TYPES.Item.specialization",
  "TYPES.Item.signatureAbility",
  "TYPES.Item.attachment",
  "TYPES.Item.reference",
  "SWFFG.System.Title",
  "SWFFG.System.About",
  "SWFFG.Common.Close",
  "SWFFG.Common.Cancel",
  "SWFFG.Common.Save",
  "SWFFG.Common.Search",
  "SWFFG.Common.Open",
  "SWFFG.Common.Record",
  "SWFFG.Common.Apply",
  "SWFFG.Common.Back",
  "SWFFG.Common.Next",
  "SWFFG.Settings.Groups.CampaignSetup",
  "SWFFG.Settings.Groups.Appearance",
  "SWFFG.Settings.Groups.CombatTurns",
  "SWFFG.Settings.Groups.PlayTools",
  "SWFFG.Settings.Groups.ImportsSources",
  "SWFFG.Settings.Groups.HelpDiagnostics",
  "SWFFG.Settings.Groups.Other",
  "SWFFG.Settings.About.Name",
  "SWFFG.Settings.About.Label",
  "SWFFG.Settings.About.Hint",
  "SWFFG.Settings.Destiny.Name",
  "SWFFG.Settings.Destiny.Hint",
  "SWFFG.Settings.Reference.Name",
  "SWFFG.Settings.Reference.Label",
  "SWFFG.Settings.Reference.Hint",
  "SWFFG.Settings.DataReview.Name",
  "SWFFG.Settings.DataReview.Label",
  "SWFFG.Settings.DataReview.Hint",
  "SWFFG.Settings.OwnedBooks.Name",
  "SWFFG.Settings.OwnedBooks.Label",
  "SWFFG.Settings.OwnedBooks.Hint",
  "SWFFG.Settings.Console.Name",
  "SWFFG.Settings.Console.Label",
  "SWFFG.Settings.Console.Hint",
  "SWFFG.HUD.Destiny",
  "SWFFG.HUD.Light",
  "SWFFG.HUD.Dark",
  "SWFFG.HUD.Actions",
  "SWFFG.HUD.Maneuvers",
  "SWFFG.Sheets.Equipment",
  "SWFFG.Sheets.Abilities",
  "SWFFG.Sheets.Biography",
  ...Object.keys(UI_TRANSLATION_ENTRIES),
]);

export const SUPPORTED_LOCALES = Object.freeze([
  "en",
  "en-GB",
  "en-US",
  "es",
  "fr",
  "de",
  "it",
  "pt-BR",
  "pt-PT",
  "ja",
  "ko",
  "zh-CN",
  "zh-TW",
  "pl",
  "ru",
  "nl",
  "sv",
]);

export function localize(key, fallback = key) {
  try {
    const translated = globalThis.game?.i18n?.localize?.(key);
    if (typeof translated === "string" && translated && translated !== key)
      return translated;
  } catch {
    // Foundry is not available to pure data tests or while modules initialise.
  }
  return fallback;
}

export function localizeFormat(key, data = {}, fallback = key) {
  try {
    const format = globalThis.game?.i18n?.format;
    if (typeof format === "function") {
      const translated = format.call(globalThis.game.i18n, key, data);
      if (typeof translated === "string" && translated && translated !== key)
        return translated;
    }
  } catch {
    // Use the readable fallback when Foundry is not ready.
  }
  return localize(key, fallback);
}

function asElement(root) {
  if (!root) return null;
  if (typeof Element === "undefined") return null;
  if (root instanceof Element) return root;
  if (root[0] instanceof Element) return root[0];
  if (root.element instanceof Element) return root.element;
  return null;
}

function isSystemUi(element) {
  return Boolean(
    element?.closest?.(
      ".sf-shell, .star-wars, .sf-dialog, .sf-support, .sf-catalogue, .sf-data-review, .sf-book-tools",
    ),
  );
}

function localizePhrase(value) {
  const key = UI_PHRASE_KEYS[value];
  return key ? localize(key, value) : value;
}

function localizeDynamicPhrase(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return value;
  const direct = localizePhrase(trimmed);
  if (direct !== trimmed) return String(value).replace(trimmed, direct);
  const patterns = [
    [/^Edit (.+)$/, "Edit ", "Edit"],
    [/^Remove (.+)$/, "Remove ", "Remove"],
    [/^View (.+) on (.+)$/, "View ", "View"],
    [/^Open source item for (.+)$/, "Open ", "Open"],
    [/^Roll (.+) using (.+)$/, "Roll ", "Roll"],
    [/^Purchase next (.+) rank$/, "Purchase next ", "PurchaseNextRank"],
    [/^Purchase next (.+) rank with XP$/, "Purchase next ", "PurchaseNextRankWithXp"],
  ];
  for (const [pattern, prefix, suffix] of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const translatedPrefix = localizePhrase(prefix.trim());
    if (suffix === "Edit" || suffix === "Remove")
      return String(value).replace(trimmed, `${translatedPrefix} ${match[1]}`);
    if (suffix === "View")
      return String(value).replace(trimmed, `${translatedPrefix} ${match[1]} ${localizePhrase("on")} ${match[2]}`);
    if (suffix === "Open")
      return String(value).replace(trimmed, `${translatedPrefix} source item for ${match[1]}`);
    if (suffix === "Roll")
      return String(value).replace(trimmed, `${translatedPrefix} ${match[1]} using ${match[2]}`);
    if (suffix === "PurchaseNextRank" || suffix === "PurchaseNextRankWithXp")
      return String(value).replace(trimmed, `${localize("SWFFG.UI.PurchaseNext", "Purchase next")} ${match[1]} rank${suffix.endsWith("WithXp") ? ` ${localize("SWFFG.UI.WithXp", "with XP")}` : ""}`);
  }
  return value;
}

/**
 * Translate static text and accessibility attributes in a rendered system UI.
 * Dynamic character, item, and sourcebook values are left untouched unless
 * they are part of a known label pattern such as “Remove <item>”.
 */
export function localizeRenderedUI(root) {
  const element = asElement(root);
  if (!element || typeof document === "undefined" || typeof NodeFilter === "undefined") return root;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!isSystemUi(node.parentElement)) continue;
    const before = node.nodeValue;
    const translated = localizeDynamicPhrase(before);
    if (translated !== before) node.nodeValue = translated;
  }
  for (const target of element.querySelectorAll?.("[aria-label], [aria-description], [title], [placeholder]") ?? []) {
    if (!isSystemUi(target)) continue;
    for (const attribute of ["aria-label", "aria-description", "title", "placeholder"]) {
      if (!target.hasAttribute(attribute)) continue;
      const before = target.getAttribute(attribute);
      const translated = localizeDynamicPhrase(before);
      if (translated !== before) target.setAttribute(attribute, translated);
    }
  }
  return root;
}

let uiLocalisationObserver;
export function registerUiLocalisation() {
  if (uiLocalisationObserver || typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  const translate = (node) => {
    if (node?.nodeType === Node.ELEMENT_NODE) localizeRenderedUI(node);
    else if (node?.parentElement) localizeRenderedUI(node.parentElement);
  };
  translate(document.body);
  uiLocalisationObserver = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) translate(node);
  });
  uiLocalisationObserver.observe(document.body, { childList: true, subtree: true });
}

export function validateLocaleManifest(languages, translationsByPath) {
  if (!Array.isArray(languages) || !languages.length)
    throw new Error("At least one system language must be registered.");
  const seen = new Set();
  const registered = new Set();
  for (const language of languages) {
    if (!language || typeof language !== "object")
      throw new Error("System language entries must be objects.");
    const lang = String(language.lang ?? "");
    if (!lang || !language.name || !language.path)
      throw new Error("System language entries require lang, name and path.");
    let canonical;
    try {
      canonical = Intl.getCanonicalLocales(lang)[0];
    } catch {
      throw new Error(`Invalid system language locale: ${lang}.`);
    }
    if (canonical !== lang)
      throw new Error(`System language locale must be canonical: ${lang}.`);
    if (seen.has(lang)) throw new Error(`Duplicate system language: ${lang}.`);
    seen.add(lang);
    registered.add(lang);
    if (!/^lang\/[A-Za-z0-9-]+\.json$/.test(language.path))
      throw new Error(`System language path is outside lang/: ${language.path}.`);
    const translations = translationsByPath?.[language.path];
    if (!translations || Array.isArray(translations) || typeof translations !== "object")
      throw new Error(`Language file is not a JSON object: ${language.path}.`);
    for (const key of REQUIRED_TRANSLATION_KEYS) {
      if (typeof translations[key] !== "string" || !translations[key].trim())
        throw new Error(`${language.path} is missing translation key ${key}.`);
    }
  }
  if (!registered.has("en")) throw new Error("The default en locale is required.");
  for (const locale of SUPPORTED_LOCALES)
    if (!registered.has(locale)) throw new Error(`Manifest is missing locale ${locale}.`);
  return true;
}
