import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";
import { referenceIndex } from "./reference-browser.mjs";
import { normalizeBookTitle } from "./rules.mjs";
import { ONBOARDING_VERSION, COPYRIGHT_REMINDER, applyBookshelf, bookshelfFromCampaign, needsOnboarding, readRememberedBooks, rememberBooks } from "./onboarding.mjs";
import { registerInterfaceTour, startInterfaceTour } from "./interface-tour.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
let openWizard, stopWelcomeQueue;
const browserStorage = () => { try { return globalThis.localStorage; } catch { return undefined; } };

export class WelcomeWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "star-wars-welcome", tag: "section", classes: ["star-wars", "sf-welcome"],
    window: { title: "Star Wars FFG · Welcome aboard", resizable: true }, position: { width: 730, height: 700 },
    actions: { next: this.next, back: this.back, later: this.later, saveBooks: this.saveBooks, selectAll: this.selectAll, clearAll: this.clearAll, useRemembered: this.useRemembered, forget: this.forget, tour: this.tour, skip: this.skip }
  };
  static PARTS = { body: { template: `${SYSTEM_PATH}/templates/welcome.hbs` } };
  step = "welcome";
  draft = null;
  expected = null;
  busy = false;
  async _prepareContext() {
    const isGM = game.user.isGM, remembered = isGM ? readRememberedBooks(browserStorage()) : null;
    let choices = [];
    if (this.step === "books" && isGM) {
      const { books } = await referenceIndex();
      if (!this.draft) {
        this.expected = bookshelfFromCampaign(game.settings.get(SYSTEM_ID,"campaign"));
        this.draft = { ...this.expected, books: [...this.expected.books], remember: true };
        // A fresh campaign defaults to all references; ownership must be an explicit selection.
        if (!this.draft.books.length) this.draft.bookMode = "owned";
      }
      const titles = [...new Set([...books, ...this.draft.books])].sort((a,b)=>a.localeCompare(b));
      const selected = new Set(this.draft.books.map(normalizeBookTitle));
      choices = titles.map(name=>({name,selected:selected.has(normalizeBookTitle(name))}));
    }
    return { isGM, welcome: this.step === "welcome", booksStep: this.step === "books" && isGM, tourStep: this.step === "tour", copyright: COPYRIGHT_REMINDER, choices, draft:this.draft, all:this.draft?.bookMode === "all", remembered: remembered?.books.length ?? 0, hasRemembered:!!remembered };
  }
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="bookSearch"]')?.addEventListener("input", event=>{
      const query = event.target.value.trim().toLowerCase();
      for (const row of this.element.querySelectorAll(".sf-book-choice")) row.hidden = !row.textContent.toLowerCase().includes(query);
    });
    this.element.querySelector("[data-step-heading]")?.focus();
  }
  captureBooks() {
    const root=this.element;
    this.draft = { books:[...root.querySelectorAll('[name="books"]:checked')].map(input=>input.value), bookMode:root.querySelector('[name="bookMode"]').value, includeUnreferenced:root.querySelector('[name="includeUnreferenced"]').checked, remember:root.querySelector('[name="remember"]').checked };
  }
  async finish(tour) {
    await game.user.setFlag(SYSTEM_ID,"onboarding",{version:ONBOARDING_VERSION,tour});
    await this.close();
  }
  async close(options) { if (openWizard === this) openWizard=null; return super.close(options); }
  static async next() { this.step=game.user.isGM ? "books" : "tour"; try { await this.render(); } catch(error) { ui.notifications.error(error.message); } }
  static back() { if(this.step==="books")this.captureBooks(); this.step="welcome";return this.render(); }
  static async later() { await this.finish("skipped"); }
  static selectAll() { for(const input of this.element.querySelectorAll('[name="books"]'))input.checked=true; }
  static clearAll() { for(const input of this.element.querySelectorAll('[name="books"]'))input.checked=false; }
  static async useRemembered() { if(!game.user.isGM)return; const saved=readRememberedBooks(browserStorage());if(saved){this.draft={...saved,remember:true};await this.render();} }
  static async forget() { if(!game.user.isGM)return; this.captureBooks();this.draft.remember=false;rememberBooks(browserStorage(),null);await this.render(); }
  static async saveBooks() {
    if(this.busy)return;
    if(!game.user.isGM)throw new Error("Only the GM can change the campaign bookshelf.");
    this.busy=true;
    const button=this.element.querySelector('[data-action="saveBooks"]'); if(button)button.disabled=true;
    try {
      this.captureBooks();
      const updated=applyBookshelf(game.settings.get(SYSTEM_ID,"campaign"),this.draft,this.expected);
      await game.settings.set(SYSTEM_ID,"campaign",updated);
      if(!rememberBooks(browserStorage(),this.draft.remember ? this.draft : null))ui.notifications.warn("Books saved to this world. Browser storage is unavailable, so they could not be remembered for future worlds.");
      this.step="tour"; await this.render();
    } catch(error) { ui.notifications.error(error.message); if(button)button.disabled=false; }
    finally { this.busy=false; }
  }
  static async tour() { await this.finish("offered");await startInterfaceTour(); }
  static async skip() { await this.finish("skipped"); }
}
export function openWelcome() { stopWelcomeQueue?.(); if(openWizard){void openWizard.bringToFront?.();return openWizard;}openWizard=new WelcomeWizard();void openWizard.render({force:true});return openWizard; }
function queueFirstLaunch() {
  const coreTour=game.tours.get("core.welcome");
  const freshWorld=!(game.actors.size+game.scenes.size+game.items.size+game.journal.size);
  const pendingCore=freshWorld && coreTour?.status===foundry.nue.Tour.STATUS.UNSTARTED;
  let pending;
  const observer=new MutationObserver(()=>{clearTimeout(pending);pending=setTimeout(maybeShow,50);});
  let opened=false;
  const maybeShow=()=>{
    if(opened || foundry.nue.Tour.tourInProgress || document.querySelector(".tour-overlay"))return;
    if(pendingCore && coreTour.status===foundry.nue.Tour.STATUS.UNSTARTED)return;
    opened=true;observer.disconnect();clearTimeout(pending);stopWelcomeQueue=null;openWelcome();
  };
  stopWelcomeQueue=()=>{opened=true;observer.disconnect();clearTimeout(pending);stopWelcomeQueue=null;};
  observer.observe(document.body,{childList:true});
  // Foundry initializes its new-world tour after ready. Watch its overlay lifecycle, not an animation-frame loop.
  queueMicrotask(maybeShow);
}
export function registerOnboarding() {
  game.settings.registerMenu(SYSTEM_ID,"welcomeMenu",{name:"Welcome & interface tour",label:"Open welcome",hint:"Choose the campaign bookshelf, read the copyright reminder or replay the optional interface tutorial.",icon:"fas fa-compass",type:WelcomeWizard,restricted:false});
  Hooks.once("ready",()=>{
    registerInterfaceTour();
    if(needsOnboarding(game.user.getFlag(SYSTEM_ID,"onboarding")))queueFirstLaunch();
  });
}
export const onboardingApi=Object.freeze({open:openWelcome,tour:startInterfaceTour});
