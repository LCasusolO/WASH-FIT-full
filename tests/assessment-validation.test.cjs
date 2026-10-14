const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../js/core.js');
function load() {
 let app;
 const context = vm.createContext({Vue: {ref:value=>({value}), computed:getter=>({get value(){return getter()}}),onMounted(){},nextTick(){},watch(){},createApp:options=>({mount(){app=options.setup()}})},window:{innerWidth:1200,scrollTo(){}},navigator:{onLine:true},WashStorage:{createStore:()=>({})},setTimeout(){},clearTimeout(){},Date,Intl});
 for(const file of ['js/core.js','js/data/indicators.js','js/app.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context);
 return app;
}
test('unanswered indicators require the no-aplica prefix and an actual written reason',()=>{
 for(const notes of ['', '   ', 'No aplica', 'No aplica porque no existe', 'INDICADOR NO APLICA', 'INDICADOR NO APLICA ...', 'INDICADOR NO APLICA 123', 'INDICADOR NO APLICA XQ', 'INDICADOR NO APLICA XQ ....', 'INDICADOR NO APLICA XQ 123']) assert.equal(Core.assessmentComplete({score:null,notes}),false,notes);
 for(const notes of ['INDICADOR NO APLICA no se utiliza incinerador.', ' indicador no aplica: no existe este servicio ', 'INDICADOR NO APLICA XQ no se utiliza incinerador.', ' indicador no aplica xq: el servicio no existe ', 'INDICADOR   NO APLICA XQ no hay pacientes hospitalizados']) assert.equal(Core.assessmentComplete({score:null,notes}),true,notes);
 for(const score of [0,1,2]) assert.equal(Core.assessmentComplete({score,notes:''}),true);
});
test('domain tabs, next domain and leaving for later steps all reject incomplete current domain',()=>{
 const app=load();app.activeView.value='assessment';
 app.navigateNextModule();assert.equal(app.activeModuleTab.value,'water');assert.ok(app.assessmentPending.value.length>0);
 app.selectAssessmentModule('sanitation');assert.equal(app.activeModuleTab.value,'water');
 for(const view of ['step3','step4','step5','dashboard']) {app.switchView(view);assert.equal(app.activeView.value,'assessment');}
 app.switchView('general');assert.equal(app.activeView.value,'general');
});
test('mixed answers and justified non-applicable indicators allow advancing, without requiring hidden indicators',()=>{
 const app=load();app.activeView.value='assessment';
 const visible=app.getFilteredIndicatorsByModule.value;
 visible.forEach((ind,index)=>{ind.score=index%2?0:null;ind.notes=index%2?'':'INDICADOR NO APLICA XQ no se presta este servicio';});
 assert.equal(app.assessmentPending.value.length,0);
 const hidden=app.indicators.value.find(ind=>ind.code==='A_1b');assert.equal(hidden.score,null);
 app.navigateNextModule();assert.equal(app.activeModuleTab.value,'sanitation');assert.equal(app.assessmentAttempted.value,false);
 app.navigateNextModule();assert.equal(app.activeModuleTab.value,'sanitation');
});
test('removing an answer invalidates the domain again and the last domain guards the next step',()=>{
 const app=load();app.activeView.value='assessment';
 app.getFilteredIndicatorsByModule.value.forEach(ind=>ind.score=2);
 const first=app.getFilteredIndicatorsByModule.value[0];app.setIndicatorScore(first,2);
 app.navigateNextModule();assert.equal(app.activeModuleTab.value,'water');
 first.notes='INDICADOR NO APLICA XQ no existe el servicio';app.selectAssessmentModule('management');assert.equal(app.activeModuleTab.value,'management');
 app.switchView('step3');assert.equal(app.activeView.value,'assessment');
 app.getFilteredIndicatorsByModule.value.forEach(ind=>ind.score=1);
 app.switchView('step3');assert.equal(app.activeView.value,'step3');
});

test('an incomplete current domain can return to a completed domain, but cannot jump to another incomplete domain',()=>{
 const app=load();app.activeView.value='assessment';
 app.getFilteredIndicatorsByModule.value.forEach(ind=>{ind.notes='INDICADOR NO APLICA no existe este servicio';});
 app.navigateNextModule();assert.equal(app.activeModuleTab.value,'sanitation');
 assert.ok(app.assessmentPending.value.length>0);
 app.selectAssessmentModule('water');assert.equal(app.activeModuleTab.value,'water');
 app.selectAssessmentModule('sanitation');assert.equal(app.activeModuleTab.value,'sanitation');
 app.selectAssessmentModule('waste');assert.equal(app.activeModuleTab.value,'sanitation');
 // An earlier answer that was removed makes that destination incomplete again.
 app.indicators.value.find(ind=>ind.code==='A_1a').notes='';
 app.selectAssessmentModule('water');assert.equal(app.activeModuleTab.value,'sanitation');
});
