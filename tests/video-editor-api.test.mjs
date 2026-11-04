import test from 'node:test';
import assert from 'node:assert/strict';
import {videoEditorApi,EditorApiError} from '../src/lib/video-editor-api.ts';
const originalFetch=globalThis.fetch;
const originalXhr=globalThis.XMLHttpRequest;
test('save keeps distinct segment identities when one source is used twice',async()=>{
 let observed;
 globalThis.fetch=async(url,options)=>{observed={url,...options};return Response.json({data:{revision:3}});};
 try{const segments=[{id:'first',assetId:'source',start:0,end:2,volume:0},{id:'second',assetId:'source',start:4,end:6,volume:1}];await videoEditorApi.save('project',{revision:2,title:'Saved',aspectRatio:'9:16',segments});assert.equal(observed.url,'/api/proxy/video-editor/projects/project');assert.deepEqual(JSON.parse(observed.body),{revision:2,title:'Saved',aspectRatio:'9:16',segments});assert.equal(observed.cache,'no-store');}finally{globalThis.fetch=originalFetch;}
});
test('revision conflicts remain actionable and are not converted to success',async()=>{
 globalThis.fetch=async()=>Response.json({code:'REVISION_CONFLICT',message:'A newer revision exists'},{status:409});
 try{await assert.rejects(videoEditorApi.save('project',{revision:1,title:'Saved',aspectRatio:'1:1',segments:[]}),error=>error instanceof EditorApiError&&error.status===409&&error.code==='REVISION_CONFLICT');}finally{globalThis.fetch=originalFetch;}
});
test('retrying an export can preserve original request identity and revision',async()=>{
 const bodies=[];globalThis.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));return Response.json({data:{id:'existing-export'}});};
 try{await videoEditorApi.export('project','stable-id',7,'720p');await videoEditorApi.export('project','stable-id',7,'720p');assert.deepEqual(bodies,[{requestId:'stable-id',revision:7,resolution:'720p'},{requestId:'stable-id',revision:7,resolution:'720p'}]);}finally{globalThis.fetch=originalFetch;}
});
test('upload sends file and original retry ID, reports progress, and aborts in-flight transport',async()=>{
 const instances=[];
 class FakeXhr{upload={};open(method,url){this.method=method;this.url=url;}send(data){this.data=data;instances.push(this);}abort(){this.onabort();}}
 globalThis.XMLHttpRequest=FakeXhr;
 try{const controller=new AbortController(),progress=[];const promise=videoEditorApi.upload('project','same-file-id',new File(['source'],'clip.mp4',{type:'video/mp4'}),value=>progress.push(value),controller.signal);const xhr=instances[0];assert.equal(xhr.data.get('clientUploadId'),'same-file-id');assert.equal(xhr.data.get('file').name,'clip.mp4');assert.equal(xhr.url,'/api/proxy/video-editor/projects/project/assets');xhr.upload.onprogress({lengthComputable:true,loaded:5,total:10});assert.deepEqual(progress,[50]);controller.abort();await assert.rejects(promise,error=>error.name==='AbortError');}finally{globalThis.XMLHttpRequest=originalXhr;}
});
