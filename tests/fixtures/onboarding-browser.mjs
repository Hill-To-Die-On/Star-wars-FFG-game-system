class Application {
  async render() {
    const context=await this._prepareContext();this.element?.remove();
    const options=this.constructor.DEFAULT_OPTIONS,host=document.createElement(options.tag??"section");
    host.id=options.id;host.className="application "+options.classes.join(" ");
    host.innerHTML='<header class="window-header"><strong>'+options.window.title+'</strong></header><div class="window-content">'+Handlebars.templates.welcome(context)+'</div>';
    document.body.append(host);this.element=host;
    for(const button of host.querySelectorAll("[data-action]"))button.addEventListener("click",event=>Promise.resolve(options.actions[button.dataset.action].call(this,event,button)).catch(error=>fixture.errors.push(error.message)));
    fixture.presentation.styleSystemWindow(this,host);this._onRender(context,{});return this;
  }
  _onRender(){}
  async close(){this.element?.remove();this.element=null;}
}
globalThis.foundry={applications:{api:{ApplicationV2:Application,HandlebarsApplicationMixin:Base=>Base,DialogV2:{}}}};
const {DEFAULT_CAMPAIGN}=await import('/src/rules.mjs');
const state=JSON.parse(localStorage.getItem('fixture-campaign')??'null')??structuredClone(DEFAULT_CAMPAIGN);
globalThis.game={user:{isGM:new URL(location).searchParams.get('player')!=='1',getFlag:()=>JSON.parse(localStorage.getItem('fixture-progress')??'null'),async setFlag(_ns,_key,value){localStorage.setItem('fixture-progress',JSON.stringify(value));}},settings:{get:()=>state,async set(_ns,_key,value){Object.assign(state,value);localStorage.setItem('fixture-campaign',JSON.stringify(value));}}};
globalThis.ui={notifications:{error:message=>fixture.errors.push(message),warn:message=>fixture.warnings.push(message)}};
globalThis.fixture={errors:[],warnings:[],state,presentation:await import('/src/window-presentation.mjs')};
const {openWelcome,WelcomeWizard}=await import('/src/onboarding-foundry.mjs');
fixture.open=openWelcome;fixture.WelcomeWizard=WelcomeWizard;
const {needsOnboarding}=await import('/src/onboarding.mjs');
if(needsOnboarding(game.user.getFlag()))fixture.app=openWelcome();
fixture.ready=true;
