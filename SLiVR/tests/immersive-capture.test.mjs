import test from 'node:test';
import assert from 'node:assert/strict';
import {captureImmersiveView} from '../src/shot-workspace/capture.js';
import {newDiagram,diagramErrors} from '../src/shot-workspace/model.js';
function fixture({surface='browser',cropError=false,blank=false,frame=true}={}){
 const calls=[];let stopped=0;
 const track={getSettings:()=>({displaySurface:surface}),stop:()=>stopped++,cropTo:async target=>{calls.push('crop');if(cropError)throw new Error('Wrong tab');}};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const ctx={measureText:s=>({width:s.length*6}),drawImage:()=>calls.push('pixels'),getImageData:()=>({data:new Uint8Array(blank?[0,0,0,255]:[50,60,70,255])}),fillRect(){},fillText(){}};
 const video={videoWidth:800,videoHeight:450,play:async()=>{},pause:()=>calls.push('pause'),requestVideoFrameCallback:fn=>{if(frame)queueMicrotask(fn);return 1;},cancelVideoFrameCallback:()=>calls.push('cancel-frame')};
 const doc={createElement:type=>type==='video'?video:{getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,AAAA'}};
 const win={navigator:{mediaDevices:{getDisplayMedia:options=>{calls.push(options);return Promise.resolve(stream);}}},CropTarget:{fromElement:async()=>({})},setTimeout,clearTimeout,setInterval,clearInterval};
 return {element:{isConnected:true},source:'Immersive',attribution:'Provider credit',context:{captureId:'CAP-001'},doc,win,calls,video,stopped:()=>stopped};
}
test('immersive capture requests no audio, crops before reading pixels and closes stream',async()=>{
 const f=fixture(),bg=await captureImmersiveView(f);
 assert.equal(f.calls[0].audio,false);assert.ok(f.calls.indexOf('crop')<f.calls.indexOf('pixels'));
 assert.equal(f.stopped(),1);assert.equal(f.video.srcObject,null);assert.equal(bg.oblique,true);
 assert.equal(bg.view.captureId,'CAP-001');assert.equal(bg.view.restoration,'entry-only');assert.deepEqual(diagramErrors(newDiagram(bg)),[]);
});
test('wrong surface and wrong tab never save pixels and release tracks',async()=>{
 for(const options of [{surface:'monitor'},{cropError:true}]){const f=fixture(options);await assert.rejects(captureImmersiveView(f));assert.equal(f.stopped(),1);assert.ok(!f.calls.includes('pixels'));}
});
test('blank image and stalled frame fail with cleanup',async()=>{
 const f=fixture({blank:true});await assert.rejects(captureImmersiveView(f),/blank/);assert.equal(f.stopped(),1);
 const slow=fixture({frame:false});await assert.rejects(captureImmersiveView({...slow,timeoutMs:10}),/not ready/);assert.equal(slow.stopped(),1);assert.equal(slow.video.srcObject,null);
});
test('cancel while browser chooser is pending closes a late stream',async()=>{
 const f=fixture();let resolve;f.win.navigator.mediaDevices.getDisplayMedia=()=>new Promise(r=>resolve=r);
 const controller=new AbortController(),pending=captureImmersiveView({...f,signal:controller.signal});controller.abort();
 await assert.rejects(pending,/cancelled/);let stopped=0;resolve({getTracks:()=>[{stop:()=>stopped++}]});await new Promise(r=>setImmediate(r));assert.equal(stopped,1);
});
test('unsupported browser gives image import fallback',async()=>{
 const f=fixture();delete f.win.CropTarget;await assert.rejects(captureImmersiveView(f),/import/);assert.equal(f.calls.length,0);
});
import {createShotActions} from '../src/shot-workspace/actions.js';
test('immersive source starts within the gesture and opens its own background, never the map',async()=>{
 let state={save:{state:'saved'},route:{name:'immersive'},routeResolution:{locationId:'LOC-001'},catalog:{version:'1',locations:[{id:'LOC-001',name:'Interior',position:[0,0]}]}};
 let started=false,mapCalled=false,destination;
 const actions=createShotActions({store:{getState:()=>state,setState:patch=>state={...state,...patch}},capture:()=>{mapCalled=true;},navigate:route=>destination=route,now:()=>new Date().toISOString()});
 const background=newDiagram().background;
 const pending=actions.startDiagram({captureView:()=>{started=true;return Promise.resolve(background);}});
 assert.equal(started,true);const result=await pending;
 assert.equal(result.ok,true);assert.equal(mapCalled,false);assert.equal(result.record.locationId,'LOC-001');assert.equal(result.record.diagram.background.id,background.id);assert.equal(destination.name,'shot');assert.equal(state.shotReturnRoute.name,'immersive');
});
