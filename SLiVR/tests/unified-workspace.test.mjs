import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFakeDom } from './fixtures/dom.mjs';
import { createToolWindows } from '../src/ui/tool-windows.js';
import { QUESTIONS } from '../src/scouting/assessment-template.js';

test('233: tool minimize/maximize/dock preserve mounted content and never create duplicate windows', () => {
 const {document,app,window}=createFakeDom();
 const tools=createToolWindows({doc:document,host:app,win:window});
 const t=tools.open('checklist','Scouting checklist');
 const frame=document.createElement('iframe'); t.body.append(frame);
 const click=label=>t.element.querySelectorAll('button').find(b=>b.textContent===label).click();
 click('Minimize');assert.equal(t.element.hidden,true);assert.equal(frame.parentNode,t.body);assert.equal(t.tab.hidden,false);
 assert.equal(tools.open('checklist','Scouting checklist'),t);
 click('Maximize');assert.equal(t.mode,'maximized');assert.equal(frame.parentNode,t.body);
 click('Restore');assert.equal(t.mode,'floating');
 click('Side by side');assert.equal(app.getAttribute('data-tool-docked'),'true');
 const other=tools.open('project','Project tools');other.element.querySelectorAll('button').find(b=>b.textContent==='Side by side').click();
 assert.equal(t.mode,'floating');assert.equal(other.mode,'docked');
 assert.equal(app.querySelectorAll('.tool-window').length,2);tools.destroy();
});

test('233: close waits for save approval and failed writes retain the tool and its draft', async () => {
 const {document,app,window}=createFakeDom();let safe=false;
 const tools=createToolWindows({doc:document,host:app,win:window,beforeClose:async()=>safe});
 const t=tools.open('checklist','Scouting checklist');const input=document.createElement('input');input.value='unsaved';t.body.append(input);
 t.element.querySelectorAll('button').find(b=>b.textContent==='Close').click();await new Promise(r=>setImmediate(r));
 assert.equal(t.mode,'floating');assert.equal(input.value,'unsaved');safe=true;
 t.element.querySelectorAll('button').find(b=>b.textContent==='Close').click();await new Promise(r=>setImmediate(r));assert.equal(t.mode,'closed');tools.destroy();
});

test('233: layout preferences survive a new manager and keyboard resizing does not change records', () => {
 const {document,app,window}=createFakeDom();const tools=createToolWindows({doc:document,host:app,win:window});
 const t=tools.open('checklist','Scouting checklist');t.heading.dispatch('keydown',{key:'ArrowRight',shiftKey:true,preventDefault(){}});
 assert.equal(t.geometry.w,780);tools.minimize('checklist');tools.destroy();
 const next=createToolWindows({doc:document,host:app,win:window});const restored=next.resume('checklist','Scouting checklist');
 assert.equal(restored.geometry.w,780);assert.equal(restored.mode,'minimized');next.reset();assert.equal(restored.geometry.w,760);next.destroy();
});

test('234: embedded V2 keeps the exact source stylesheet and every supported question without a second database or capture scripts', () => {
 const html=readFileSync(new URL('../src/scouting/v2/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/scouting/v2/style.css',import.meta.url));
 assert.equal(createHash('sha256').update(css).digest('hex'),'3b4ec224bc942b998cb8055c4df82e901bcf07d9a977dfd3ebd1b8d394750dcc');
 for(const q of QUESTIONS)assert.ok(html.includes(`id="${q.id}"`),q.id);
 assert.equal((html.match(/data-section="/g)||[]).length,8);
 for(const excluded of ['owner-contact-name','contact-information','btnGeoLocate','btnCompass','btnNoiseMeter','capture360.js','install.js','db.js','app.js','<script','manifest.json'])assert.ok(!html.includes(excluded),excluded);
 assert.ok(html.includes('vendor/fonts/inter.css'));assert.ok(html.includes('vendor/fontawesome/solid.min.css'));
 assert.ok(html.includes('class="counter"'));assert.ok(html.includes('class="switch"'));assert.ok(html.includes('class="doc-grid"'));
});

test('235: phone tools are exclusive and retain drafts and desktop geometry', () => {
 const {document,app,window}=createFakeDom();window.innerWidth=390;
 const tools=createToolWindows({doc:document,host:app,win:window});
 const checklist=tools.open('checklist','Scouting checklist');
 const frame=document.createElement('iframe');checklist.body.append(frame);
 const geometry={...checklist.geometry};
 const project=tools.open('project','Project tools');
 assert.equal(checklist.element.hidden,true);assert.equal(project.element.hidden,false);
 assert.equal(frame.parentNode,checklist.body);
 tools.open('checklist','Scouting checklist');assert.equal(project.element.hidden,true);
 checklist.element.querySelectorAll('button').find(b=>b.textContent==='View + tool').click();
 assert.equal(app.getAttribute('data-mobile-tool'),'half');
 assert.deepEqual(checklist.geometry,geometry);
 tools.hideAll();assert.equal(app.getAttribute('data-mobile-tool'),'none');
 assert.equal(checklist.element.hidden,true);assert.equal(frame.parentNode,checklist.body);
 tools.destroy();
});
