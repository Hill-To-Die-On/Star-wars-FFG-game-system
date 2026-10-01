import { SYSTEM_ID } from "./config.mjs";
import { INTERFACE_TOUR } from "./onboarding.mjs";
export function registerInterfaceTour() {
  if (game.tours.has(`${SYSTEM_ID}.interface`)) return;
  class InterfaceTour extends foundry.nue.Tour {
    async _postStep() {
      const tooltip=this.currentStep?.selector ? game.tooltip.tooltip : null;
      await super._postStep();
      // Foundry waits for a CSS transition to hide its popover; reduced-motion/overrides can omit that event.
      if(tooltip?.matches(":popover-open"))tooltip.hidePopover();
      // Retain the marker until the next TooltipManager activation resets its classes.
    }
    async _renderStep() {
      await super._renderStep();
      const root=this.currentStep.selector ? game.tooltip.tooltip : this.targetElement;
      root.classList.add("sf-interface-tour");
      for(const button of root.querySelectorAll(".step-button")) {
        button.tabIndex=0;
        button.setAttribute("aria-label",{exit:"Exit tutorial",previous:"Previous step",next:this.hasNext?"Next step":"Finish tutorial"}[button.dataset.action]);
        button.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();button.click();}});
      }
    }
    async _preStep() {
      await super._preStep();
      const step = this.currentStep;
      if (step.sidebarTab) { await ui[step.sidebarTab]?.activate(); ui.sidebar?.expand(); }
      const target = step.target && document.querySelector(step.target);
      // A hidden tray, empty canvas or closed sidebar must never strand the tutorial.
      step.selector = target?.getClientRects().length ? step.target : undefined;
    }
  }
  game.tours.register(SYSTEM_ID, "interface", new InterfaceTour({
    namespace: SYSTEM_ID, id: "interface", title: "Star Wars FFG · Interface tour",
    description: "Narrative dice, sheets, range tools, combat, journals and settings added to Foundry.",
    display: true, canBeResumed: true, restricted: false, steps: structuredClone(INTERFACE_TOUR)
  }));
}
export async function startInterfaceTour() {
  if (foundry.nue.Tour.tourInProgress) {
    ui.notifications.info("Finish or exit the current Foundry tour before starting the Star Wars tour.");
    return false;
  }
  registerInterfaceTour();
  await game.tours.get(`${SYSTEM_ID}.interface`).start();
  return true;
}
