const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const crypto=require('node:crypto');
const original=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const copy=fs.readFileSync(path.join(__dirname,'../refonte/index.html'),'utf8');
const OLD='plan-action-natran-istp:v1', NEW='plan-action-natran-istp:refonte-2026-11:v1';
const plain=x=>JSON.parse(JSON.stringify(x));
function runtime(html=copy,store=new Map()){
 const downloads=[],nodes=new Map();
 const stub={dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},addEventListener(){},querySelector(){return stub},querySelectorAll(){return []},focus(){this.focused=true}};
 const node=k=>{if(!nodes.has(k))nodes.set(k,{...stub});return nodes.get(k)};
 class Reader{readAsText(file){this.result=file.text;Promise.resolve().then(()=>this.onload());}}
 const c={console,Date,Intl,URL,Blob,TextEncoder,structuredClone,FileReader:Reader,crypto:crypto.webcrypto,setTimeout(){},clearTimeout(){},setInterval(){},document:{...stub,querySelector:node,documentElement:stub,body:stub},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},navigator:{},location:{hash:'#/dashboard'},history:{replaceState(){}},matchMedia:()=>({matches:false,addEventListener(){}})};
 c.window={...stub};c.window.self=c.window;c.window.top=c.window;c.captured=downloads;
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\ninit\(\);\n/,`\nrender=()=>{};applyLogos=()=>{};toast=()=>{};confirmDialog=async()=>true;download=async(name,data)=>{captured.push({name,data});return true};this.api={migrate,emptyState,saveNow,loadState,importJSONFile,exportJSON,KEY,get state(){return S},set state(x){S=x},get ui(){return UI},setRoute(x){R=x},views:VIEWS,actions:ACT,changes:CHG,inputs:INP,submits:SUB,filterActions,${html===copy?'rvBootstrapCopy,rvNavigation,rvProjectTable,rvMeetingCreate,rvMeetingSelect,rvMeetingNote,rvMeetingItems,rvMeetingPoint,rvSaveAction,':''}};`);
 vm.runInNewContext(script,c);c.api.loadState();return {a:c.api,store,downloads,c,nodes};
}
function fixture(){const {a}=runtime(original);const s=a.migrate(a.emptyState());s.profile.name='Ingénieur de test';s.settings.onbDone=true;s.settings.custom={keep:true};s.custom={unknown:[1,2]};s.projects=Array.from({length:7},(_,i)=>({id:'p'+i,ref:'P'+i,name:'Projet '+i,context:'natran',status:i===6?'done':'active',color:i+1,description:'Description '+i,comment:'Décision projet',roadmap:{quality:'Qualité à garder',unknown:73}}));s.actions=[{id:'a1',projectId:'p0',title:'Action existante',status:'doing',progress:35,phase:'Diagnostic',owner:'Ingénieur de test',due:'2026-11-01',risk:'Risque',decision:'Décision',log:[{id:'l1',date:'2026-10-16',text:'Compte rendu historique',progress:25}],checklist:[{id:'c1',text:'Contrôle',done:false}],skills:['sk_A3C1'],dependsOn:[],custom:42}];s.milestones=[{id:'m1',projectId:'p0',date:'2026-11-17',title:'Jalon existant',done:false}];s.journal=[{id:'j1',date:'2026-11-01',text:'Note de journal',projectId:'p0'}];s.istp.records.sk_A3C1.tutorComment='Commentaire conservé';return a.migrate(s);}
test('L’original publié reste byte-pour-byte identique au point de sauvegarde',()=>{
 const bytes=Buffer.from(original);assert.equal(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),'d6af4ce5b3216001882e1e502ee7a59629a2efca');
 assert.equal([...copy.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1],[...original.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1],'Moteur PDF inchangé');
});
test('La première ouverture duplique les données, préférences et restaurations sans écrire dans l’original',()=>{
 const raw=JSON.stringify(fixture()),ui=JSON.stringify({av:'kanban',afG:{q:'diagnostic'},heroMin:true}),snap=JSON.stringify([{data:raw,at:'2026-11-13'}]);const store=new Map([[OLD,raw],[OLD+':ui',ui],[OLD+':snapshots',snap]]);
 const {a}=runtime(copy,store);assert.equal(a.KEY,NEW);assert.equal(store.get(NEW),raw);assert.equal(store.get(NEW+':ui'),ui);assert.equal(store.get(NEW+':snapshots'),snap);assert.equal(a.ui.av,'kanban');a.state.actions[0].title='Essai distinct';a.saveNow();assert.equal(JSON.parse(store.get(OLD)).actions[0].title,'Action existante');assert.equal(store.get(OLD+':ui'),ui);assert.equal(store.get(OLD+':snapshots'),snap);
});
test('Les réouvertures ne réimportent jamais automatiquement une modification de l’original',()=>{
 const s=fixture(),store=new Map([[OLD,JSON.stringify(s)]]);const first=runtime(copy,store);first.a.state.actions[0].title='Travail dans la copie';first.a.saveNow();s.actions[0].title='Travail dans l’original';store.set(OLD,JSON.stringify(s));const next=runtime(copy,store);assert.equal(next.a.state.actions[0].title,'Travail dans la copie');assert.equal(next.a.rvBootstrapCopy(),false);assert.equal(JSON.parse(store.get(OLD)).actions[0].title,'Travail dans l’original');
});
test('JSON original → copie → original conserve toutes les données et champs inconnus',async()=>{
 const source=fixture(),{a,downloads}=runtime();a.importJSONFile({name:'avant.json',text:JSON.stringify(source)});await new Promise(setImmediate);a.exportJSON();await new Promise(setImmediate);const exported=downloads.at(-1);assert.match(exported.name,/^plan-action-refonte-/);const {a:back}=runtime(original);back.importJSONFile({name:exported.name,text:exported.data});await new Promise(setImmediate);for(const k of ['projects','actions','milestones','journal','skills','profile','istp','custom'])assert.deepEqual(plain(back.state[k]),plain(source[k]),k);assert.deepEqual(plain(back.state.settings.logos),plain(source.settings.logos));assert.deepEqual(plain(back.state.settings.custom),plain(source.settings.custom));
});
test('Toutes les commandes métier et toutes les routes restent accessibles',()=>{
 const {a:old}=runtime(original),{a}=runtime();a.state=fixture();for(const k of ['actions','changes','inputs','submits'])for(const name of Object.keys(old[k]))assert.ok(a[k][name],k+': '+name);
 for(const page of Object.keys(old.views)){a.setRoute({page,id:page==='projet'?'p0':undefined});const h=a.views[page]().html;assert.ok(h.length>20,page);assert.ok(!h.includes('Une erreur d’affichage'),page);}
 const nav=a.rvNavigation();for(const page of ['dashboard','projets','actions','journal','roadmap','gantt','planning','jalons','istp','parcours'])assert.ok(nav.includes('href="#/'+page+'"'),page);
 for(const tab of ['apercu','actions','gantt','planning','jalons','journal','analyse']){a.setRoute({page:'projet',id:'p0',tab});assert.ok(a.views.projet().html.includes('href="#/projet/p0/'+tab+'"'));}
 assert.match(a.views.projet().html,/Imprimer la fiche projet/);
});
test('La synthèse affiche tous les projets ouverts et permet de retrouver les clôturés sans modifier les données',()=>{
 const {a}=runtime();a.state=fixture();const before=JSON.stringify(a.state);a.setRoute({page:'dashboard'});let h=a.views.dashboard().html;assert.equal((h.match(/class="rv-project-name"/g)||[]).length,6);a.actions['rv-projects']({dataset:{v:'all'}});h=a.views.dashboard().html;assert.equal((h.match(/class="rv-project-name"/g)||[]).length,7);assert.ok(h.includes('Diagnostic'));assert.ok(h.includes('data-act="weekly-review"'));assert.ok(h.includes('data-act="point-hebdo"'));assert.ok(h.includes('data-act="export-json"'));assert.ok(h.includes('data-act="import-json"'));assert.equal(JSON.stringify(a.state),before);
});
test('Les cartes, filtres, liens de retard et raccourcis de synthèse ouvrent le bon périmètre',()=>{
 const {a,c}=runtime();a.state=fixture();a.setRoute({page:'projets'});assert.ok(a.views.projets().html.includes('rv-portfolio'));a.actions['rv-project-view']({dataset:{v:'cards'}});assert.ok(a.views.projets().html.includes('portfolio-grid'));a.ui.pf.ctx='istp';assert.ok(a.views.projets().html.includes('Aucun projet ne correspond'));a.ui.afG={q:'absent',project:'p6',status:'done'};a.actions['rv-stat']({dataset:{href:'#/actions/late'}});assert.equal(a.ui.afG.q,'');assert.equal(a.ui.afG.project,'all');assert.equal(c.location.hash,'#/actions/late');a.actions['rv-project-actions']({dataset:{id:'p0',status:'late'}});assert.equal(a.ui.afP.status,'late');assert.equal(a.ui.afP.group,true);assert.equal(c.location.hash,'#/projet/p0/actions');
});
test('La copie isolée ne reprend pas la liaison fichier et reste vide sans données originales',()=>{
 const {a}=runtime();assert.equal(a.state.projects.length,0);assert.ok(a.views.dashboard().html.includes('Importer ma sauvegarde'));assert.ok(copy.includes("indexedDB.open('plan-action-natran-istp-refonte-2026-11', 1)"));assert.ok(!copy.includes("indexedDB.open('plan-action-natran-istp', 1)"));assert.ok(copy.includes("suggestedName: 'plan-action-refonte-sauvegarde.json'"));assert.ok(copy.includes('href="../index.html#/dashboard"'));assert.ok(!copy.includes('qa-import-refonte'));
});
test('Une réunion référence les données réelles sans les dupliquer ni valider les compétences',()=>{
 const {a}=runtime();a.state=fixture();const original=JSON.stringify({actions:a.state.actions,skills:a.state.skills,istp:a.state.istp});
 const m=a.rvMeetingCreate({title:'Point tuteur',date:'2026-11-17',since:'2026-10-01',participants:'Tuteur'});
 a.rvMeetingSelect(m,'a:a1',true);a.rvMeetingSelect(m,'a:a1',true);a.rvMeetingSelect(m,'s:sk_A3C1',true);
 assert.equal(m.items.length,2);a.rvMeetingNote(m,'s:sk_A3C1','Décision à confirmer, sans validation officielle');
 assert.equal(JSON.stringify({actions:a.state.actions,skills:a.state.skills,istp:a.state.istp}),original);
 const point=a.rvMeetingItems(m)[0];assert.match(a.rvMeetingPoint(m,point,0),/Compte rendu historique/);
 a.state.actions[0].title='Intitulé mis à jour dans le projet';assert.match(a.rvMeetingPoint(m,a.rvMeetingItems(m)[0],0),/Intitulé mis à jour dans le projet/);
 m.since='2026-11-01';assert.doesNotMatch(a.rvMeetingPoint(m,point,0),/Compte rendu historique/);
});
test('Réunions, sélection et notes survivent au rechargement et au cycle JSON complet',async()=>{
 const {a,store,downloads}=runtime();a.state=fixture();const m=a.rvMeetingCreate({title:'EEE',date:'2026-11-17',since:'2026-10-01'});a.rvMeetingSelect(m,'a:a1',true);a.rvMeetingNote(m,'a:a1','Suite convenue');a.saveNow();
 const next=runtime(copy,store);assert.deepEqual(plain(next.a.state.meetings),plain(a.state.meetings));
 a.exportJSON();await new Promise(setImmediate);const back=runtime();back.a.importJSONFile({name:'reunion.json',text:downloads.at(-1).data});await new Promise(setImmediate);assert.deepEqual(plain(back.a.state.meetings),plain(a.state.meetings));
 back.a.importJSONFile({name:'reunion.json',text:downloads.at(-1).data});await new Promise(setImmediate);assert.equal(back.a.state.meetings.length,1);
});
test('Réunion : reprise de la sélection EEE, retrait, élément absent et impression de tous les points',()=>{
 const {a}=runtime();a.state=fixture();const ev=a.state.istp.evaluations[0];ev.skillIds=['sk_A3C1'];const m=a.rvMeetingCreate({title:'EEE',date:'2026-11-17',since:'2026-10-01',evaluationId:ev.id});assert.deepEqual(plain(m.items),['s:sk_A3C1']);a.rvMeetingSelect(m,'a:a1',true);a.setRoute({page:'reunion',id:m.id,tab:'presenter'});const html=a.views.reunion().html;assert.match(html,/rv-meeting-print/);assert.match(html,/Compte rendu historique/);assert.equal((html.match(/id="rm-note-0"/g)||[]).length,1);
 a.rvMeetingSelect(m,'a:a1',false);assert.equal(m.items.length,1);m.items.push('a:absent');assert.match(a.rvMeetingPoint(m,a.rvMeetingItems(m)[1],1),/Élément supprimé ou introuvable/);
});
test('La fiche latérale préserve les détails, utilise les récurrences métier et refuse une date incohérente',()=>{
 const {a}=runtime();a.state=fixture();const original=plain(a.state.actions[0]);a.state.actions[0].recur='weekly';a.state.actions[0].start='2026-10-01';const before=JSON.stringify(a.state);
 assert.equal(a.rvSaveAction('a1',{due:'2026-09-01',next:'',status:'done',log:'',logDate:'2026-11-13'}),false);assert.equal(JSON.stringify(a.state),before);
 a.rvSaveAction('a1',{due:'2026-11-17',next:'Tester',status:'done',log:'Note de contrôle',logDate:'2026-11-13'});
 const updated=a.state.actions.find(x=>x.id==='a1');assert.equal(updated.status,'done');assert.equal(updated.log.length,2);assert.equal(updated.log[0].text,'Compte rendu historique');assert.equal(updated.risk,original.risk);assert.equal(updated.decision,original.decision);assert.deepEqual(plain(updated.skills),original.skills);assert.ok(updated.recurNext);assert.ok(a.state.actions.find(x=>x.id===updated.recurNext));assert.notEqual(a.state.istp.records.sk_A3C1.status,'validated');
});
