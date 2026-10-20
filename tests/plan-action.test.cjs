// Run with: node --test tests/plan-action.test.cjs
// Model/render checks only. Browser interactions are verified separately.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function app() {
  const node = {dataset:{},style:{},classList:{add(){},remove(){}},addEventListener(){},querySelector(){return node},querySelectorAll(){return []}};
  const store = new Map();
  const context = {console,Date,Intl,URL,Blob,TextEncoder,structuredClone,crypto:require('node:crypto').webcrypto, setTimeout(){},clearTimeout(){},setInterval(){},document:{...node,documentElement:node,body:node},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},navigator:{},location:{hash:''},matchMedia:()=>({matches:false,addEventListener(){}})};
  context.window = {...node,self:null,top:null,addEventListener(){}};
  context.window.self=context.window;context.window.top=context.window;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\ninit\(\);\n/,`\nthis.api = {migrate,emptyState,validData,projectProgress,actionProgress,applyStatus,saveNow,loadState,readSnaps,snapshotDaily,filterActions,doSearch, get state(){return S}, set state(v){S=v}, get ui(){return UI}, setRoute(v){R=v}, views:VIEWS,results:actionsResults, KEY};\n`);
  vm.runInNewContext(script,context);
  const a=context.api;a.state=a.migrate(a.emptyState());return a;
}
function fixture(a) {
  const s=a.emptyState();s.profile.name='Test';s.settings.onbDone=true;
  s.projects=[{id:'p1',name:'Projet <test>',context:'natran',status:'active',color:4,objectives:'Livrable',comment:'Décision conservée'}];
  s.actions=[{id:'a1',projectId:'p1',title:'Action test',owner:'Test',status:'doing',progress:40,priority:'high',start:'2026-10-01',due:'2026-10-18',phase:'Cadrage',risk:'risque',decision:'décision',skills:[],checklist:[],dependsOn:[],log:[{id:'l1',date:'2026-10-12',text:'Suivi conservé',progress:40}]}];
  s.milestones=[{id:'m1',projectId:'p1',title:'Validation',date:'2026-10-30',done:false}];
  return a.migrate(s);
}
test('Existing backup keeps IDs, comments, risks, decisions and dated action logs',()=>{
 const a=app();const s=fixture(a);a.state=s;a.saveNow();a.state=null;a.loadState();
 assert.equal(a.KEY,'plan-action-natran-istp:v1');
 assert.deepEqual(JSON.parse(JSON.stringify(a.state.projects)),JSON.parse(JSON.stringify(s.projects)));
 assert.deepEqual(JSON.parse(JSON.stringify(a.state.actions)),JSON.parse(JSON.stringify(s.actions)));
 assert.equal(a.projectProgress(a.state.projects[0]),40);
 a.snapshotDaily(true);assert.equal(a.readSnaps().length,1);
});
test('All destinations render with populated data and preserve advanced information',()=>{
 const a=app();a.state=fixture(a);
 for(const page of ['dashboard','projets','actions','gantt','planning','jalons','journal','competences','parcours','parametres']){
  a.setRoute({page});const out=a.views[page]();assert.ok(out.html.length>20,page);
 }
 for(const tab of ['apercu','actions','planning','gantt','jalons','journal','analyse']){
  a.setRoute({page:'projet',id:'p1',tab});assert.ok(a.views.projet().html.includes('Projet &lt;test&gt;'));
 }
 assert.ok(a.views.projet().html.includes('risque'));
});
test('Essential/detailed lists and filters agree; completion updates project progress',()=>{
 const a=app();a.state=fixture(a);a.setRoute({page:'actions'});
 assert.ok(a.results(null).includes('essential-table'));
 a.ui.actionDetail=true;assert.ok(a.results(null).includes('Avancement'));
 a.ui.afG.q='absent';assert.equal(a.filterActions(a.state.actions,null).length,0);
 a.ui.afG.q='';a.applyStatus(a.state.actions[0],'done');assert.equal(a.projectProgress(a.state.projects[0]),100);
 assert.equal(a.filterActions(a.state.actions,null).length,0);
 a.ui.afG.status='all';assert.equal(a.filterActions(a.state.actions,null).length,1);
 assert.equal(a.doSearch('Suivi conservé').length,1);
});
test('Project phases remain visible and global actions identify their project even after filtering',()=>{
 const a=app();a.state=fixture(a);
 a.state.projects.push({...a.state.projects[0],id:'p2',name:'Second projet'});
 a.state.actions.push({...a.state.actions[0],id:'a2',projectId:'p2',title:'Autre action'});
 a.setRoute({page:'projet',id:'p1',tab:'apercu'});
 const overview=a.views.projet().html;
 assert.ok(overview.includes('Avancement par phase'));
 assert.ok(overview.includes('Cadrage'));
 assert.ok(!overview.includes('Autre action'));
 a.setRoute({page:'actions'});
 let out=a.results(null);
 assert.equal((out.match(/class="project-group-row"/g)||[]).length,2);
 a.ui.afG.project='p2';out=a.results(null);
 assert.ok(out.includes('Second projet'));
 assert.ok(!out.includes('Projet &lt;test&gt;'));
 assert.ok(out.includes('action-project'));
 a.ui.afG.project='all';a.ui.afG.group=true;
 assert.equal((a.results(null).match(/class="project-group-row"/g)||[]).length,2);
});
test('Empty app stays empty and offers import instead of fabricated projects',()=>{
 const a=app();assert.equal(a.state.projects.length,0);assert.equal(a.state.actions.length,0);
 assert.ok(a.views.dashboard().html.includes('Importer ma sauvegarde'));
});
