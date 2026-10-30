const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../js/core.js'),Pdf=require('../js/pdf-report.js');
test('report location includes the selected country name, with or without a city',()=>{
 for(const [district,countryCode,expected] of [['ZACATECAS','MEX','ZACATECAS / México'],['','PER','Perú'],['Lima','','Lima'],['','','Sin registrar']]){
  const generalInfo={...Core.defaults(),district,countryCode};
  assert.equal(Core.reportLocation(generalInfo),expected);
  const doc=Pdf.definition({savedAt:new Date().toISOString(),generalInfo,indicators:[]},[],[]);
  const location=doc.content.find(item=>Array.isArray(item.text)&&item.text[0]?.text==='Ciudad / país: ');
  assert.equal(location.text[1],expected);
 }
});
test('report omits indicator codes and presents plan, monitoring and history as tables',()=>{
 const i={code:'PRIVATE_CODE_123',title:'Indicador largo de ejemplo',moduleId:'water',module:'Agua',score:0,action:'• Reparar',resources:'• Jabón',responsible:'• Ana',severity:3,likelihood:4,indicatorChange:'mejorado',history:[]};
 Core.recordReview(i,[],'2026-10-13T23:00:25Z');
 const d=Pdf.definition({savedAt:new Date().toISOString(),generalInfo:Core.defaults(),indicators:[i]},[i.code],[{id:'water',name:'Agua'}]);
 assert.ok(!JSON.stringify(d).includes(i.code));
 const section=n=>{const start=d.content.findIndex(x=>x.style==='heading'&&x.text.startsWith('Paso '+n+':'));const end=d.content.findIndex((x,index)=>index>start&&x.style==='heading');return d.content.slice(start+1,end<0?undefined:end)};
 const assessment=section(2).find(x=>x.table);assert.equal(assessment.table.body[0][0].text,'Dominio');assert.equal(assessment.table.widths[1],'*');
 assert.ok(section(4).some(x=>x.table&&x.table.body[0].some(h=>h.text==='Recursos')));
 assert.equal(section(5).filter(x=>x.table).length,2);
 assert.ok(JSON.stringify(section(5)).includes('• Reparar'));
});
