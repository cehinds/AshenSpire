// Gallery-only renderer. Every rendered view owns an independent state record.
(() => {
  const config = () => window.PROGRESSION_CONFIG;
  const samples = () => window.PROGRESSION_SAMPLES;
  const instances = new Map();
  let sequence = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function createState(id, supplied) {
    const cfg = config();
    const state = { key: `progression-${++sequence}`, id, category: id === 'W1x2' ? cfg.categoryIds.skills : id === 'W1x1' ? cfg.categoryIds.weapons : cfg.defaultCategory, selected: supplied?.id || null, supplied, awards: {}, showLockedTechniques: cfg.showLockedTechniques, showHistory: cfg.showHistory, previewAward: cfg.previewAward, closed: false };
    instances.set(state.key, state); return state;
  }
  function selected(state) {
    const entries = samples().filter(item => item.category === state.category);
    return { entries, entry: state.supplied || entries.find(item => item.id === state.selected) || entries[0] };
  }
  function meter(entry, state) {
    const cfg = config();
    const value = Math.min(entry.required, entry.progress + (state.awards[entry.id] || 0));
    const percent = entry.required > 0 ? Math.max(cfg.progressMinimum, Math.min(cfg.progressMaximum, value / entry.required * cfg.progressMaximum)) : cfg.progressMinimum;
    return `<div class="pg-meter-group" data-component="WGP2"><div class="pg-fact"><span>Practice</span><span>${value} / ${entry.required}</span></div><div class="pg-meter" role="progressbar" aria-label="${escape(entry.name)} practice" aria-valuemin="${cfg.progressMinimum}" aria-valuemax="${entry.required}" aria-valuenow="${value}"><span style="width:${percent}%"></span></div></div>`;
  }
  function techniques(entry,state) {
    return `<section data-component="WGP3"><h4>Known techniques</h4>${entry.techniques.filter(item => item.known || state.showLockedTechniques).map(item => `<div class="pg-fact"><span>${item.known ? escape(item.name) : 'Undiscovered'}</span><span>${item.known ? 'Available' : 'Locked'}</span></div>`).join('')}</section>`;
  }
  function benefit(entry) { return `<section data-component="WGP4"><h4>Next benefit</h4><p>${escape(entry.next)}</p></section>`; }
  function component(id,entry,state) {
    if (id === 'WGP2') return meter(entry,state);
    if (id === 'WGP3') return techniques(entry,state);
    if (id === 'WGP4') return benefit(entry);
    if (id === 'WGP1') return `<button class="pg-list-row" data-pg-entry="${escape(entry.id)}" aria-pressed="${selected(state).entry.id === entry.id}"><span class="pg-fact"><span>${escape(entry.name)}</span><span>Rank ${entry.rank}</span></span>${meter(entry,state)}</button>`;
    return `<div class="pg-component-sample">${component('WGP1',entry,state)}${benefit(entry)}${techniques(entry,state)}</div>`;
  }
  function styleTokens() {
    const cfg=config();
    return Object.entries({'bg':cfg.colors.background,'inset':cfg.colors.inset,'text':cfg.colors.text,'muted':cfg.colors.muted,'gold':cfg.colors.gold,'progress':cfg.colors.progress,'danger':cfg.colors.danger,'gap':cfg.layout.gap,'padding':cfg.layout.inset,'meter-height':cfg.layout.meterHeight}).map(([name,value])=>`--pg-${name}:${escape(value)}`).join(';');
  }
  function controls(state,entry) {
    const cfg=config(),refs=state.id.startsWith('WGP')?({WGP0:['WGP1','WGP2','WGP3','WGP4'],WGP1:['WCI1','WGP2'],WGP2:['WCM2'],WGP3:['WCF4'],WGP4:['WCF4']}[state.id]||[]):['WGP1','WGP2','WGP3','WGP4','WCB4','WCB5'];
    return `<div class="pg-preview-tools" aria-label="Preview configuration"><label><input type="checkbox" data-pg-setting="showLockedTechniques" ${state.showLockedTechniques?'checked':''}> Show locked techniques</label><label><input type="checkbox" data-pg-setting="showHistory" ${state.showHistory?'checked':''}> Show history</label>${cfg.allowPreviewAward?`<label>Award amount <input type="number" min="${cfg.progressMinimum}" value="${state.previewAward}" data-pg-setting="previewAward"></label><button data-pg-award="${entry.id}">${escape(cfg.labels.award)}</button>`:''}<button data-pg-reset>Reset preview</button>${state.closed?'<button data-pg-reopen>Reopen</button>':''}<span aria-live="polite">Illustrative fixture; no game changes.</span><nav class="pg-component-links" aria-label="Referenced components">${refs.map(id=>`<a href="#${id}">${id}</a>`).join(' ')}</nav></div>`;
  }
  function render(state) {
    const { entries, entry }=selected(state),cfg=config();
    const categoryOptions=cfg.categories.map(value=>`<option value="${escape(value)}" ${value===state.category?'selected':''}>${escape(value[0].toUpperCase()+value.slice(1))}</option>`).join('');
    const content=state.id.startsWith('WGP')?`<div class="pg-standalone" data-component="${escape(state.id)}">${component(state.id,entry,state)}</div>`:`<article class="pg-workspace" data-component="W1x" ${state.closed?'hidden':''}><header><strong>${escape(cfg.labels.title)}</strong><button data-component="WCB5" data-pg-close aria-label="Close proficiencies">×</button></header><div class="pg-body"><nav aria-label="Proficiency category">${cfg.categories.map(value=>`<button data-pg-category="${escape(value)}" aria-pressed="${value===state.category}">${escape(value[0].toUpperCase()+value.slice(1))}</button>`).join('')}</nav><div class="pg-list">${entries.map(item=>component('WGP1',item,state)).join('')}</div><div class="pg-mobile-navigation"><select aria-label="Proficiency category" data-pg-category-select>${categoryOptions}</select><select aria-label="Proficiency" data-pg-entry-select>${entries.map(item=>`<option value="${item.id}" ${item.id===entry.id?'selected':''}>${escape(item.name)}</option>`).join('')}</select></div><div class="pg-details"><div class="pg-fact pg-identity"><strong>${escape(entry.name)}</strong><span>Rank ${entry.rank}</span></div>${meter(entry,state)}${benefit(entry)}${techniques(entry,state)}${state.showHistory?`<section><h4>Recent practice</h4>${entry.history.map(text=>`<p>${escape(text)}</p>`).join('')}</section>`:''}</div></div><footer><button data-component="WCB4" data-pg-close>${escape(cfg.labels.back)}</button></footer></article>`;
    return `<div class="pg-host" data-pg-root="${escape(state.id)}" data-pg-instance="${state.key}" style="${styleTokens()}">${content}${controls(state,entry)}</div>`;
  }
  window.renderProgression=function(id='W1x') { if(!config()||!samples())return '<p>Progression reference data has not been loaded.</p>';return render(createState(id)); };
  window.renderProgressionComponent=function(id,supplied){return render(createState(id,supplied));};
  function rootState(target){const root=target.closest('[data-pg-instance]');return root?{root,state:instances.get(root.dataset.pgInstance)}:{};}
  function refresh(root,state){root.outerHTML=render(state);}
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-pg-category],[data-pg-entry],[data-pg-award],[data-pg-close],[data-pg-reopen],[data-pg-reset]');if(!target)return;
    const {root,state}=rootState(target);if(!state)return;
    if(target.hasAttribute('data-pg-close'))state.closed=true;
    if(target.hasAttribute('data-pg-reopen'))state.closed=false;
    if(target.dataset.pgCategory){state.category=target.dataset.pgCategory;state.selected=null;state.supplied=null;}
    if(target.dataset.pgEntry)state.selected=target.dataset.pgEntry;
    if(target.dataset.pgAward)state.awards[target.dataset.pgAward]=(state.awards[target.dataset.pgAward]||0)+state.previewAward;
    if(target.hasAttribute('data-pg-reset')){const fresh=createState(state.id,state.supplied);instances.delete(state.key);refresh(root,fresh);return;}
    refresh(root,state);
  });
  document.addEventListener('change',event=>{
    const {root,state}=rootState(event.target);if(!state)return;
    if(event.target.hasAttribute('data-pg-category-select')){state.category=event.target.value;state.selected=null;state.supplied=null;}
    else if(event.target.hasAttribute('data-pg-entry-select'))state.selected=event.target.value;
    else if(event.target.dataset.pgSetting){const key=event.target.dataset.pgSetting;if(key==='previewAward'){const value=Number(event.target.value);state.previewAward=Number.isFinite(value)?Math.max(config().progressMinimum,value):config().previewAward;}else if(key==='showHistory'||key==='showLockedTechniques')state[key]=event.target.checked;}
    else return;
    refresh(root,state);
  });
})();
