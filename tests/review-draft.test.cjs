const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../js/core.js');
const draft={trackingStatus:'En Progreso',indicatorChange:'mejorado',responsible:'• Ana',correctiveMeasures:'• Reparar',monitoringComments:'• Se verificó',nextReviewDate:'2026-12-01'};
test('saving a review draft appends a snapshot and leaves earlier reviews unchanged',()=>{
 const ind={score:0,action:'• Instalar',history:[]};
 Core.saveReviewDraft(ind,draft,[],'2026-10-14T10:00:00Z');
 const first=JSON.stringify(ind.history[0]);
 Core.saveReviewDraft(ind,{...draft,indicatorChange:'empeorado'},[],'2026-10-15T10:00:00Z');
 assert.equal(ind.history.length,2);assert.equal(JSON.stringify(ind.history[0]),first);
 assert.equal(ind.history[1].indicatorChange,'empeorado');assert.equal(ind.monitoringComments,draft.monitoringComments);
});
test('invalid or full-history review drafts leave the indicator unchanged',()=>{
 const ind={score:0,action:'Instalar',history:[]},before=JSON.stringify(ind);
 assert.throws(()=>Core.saveReviewDraft(ind,{...draft,nextReviewDate:'2026-02-30'},[]));assert.equal(JSON.stringify(ind),before);
 ind.history=Array.from({length:200},()=>({recordedAt:'2026-01-01T00:00:00Z'}));const full=JSON.stringify(ind);
 assert.throws(()=>Core.saveReviewDraft(ind,draft,[]),/200/);assert.equal(JSON.stringify(ind),full);
});
