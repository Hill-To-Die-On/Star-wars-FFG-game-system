import { readFile, writeFile } from "node:fs/promises";

const base = JSON.parse(await readFile("lang/en.json", "utf8"));
const common = {
  "SWFFG.System.Title": "Star Wars FFG",
  "SWFFG.System.About": "About Star Wars FFG",
  "SWFFG.Common.Close": "Close",
  "SWFFG.Common.Cancel": "Cancel",
  "SWFFG.Common.Save": "Save",
  "SWFFG.Common.Search": "Search",
  "SWFFG.Common.Open": "Open",
  "SWFFG.Common.Record": "Record",
  "SWFFG.Common.Apply": "Apply",
  "SWFFG.Common.Back": "Back",
  "SWFFG.Common.Next": "Next",
};
const groups = {
  "SWFFG.Settings.Groups.CampaignSetup": "Campaign setup",
  "SWFFG.Settings.Groups.Appearance": "Appearance",
  "SWFFG.Settings.Groups.CombatTurns": "Combat & turns",
  "SWFFG.Settings.Groups.PlayTools": "Play tools",
  "SWFFG.Settings.Groups.ImportsSources": "Imports & private sources",
  "SWFFG.Settings.Groups.HelpDiagnostics": "Help & diagnostics",
  "SWFFG.Settings.Groups.Other": "Other Star Wars settings",
};
const settings = {
  "SWFFG.Settings.About.Name": "About Star Wars FFG",
  "SWFFG.Settings.About.Label": "About",
  "SWFFG.Settings.About.Hint": "Show the system and Foundry versions loaded in this game session.",
  "SWFFG.Settings.Destiny.Name": "Session Destiny pool",
  "SWFFG.Settings.Destiny.Hint": "Roll and manage the shared Light and Dark Destiny points.",
  "SWFFG.Settings.Reference.Name": "Reference catalogue",
  "SWFFG.Settings.Reference.Label": "Search database",
  "SWFFG.Settings.Reference.Hint": "Find names, statistics, notes and book pages in the bundled database.",
  "SWFFG.Settings.DataReview.Name": "Rule data review",
  "SWFFG.Settings.DataReview.Label": "Review missing data",
  "SWFFG.Settings.DataReview.Hint": "Edit and validate missing source references, paraphrases and declarative talent or equipment rules.",
  "SWFFG.Settings.OwnedBooks.Name": "Owned books",
  "SWFFG.Settings.OwnedBooks.Label": "Choose available books",
  "SWFFG.Settings.OwnedBooks.Hint": "Apply one reference filter for the GM and players.",
  "SWFFG.Settings.Console.Name": "Session console",
  "SWFFG.Settings.Console.Label": "Dice & Destiny",
  "SWFFG.Settings.Console.Hint": "Roll custom dice and manage the shared Destiny pool.",
};
const hud = {
  "SWFFG.HUD.Destiny": "Destiny",
  "SWFFG.HUD.Light": "Light",
  "SWFFG.HUD.Dark": "Dark",
  "SWFFG.HUD.Actions": "Actions",
  "SWFFG.HUD.Maneuvers": "Maneuvers",
  "SWFFG.Sheets.Equipment": "Equipment",
  "SWFFG.Sheets.Abilities": "Abilities",
  "SWFFG.Sheets.Biography": "Biography",
};
const typeLabels = {
  "TYPES.Actor.character": "Character",
  "TYPES.Actor.minion": "Minion group",
  "TYPES.Actor.rival": "Rival",
  "TYPES.Actor.nemesis": "Nemesis",
  "TYPES.Actor.vehicle": "Vehicle",
  "TYPES.Actor.group": "Group",
  "TYPES.Item.weapon": "Weapon",
  "TYPES.Item.armor": "Armor",
  "TYPES.Item.gear": "Gear",
  "TYPES.Item.talent": "Talent",
  "TYPES.Item.forcePower": "Force power",
  "TYPES.Item.species": "Species",
  "TYPES.Item.career": "Career",
  "TYPES.Item.specialization": "Specialization",
  "TYPES.Item.signatureAbility": "Signature ability",
  "TYPES.Item.attachment": "Attachment",
  "TYPES.Item.reference": "Reference",
};
const translated = (types, values) => ({ ...typeLabels, ...common, ...groups, ...settings, ...hud, ...types, ...values });
const locales = {
  "en-GB": { ...common, ...groups, ...settings, ...hud, "TYPES.Item.armor": "Armour", "SWFFG.Settings.Groups.CombatTurns": "Combat & manoeuvres", "SWFFG.HUD.Maneuvers": "Manoeuvres" },
  "en-US": {},
  es: translated({
    "TYPES.Actor.character": "Personaje", "TYPES.Actor.minion": "Grupo de esbirros", "TYPES.Actor.vehicle": "Vehículo", "TYPES.Item.weapon": "Arma", "TYPES.Item.armor": "Armadura", "TYPES.Item.gear": "Equipo", "TYPES.Item.talent": "Talento", "TYPES.Item.forcePower": "Poder de la Fuerza", "TYPES.Item.species": "Especie", "TYPES.Item.career": "Carrera", "TYPES.Item.specialization": "Especialización", "TYPES.Item.signatureAbility": "Habilidad característica", "TYPES.Item.attachment": "Accesorio", "TYPES.Item.reference": "Referencia"
  }, {
    "SWFFG.System.About": "Acerca de Star Wars FFG", "SWFFG.Common.Close": "Cerrar", "SWFFG.Common.Cancel": "Cancelar", "SWFFG.Common.Save": "Guardar", "SWFFG.Common.Search": "Buscar", "SWFFG.Common.Open": "Abrir", "SWFFG.Common.Record": "Registrar", "SWFFG.Common.Apply": "Aplicar", "SWFFG.Common.Back": "Atrás", "SWFFG.Common.Next": "Siguiente", "SWFFG.Settings.Groups.CampaignSetup": "Configuración de campaña", "SWFFG.Settings.Groups.Appearance": "Apariencia", "SWFFG.Settings.Groups.CombatTurns": "Combate y turnos", "SWFFG.Settings.Groups.PlayTools": "Herramientas de juego", "SWFFG.Settings.Groups.ImportsSources": "Importaciones y fuentes privadas", "SWFFG.Settings.Groups.HelpDiagnostics": "Ayuda y diagnóstico", "SWFFG.Settings.Groups.Other": "Otros ajustes de Star Wars", "SWFFG.Settings.About.Name": "Acerca de Star Wars FFG", "SWFFG.Settings.About.Label": "Acerca de", "SWFFG.Settings.Destiny.Name": "Reserva de Destino de la sesión", "SWFFG.Settings.Reference.Label": "Buscar en la base de datos", "SWFFG.Settings.DataReview.Label": "Revisar datos faltantes", "SWFFG.Settings.OwnedBooks.Label": "Elegir libros disponibles", "SWFFG.Settings.Console.Label": "Dados y Destino", "SWFFG.HUD.Destiny": "Destino", "SWFFG.HUD.Light": "Luz", "SWFFG.HUD.Dark": "Oscuridad", "SWFFG.HUD.Actions": "Acciones", "SWFFG.HUD.Maneuvers": "Maniobras", "SWFFG.Sheets.Equipment": "Equipo", "SWFFG.Sheets.Abilities": "Habilidades", "SWFFG.Sheets.Biography": "Biografía"
  }),
  fr: translated({
    "TYPES.Actor.character": "Personnage", "TYPES.Actor.minion": "Groupe de sbires", "TYPES.Actor.vehicle": "Véhicule", "TYPES.Item.weapon": "Arme", "TYPES.Item.armor": "Armure", "TYPES.Item.gear": "Équipement", "TYPES.Item.forcePower": "Pouvoir de la Force", "TYPES.Item.species": "Espèce", "TYPES.Item.career": "Carrière", "TYPES.Item.specialization": "Spécialisation", "TYPES.Item.signatureAbility": "Capacité signature", "TYPES.Item.attachment": "Accessoire"
  }, {
    "SWFFG.System.About": "À propos de Star Wars FFG", "SWFFG.Common.Close": "Fermer", "SWFFG.Common.Cancel": "Annuler", "SWFFG.Common.Save": "Enregistrer", "SWFFG.Common.Search": "Rechercher", "SWFFG.Common.Open": "Ouvrir", "SWFFG.Common.Record": "Consigner", "SWFFG.Common.Apply": "Appliquer", "SWFFG.Common.Back": "Retour", "SWFFG.Common.Next": "Suivant", "SWFFG.Settings.Groups.CampaignSetup": "Configuration de campagne", "SWFFG.Settings.Groups.Appearance": "Apparence", "SWFFG.Settings.Groups.CombatTurns": "Combat et tours", "SWFFG.Settings.Groups.PlayTools": "Outils de jeu", "SWFFG.Settings.Groups.ImportsSources": "Imports et sources privées", "SWFFG.Settings.Groups.HelpDiagnostics": "Aide et diagnostics", "SWFFG.Settings.Groups.Other": "Autres réglages Star Wars", "SWFFG.Settings.About.Name": "À propos de Star Wars FFG", "SWFFG.Settings.About.Label": "À propos", "SWFFG.Settings.Destiny.Name": "Réserve de Destinée de la session", "SWFFG.Settings.Reference.Label": "Rechercher dans la base", "SWFFG.Settings.DataReview.Label": "Réviser les données manquantes", "SWFFG.Settings.OwnedBooks.Label": "Choisir les livres disponibles", "SWFFG.Settings.Console.Label": "Dés et Destinée", "SWFFG.HUD.Destiny": "Destinée", "SWFFG.HUD.Light": "Lumière", "SWFFG.HUD.Dark": "Obscurité", "SWFFG.HUD.Actions": "Actions", "SWFFG.HUD.Maneuvers": "Manœuvres", "SWFFG.Sheets.Equipment": "Équipement", "SWFFG.Sheets.Abilities": "Capacités", "SWFFG.Sheets.Biography": "Biographie"
  }),
  de: translated({
    "TYPES.Actor.character": "Charakter", "TYPES.Actor.minion": "Schergen-Gruppe", "TYPES.Actor.vehicle": "Fahrzeug", "TYPES.Item.weapon": "Waffe", "TYPES.Item.armor": "Rüstung", "TYPES.Item.gear": "Ausrüstung", "TYPES.Item.forcePower": "Machtfähigkeit", "TYPES.Item.species": "Spezies", "TYPES.Item.career": "Karriere", "TYPES.Item.specialization": "Spezialisierung", "TYPES.Item.signatureAbility": "Signaturfähigkeit", "TYPES.Item.attachment": "Anhang"
  }, {
    "SWFFG.System.About": "Über Star Wars FFG", "SWFFG.Common.Close": "Schließen", "SWFFG.Common.Cancel": "Abbrechen", "SWFFG.Common.Save": "Speichern", "SWFFG.Common.Search": "Suchen", "SWFFG.Common.Open": "Öffnen", "SWFFG.Common.Record": "Aufzeichnen", "SWFFG.Common.Apply": "Anwenden", "SWFFG.Common.Back": "Zurück", "SWFFG.Common.Next": "Weiter", "SWFFG.Settings.Groups.CampaignSetup": "Kampagnenaufbau", "SWFFG.Settings.Groups.Appearance": "Darstellung", "SWFFG.Settings.Groups.CombatTurns": "Kampf und Runden", "SWFFG.Settings.Groups.PlayTools": "Spielwerkzeuge", "SWFFG.Settings.Groups.ImportsSources": "Importe und private Quellen", "SWFFG.Settings.Groups.HelpDiagnostics": "Hilfe und Diagnose", "SWFFG.Settings.Groups.Other": "Weitere Star-Wars-Einstellungen", "SWFFG.Settings.About.Name": "Über Star Wars FFG", "SWFFG.Settings.About.Label": "Über", "SWFFG.Settings.Destiny.Name": "Destiny-Pool der Sitzung", "SWFFG.Settings.Reference.Label": "Datenbank durchsuchen", "SWFFG.Settings.DataReview.Label": "Fehlende Daten prüfen", "SWFFG.Settings.OwnedBooks.Label": "Verfügbare Bücher wählen", "SWFFG.Settings.Console.Label": "Würfel und Destiny", "SWFFG.HUD.Destiny": "Destiny", "SWFFG.HUD.Light": "Licht", "SWFFG.HUD.Dark": "Dunkelheit", "SWFFG.HUD.Actions": "Aktionen", "SWFFG.HUD.Maneuvers": "Manöver", "SWFFG.Sheets.Equipment": "Ausrüstung", "SWFFG.Sheets.Abilities": "Fähigkeiten", "SWFFG.Sheets.Biography": "Biografie"
  }),
  it: {},
  "pt-BR": {}, "pt-PT": {}, ja: {}, ko: {}, "zh-CN": {}, "zh-TW": {}, pl: {}, ru: {}, nl: {}, sv: {}
};

const setLocale = (locale, values) => { locales[locale] = { ...locales[locale], ...values }; };
setLocale("it", {
  "TYPES.Actor.character": "Personaggio", "TYPES.Actor.minion": "Gruppo di minion", "TYPES.Actor.rival": "Rivale", "TYPES.Actor.nemesis": "Nemesi", "TYPES.Actor.vehicle": "Veicolo", "TYPES.Actor.group": "Gruppo", "TYPES.Item.weapon": "Arma", "TYPES.Item.armor": "Armatura", "TYPES.Item.gear": "Equipaggiamento", "TYPES.Item.talent": "Talento", "TYPES.Item.forcePower": "Potere della Forza", "TYPES.Item.species": "Specie", "TYPES.Item.career": "Carriera", "TYPES.Item.specialization": "Specializzazione", "TYPES.Item.signatureAbility": "Abilità distintiva", "TYPES.Item.attachment": "Accessorio", "TYPES.Item.reference": "Riferimento",
  "SWFFG.System.About": "Informazioni su Star Wars FFG", "SWFFG.Common.Close": "Chiudi", "SWFFG.Common.Cancel": "Annulla", "SWFFG.Common.Save": "Salva", "SWFFG.Common.Search": "Cerca", "SWFFG.Common.Open": "Apri", "SWFFG.Common.Record": "Registra", "SWFFG.Common.Apply": "Applica", "SWFFG.Common.Back": "Indietro", "SWFFG.Common.Next": "Avanti", "SWFFG.Settings.Groups.CampaignSetup": "Impostazioni campagna", "SWFFG.Settings.Groups.Appearance": "Aspetto", "SWFFG.Settings.Groups.CombatTurns": "Combattimento e turni", "SWFFG.Settings.Groups.PlayTools": "Strumenti di gioco", "SWFFG.Settings.Groups.ImportsSources": "Importazioni e fonti private", "SWFFG.Settings.Groups.HelpDiagnostics": "Aiuto e diagnostica", "SWFFG.Settings.Groups.Other": "Altre impostazioni Star Wars", "SWFFG.HUD.Destiny": "Destino", "SWFFG.HUD.Light": "Luce", "SWFFG.HUD.Dark": "Oscurità", "SWFFG.HUD.Actions": "Azioni", "SWFFG.HUD.Maneuvers": "Manovre", "SWFFG.Sheets.Equipment": "Equipaggiamento", "SWFFG.Sheets.Abilities": "Abilità", "SWFFG.Sheets.Biography": "Biografia"
});
setLocale("pt-BR", {
  "TYPES.Actor.character": "Personagem", "TYPES.Actor.minion": "Grupo de lacaios", "TYPES.Actor.rival": "Rival", "TYPES.Actor.nemesis": "Nêmesis", "TYPES.Actor.vehicle": "Veículo", "TYPES.Actor.group": "Grupo", "TYPES.Item.weapon": "Arma", "TYPES.Item.armor": "Armadura", "TYPES.Item.gear": "Equipamento", "TYPES.Item.talent": "Talento", "TYPES.Item.forcePower": "Poder da Força", "TYPES.Item.species": "Espécie", "TYPES.Item.career": "Carreira", "TYPES.Item.specialization": "Especialização", "TYPES.Item.signatureAbility": "Habilidade característica", "TYPES.Item.attachment": "Acessório", "TYPES.Item.reference": "Referência",
  "SWFFG.System.About": "Sobre Star Wars FFG", "SWFFG.Common.Close": "Fechar", "SWFFG.Common.Cancel": "Cancelar", "SWFFG.Common.Save": "Salvar", "SWFFG.Common.Search": "Pesquisar", "SWFFG.Common.Open": "Abrir", "SWFFG.Common.Record": "Registrar", "SWFFG.Common.Apply": "Aplicar", "SWFFG.Common.Back": "Voltar", "SWFFG.Common.Next": "Avançar", "SWFFG.Settings.Groups.CampaignSetup": "Configuração da campanha", "SWFFG.Settings.Groups.Appearance": "Aparência", "SWFFG.Settings.Groups.CombatTurns": "Combate e turnos", "SWFFG.Settings.Groups.PlayTools": "Ferramentas de jogo", "SWFFG.Settings.Groups.ImportsSources": "Importações e fontes privadas", "SWFFG.Settings.Groups.HelpDiagnostics": "Ajuda e diagnósticos", "SWFFG.Settings.Groups.Other": "Outras configurações de Star Wars", "SWFFG.HUD.Destiny": "Destino", "SWFFG.HUD.Light": "Luz", "SWFFG.HUD.Dark": "Trevas", "SWFFG.HUD.Actions": "Ações", "SWFFG.HUD.Maneuvers": "Manobras", "SWFFG.Sheets.Equipment": "Equipamento", "SWFFG.Sheets.Abilities": "Habilidades", "SWFFG.Sheets.Biography": "Biografia"
});
setLocale("pt-PT", {
  "TYPES.Actor.character": "Personagem", "TYPES.Actor.minion": "Grupo de lacaios", "TYPES.Actor.rival": "Rival", "TYPES.Actor.nemesis": "Némesis", "TYPES.Actor.vehicle": "Veículo", "TYPES.Actor.group": "Grupo", "TYPES.Item.weapon": "Arma", "TYPES.Item.armor": "Armadura", "TYPES.Item.gear": "Equipamento", "TYPES.Item.talent": "Talento", "TYPES.Item.forcePower": "Poder da Força", "TYPES.Item.species": "Espécie", "TYPES.Item.career": "Carreira", "TYPES.Item.specialization": "Especialização", "TYPES.Item.signatureAbility": "Habilidade de assinatura", "TYPES.Item.attachment": "Acessório", "TYPES.Item.reference": "Referência",
  "SWFFG.System.About": "Sobre Star Wars FFG", "SWFFG.Common.Close": "Fechar", "SWFFG.Common.Cancel": "Cancelar", "SWFFG.Common.Save": "Guardar", "SWFFG.Common.Search": "Pesquisar", "SWFFG.Common.Open": "Abrir", "SWFFG.Common.Record": "Registar", "SWFFG.Common.Apply": "Aplicar", "SWFFG.Common.Back": "Voltar", "SWFFG.Common.Next": "Seguinte", "SWFFG.Settings.Groups.CampaignSetup": "Configuração da campanha", "SWFFG.Settings.Groups.Appearance": "Aspeto", "SWFFG.Settings.Groups.CombatTurns": "Combate e turnos", "SWFFG.Settings.Groups.PlayTools": "Ferramentas de jogo", "SWFFG.Settings.Groups.ImportsSources": "Importações e fontes privadas", "SWFFG.Settings.Groups.HelpDiagnostics": "Ajuda e diagnóstico", "SWFFG.Settings.Groups.Other": "Outras definições de Star Wars", "SWFFG.HUD.Destiny": "Destino", "SWFFG.HUD.Light": "Luz", "SWFFG.HUD.Dark": "Trevas", "SWFFG.HUD.Actions": "Ações", "SWFFG.HUD.Maneuvers": "Manobras", "SWFFG.Sheets.Equipment": "Equipamento", "SWFFG.Sheets.Abilities": "Habilidades", "SWFFG.Sheets.Biography": "Biografia"
});
setLocale("ja", {
  "TYPES.Actor.character": "キャラクター", "TYPES.Actor.minion": "ミニオン・グループ", "TYPES.Actor.rival": "ライバル", "TYPES.Actor.nemesis": "ネメシス", "TYPES.Actor.vehicle": "ビークル", "TYPES.Actor.group": "グループ", "TYPES.Item.weapon": "武器", "TYPES.Item.armor": "防具", "TYPES.Item.gear": "ギア", "TYPES.Item.talent": "タレント", "TYPES.Item.forcePower": "フォースの力", "TYPES.Item.species": "種族", "TYPES.Item.career": "キャリア", "TYPES.Item.specialization": "スペシャライゼーション", "TYPES.Item.signatureAbility": "シグネチャー・アビリティ", "TYPES.Item.attachment": "アタッチメント", "TYPES.Item.reference": "リファレンス",
  "SWFFG.System.About": "Star Wars FFGについて", "SWFFG.Common.Close": "閉じる", "SWFFG.Common.Cancel": "キャンセル", "SWFFG.Common.Save": "保存", "SWFFG.Common.Search": "検索", "SWFFG.Common.Open": "開く", "SWFFG.Common.Record": "記録", "SWFFG.Common.Apply": "適用", "SWFFG.Common.Back": "戻る", "SWFFG.Common.Next": "次へ", "SWFFG.Settings.Groups.CampaignSetup": "キャンペーン設定", "SWFFG.Settings.Groups.Appearance": "外観", "SWFFG.Settings.Groups.CombatTurns": "戦闘とターン", "SWFFG.Settings.Groups.PlayTools": "プレイツール", "SWFFG.Settings.Groups.ImportsSources": "インポートと非公開ソース", "SWFFG.Settings.Groups.HelpDiagnostics": "ヘルプと診断", "SWFFG.Settings.Groups.Other": "その他のStar Wars設定", "SWFFG.HUD.Destiny": "Destiny", "SWFFG.HUD.Light": "Light", "SWFFG.HUD.Dark": "Dark", "SWFFG.HUD.Actions": "アクション", "SWFFG.HUD.Maneuvers": "マヌーバー", "SWFFG.Sheets.Equipment": "装備", "SWFFG.Sheets.Abilities": "アビリティ", "SWFFG.Sheets.Biography": "人物紹介"
});
setLocale("ko", {
  "TYPES.Actor.character": "캐릭터", "TYPES.Actor.minion": "미니언 그룹", "TYPES.Actor.rival": "라이벌", "TYPES.Actor.nemesis": "네메시스", "TYPES.Actor.vehicle": "탈것", "TYPES.Actor.group": "그룹", "TYPES.Item.weapon": "무기", "TYPES.Item.armor": "방어구", "TYPES.Item.gear": "장비", "TYPES.Item.talent": "재능", "TYPES.Item.forcePower": "포스 능력", "TYPES.Item.species": "종족", "TYPES.Item.career": "커리어", "TYPES.Item.specialization": "전문화", "TYPES.Item.signatureAbility": "시그니처 능력", "TYPES.Item.attachment": "부착물", "TYPES.Item.reference": "참조",
  "SWFFG.System.About": "Star Wars FFG 정보", "SWFFG.Common.Close": "닫기", "SWFFG.Common.Cancel": "취소", "SWFFG.Common.Save": "저장", "SWFFG.Common.Search": "검색", "SWFFG.Common.Open": "열기", "SWFFG.Common.Record": "기록", "SWFFG.Common.Apply": "적용", "SWFFG.Common.Back": "뒤로", "SWFFG.Common.Next": "다음", "SWFFG.Settings.Groups.CampaignSetup": "캠페인 설정", "SWFFG.Settings.Groups.Appearance": "화면", "SWFFG.Settings.Groups.CombatTurns": "전투 및 턴", "SWFFG.Settings.Groups.PlayTools": "플레이 도구", "SWFFG.Settings.Groups.ImportsSources": "가져오기 및 비공개 출처", "SWFFG.Settings.Groups.HelpDiagnostics": "도움말 및 진단", "SWFFG.Settings.Groups.Other": "기타 Star Wars 설정", "SWFFG.HUD.Destiny": "Destiny", "SWFFG.HUD.Light": "빛", "SWFFG.HUD.Dark": "어둠", "SWFFG.HUD.Actions": "행동", "SWFFG.HUD.Maneuvers": "기동", "SWFFG.Sheets.Equipment": "장비", "SWFFG.Sheets.Abilities": "능력", "SWFFG.Sheets.Biography": "배경"
});
setLocale("zh-CN", {
  "TYPES.Actor.character": "角色", "TYPES.Actor.minion": "杂兵组", "TYPES.Actor.rival": "对手", "TYPES.Actor.nemesis": "宿敌", "TYPES.Actor.vehicle": "载具", "TYPES.Actor.group": "小组", "TYPES.Item.weapon": "武器", "TYPES.Item.armor": "护甲", "TYPES.Item.gear": "装备", "TYPES.Item.talent": "天赋", "TYPES.Item.forcePower": "原力能力", "TYPES.Item.species": "种族", "TYPES.Item.career": "职业", "TYPES.Item.specialization": "专精", "TYPES.Item.signatureAbility": "标志性能力", "TYPES.Item.attachment": "附件", "TYPES.Item.reference": "参考",
  "SWFFG.System.About": "关于 Star Wars FFG", "SWFFG.Common.Close": "关闭", "SWFFG.Common.Cancel": "取消", "SWFFG.Common.Save": "保存", "SWFFG.Common.Search": "搜索", "SWFFG.Common.Open": "打开", "SWFFG.Common.Record": "记录", "SWFFG.Common.Apply": "应用", "SWFFG.Common.Back": "返回", "SWFFG.Common.Next": "下一步", "SWFFG.Settings.Groups.CampaignSetup": "战役设置", "SWFFG.Settings.Groups.Appearance": "外观", "SWFFG.Settings.Groups.CombatTurns": "战斗与回合", "SWFFG.Settings.Groups.PlayTools": "游戏工具", "SWFFG.Settings.Groups.ImportsSources": "导入与私有来源", "SWFFG.Settings.Groups.HelpDiagnostics": "帮助与诊断", "SWFFG.Settings.Groups.Other": "其他 Star Wars 设置", "SWFFG.HUD.Destiny": "命运", "SWFFG.HUD.Light": "光明", "SWFFG.HUD.Dark": "黑暗", "SWFFG.HUD.Actions": "行动", "SWFFG.HUD.Maneuvers": "机动", "SWFFG.Sheets.Equipment": "装备", "SWFFG.Sheets.Abilities": "能力", "SWFFG.Sheets.Biography": "背景"
});
setLocale("zh-TW", {
  "TYPES.Actor.character": "角色", "TYPES.Actor.minion": "雜兵組", "TYPES.Actor.rival": "對手", "TYPES.Actor.nemesis": "宿敵", "TYPES.Actor.vehicle": "載具", "TYPES.Actor.group": "小組", "TYPES.Item.weapon": "武器", "TYPES.Item.armor": "護甲", "TYPES.Item.gear": "裝備", "TYPES.Item.talent": "天賦", "TYPES.Item.forcePower": "原力能力", "TYPES.Item.species": "種族", "TYPES.Item.career": "職業", "TYPES.Item.specialization": "專精", "TYPES.Item.signatureAbility": "標誌性能力", "TYPES.Item.attachment": "附件", "TYPES.Item.reference": "參考",
  "SWFFG.System.About": "關於 Star Wars FFG", "SWFFG.Common.Close": "關閉", "SWFFG.Common.Cancel": "取消", "SWFFG.Common.Save": "儲存", "SWFFG.Common.Search": "搜尋", "SWFFG.Common.Open": "開啟", "SWFFG.Common.Record": "記錄", "SWFFG.Common.Apply": "套用", "SWFFG.Common.Back": "返回", "SWFFG.Common.Next": "下一步", "SWFFG.Settings.Groups.CampaignSetup": "戰役設定", "SWFFG.Settings.Groups.Appearance": "外觀", "SWFFG.Settings.Groups.CombatTurns": "戰鬥與回合", "SWFFG.Settings.Groups.PlayTools": "遊戲工具", "SWFFG.Settings.Groups.ImportsSources": "匯入與私人來源", "SWFFG.Settings.Groups.HelpDiagnostics": "說明與診斷", "SWFFG.Settings.Groups.Other": "其他 Star Wars 設定", "SWFFG.HUD.Destiny": "命運", "SWFFG.HUD.Light": "光明", "SWFFG.HUD.Dark": "黑暗", "SWFFG.HUD.Actions": "行動", "SWFFG.HUD.Maneuvers": "機動", "SWFFG.Sheets.Equipment": "裝備", "SWFFG.Sheets.Abilities": "能力", "SWFFG.Sheets.Biography": "背景"
});
setLocale("pl", {
  "TYPES.Actor.character": "Postać", "TYPES.Actor.minion": "Grupa sługusów", "TYPES.Actor.rival": "Rywal", "TYPES.Actor.nemesis": "Nemezis", "TYPES.Actor.vehicle": "Pojazd", "TYPES.Actor.group": "Grupa", "TYPES.Item.weapon": "Broń", "TYPES.Item.armor": "Pancerz", "TYPES.Item.gear": "Wyposażenie", "TYPES.Item.talent": "Talent", "TYPES.Item.forcePower": "Moc", "TYPES.Item.species": "Gatunek", "TYPES.Item.career": "Kariera", "TYPES.Item.specialization": "Specjalizacja", "TYPES.Item.signatureAbility": "Zdolność sygnaturowa", "TYPES.Item.attachment": "Dodatek", "TYPES.Item.reference": "Odnośnik",
  "SWFFG.System.About": "O Star Wars FFG", "SWFFG.Common.Close": "Zamknij", "SWFFG.Common.Cancel": "Anuluj", "SWFFG.Common.Save": "Zapisz", "SWFFG.Common.Search": "Szukaj", "SWFFG.Common.Open": "Otwórz", "SWFFG.Common.Record": "Zapisz wpis", "SWFFG.Common.Apply": "Zastosuj", "SWFFG.Common.Back": "Wstecz", "SWFFG.Common.Next": "Dalej", "SWFFG.Settings.Groups.CampaignSetup": "Ustawienia kampanii", "SWFFG.Settings.Groups.Appearance": "Wygląd", "SWFFG.Settings.Groups.CombatTurns": "Walka i tury", "SWFFG.Settings.Groups.PlayTools": "Narzędzia gry", "SWFFG.Settings.Groups.ImportsSources": "Importy i źródła prywatne", "SWFFG.Settings.Groups.HelpDiagnostics": "Pomoc i diagnostyka", "SWFFG.Settings.Groups.Other": "Inne ustawienia Star Wars", "SWFFG.HUD.Destiny": "Przeznaczenie", "SWFFG.HUD.Light": "Światło", "SWFFG.HUD.Dark": "Ciemność", "SWFFG.HUD.Actions": "Akcje", "SWFFG.HUD.Maneuvers": "Manewry", "SWFFG.Sheets.Equipment": "Wyposażenie", "SWFFG.Sheets.Abilities": "Zdolności", "SWFFG.Sheets.Biography": "Biografia"
});
setLocale("ru", {
  "TYPES.Actor.character": "Персонаж", "TYPES.Actor.minion": "Группа миньонов", "TYPES.Actor.rival": "Соперник", "TYPES.Actor.nemesis": "Немезида", "TYPES.Actor.vehicle": "Транспорт", "TYPES.Actor.group": "Группа", "TYPES.Item.weapon": "Оружие", "TYPES.Item.armor": "Броня", "TYPES.Item.gear": "Снаряжение", "TYPES.Item.talent": "Талант", "TYPES.Item.forcePower": "Сила", "TYPES.Item.species": "Вид", "TYPES.Item.career": "Карьера", "TYPES.Item.specialization": "Специализация", "TYPES.Item.signatureAbility": "Фирменная способность", "TYPES.Item.attachment": "Модификация", "TYPES.Item.reference": "Справка",
  "SWFFG.System.About": "О Star Wars FFG", "SWFFG.Common.Close": "Закрыть", "SWFFG.Common.Cancel": "Отмена", "SWFFG.Common.Save": "Сохранить", "SWFFG.Common.Search": "Поиск", "SWFFG.Common.Open": "Открыть", "SWFFG.Common.Record": "Записать", "SWFFG.Common.Apply": "Применить", "SWFFG.Common.Back": "Назад", "SWFFG.Common.Next": "Далее", "SWFFG.Settings.Groups.CampaignSetup": "Настройка кампании", "SWFFG.Settings.Groups.Appearance": "Внешний вид", "SWFFG.Settings.Groups.CombatTurns": "Бой и ходы", "SWFFG.Settings.Groups.PlayTools": "Игровые инструменты", "SWFFG.Settings.Groups.ImportsSources": "Импорт и частные источники", "SWFFG.Settings.Groups.HelpDiagnostics": "Помощь и диагностика", "SWFFG.Settings.Groups.Other": "Другие настройки Star Wars", "SWFFG.HUD.Destiny": "Судьба", "SWFFG.HUD.Light": "Свет", "SWFFG.HUD.Dark": "Тьма", "SWFFG.HUD.Actions": "Действия", "SWFFG.HUD.Maneuvers": "Манёвры", "SWFFG.Sheets.Equipment": "Снаряжение", "SWFFG.Sheets.Abilities": "Способности", "SWFFG.Sheets.Biography": "Биография"
});
setLocale("nl", {
  "TYPES.Actor.character": "Personage", "TYPES.Actor.minion": "Miniongroep", "TYPES.Actor.rival": "Rivaal", "TYPES.Actor.nemesis": "Nemesis", "TYPES.Actor.vehicle": "Voertuig", "TYPES.Actor.group": "Groep", "TYPES.Item.weapon": "Wapen", "TYPES.Item.armor": "Pantser", "TYPES.Item.gear": "Uitrusting", "TYPES.Item.talent": "Talent", "TYPES.Item.forcePower": "Krachtvermogen", "TYPES.Item.species": "Soort", "TYPES.Item.career": "Carrière", "TYPES.Item.specialization": "Specialisatie", "TYPES.Item.signatureAbility": "Kenmerkende vaardigheid", "TYPES.Item.attachment": "Hulpstuk", "TYPES.Item.reference": "Referentie",
  "SWFFG.System.About": "Over Star Wars FFG", "SWFFG.Common.Close": "Sluiten", "SWFFG.Common.Cancel": "Annuleren", "SWFFG.Common.Save": "Opslaan", "SWFFG.Common.Search": "Zoeken", "SWFFG.Common.Open": "Openen", "SWFFG.Common.Record": "Vastleggen", "SWFFG.Common.Apply": "Toepassen", "SWFFG.Common.Back": "Terug", "SWFFG.Common.Next": "Volgende", "SWFFG.Settings.Groups.CampaignSetup": "Campagne-instellingen", "SWFFG.Settings.Groups.Appearance": "Uiterlijk", "SWFFG.Settings.Groups.CombatTurns": "Gevecht en beurten", "SWFFG.Settings.Groups.PlayTools": "Spelhulpmiddelen", "SWFFG.Settings.Groups.ImportsSources": "Import en privébronnen", "SWFFG.Settings.Groups.HelpDiagnostics": "Hulp en diagnose", "SWFFG.Settings.Groups.Other": "Andere Star Wars-instellingen", "SWFFG.HUD.Destiny": "Bestemming", "SWFFG.HUD.Light": "Licht", "SWFFG.HUD.Dark": "Donker", "SWFFG.HUD.Actions": "Acties", "SWFFG.HUD.Maneuvers": "Manoeuvres", "SWFFG.Sheets.Equipment": "Uitrusting", "SWFFG.Sheets.Abilities": "Vaardigheden", "SWFFG.Sheets.Biography": "Biografie"
});
setLocale("sv", {
  "TYPES.Actor.character": "Rollperson", "TYPES.Actor.minion": "Grupp av hantlangare", "TYPES.Actor.rival": "Rival", "TYPES.Actor.nemesis": "Nemesis", "TYPES.Actor.vehicle": "Fordon", "TYPES.Actor.group": "Grupp", "TYPES.Item.weapon": "Vapen", "TYPES.Item.armor": "Rustning", "TYPES.Item.gear": "Utrustning", "TYPES.Item.talent": "Talang", "TYPES.Item.forcePower": "Kraftförmåga", "TYPES.Item.species": "Art", "TYPES.Item.career": "Karriär", "TYPES.Item.specialization": "Specialisering", "TYPES.Item.signatureAbility": "Signaturförmåga", "TYPES.Item.attachment": "Tillbehör", "TYPES.Item.reference": "Referens",
  "SWFFG.System.About": "Om Star Wars FFG", "SWFFG.Common.Close": "Stäng", "SWFFG.Common.Cancel": "Avbryt", "SWFFG.Common.Save": "Spara", "SWFFG.Common.Search": "Sök", "SWFFG.Common.Open": "Öppna", "SWFFG.Common.Record": "Registrera", "SWFFG.Common.Apply": "Tillämpa", "SWFFG.Common.Back": "Tillbaka", "SWFFG.Common.Next": "Nästa", "SWFFG.Settings.Groups.CampaignSetup": "Kampanjinställningar", "SWFFG.Settings.Groups.Appearance": "Utseende", "SWFFG.Settings.Groups.CombatTurns": "Strid och rundor", "SWFFG.Settings.Groups.PlayTools": "Spelverktyg", "SWFFG.Settings.Groups.ImportsSources": "Import och privata källor", "SWFFG.Settings.Groups.HelpDiagnostics": "Hjälp och diagnostik", "SWFFG.Settings.Groups.Other": "Övriga Star Wars-inställningar", "SWFFG.HUD.Destiny": "Öde", "SWFFG.HUD.Light": "Ljus", "SWFFG.HUD.Dark": "Mörker", "SWFFG.HUD.Actions": "Handlingar", "SWFFG.HUD.Maneuvers": "Manövrer", "SWFFG.Sheets.Equipment": "Utrustning", "SWFFG.Sheets.Abilities": "Förmågor", "SWFFG.Sheets.Biography": "Biografi"
});

for (const [locale, overrides] of Object.entries(locales)) {
  const data = { ...base, ...overrides };
  await writeFile(`lang/${locale}.json`, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
