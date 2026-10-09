import test from 'node:test';
import assert from 'node:assert/strict';
const example = {schema_version:1,username:'sample',caption:'Exact caption 🌲\n#tag',shortcode:'Test',post_url:'https://www.instagram.com/p/Test/',media_count:3,
  media:[{index:1,type:'image',extension:'jpg',url:'https://scontent.cdninstagram.com/1.jpg'},
    {index:2,type:'video',extension:'mp4',url:'https://scontent.cdninstagram.com/2.mp4'},
    {index:3,type:'image',extension:'jpg',url:'https://scontent.cdninstagram.com/3.jpg'}]};
function element(){return{disabled:false,hidden:false,className:'',textContent:'',listeners:{},append(){},replaceChildren(){},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;}};}
async function setup(download) {
  const nodes=new Map();
  globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element};
  globalThis.location={search:'?tab=10'};
  globalThis.window={addEventListener(){}};
  const states=new Map();const saved=[];let sequence=0;
  globalThis.chrome={scripting:{executeScript:async()=>[{result:{ok:true,post:structuredClone(example)}}]},downloads:{
    download:async options=>{
      const result=await download(options);
      const id=++sequence;
      states.set(id,{id,state:'complete',filename:options.filename,fileSize:123,mime:options.url.startsWith('blob:')?'application/json':'image/jpeg'});
      saved.push({...options,text:result});return id;
    },search:async({id})=>[states.get(id)]}};
  await import(`../dashboard.js?test=${Math.random()}`);
  for(let i=0;i<100&&document.getElementById('save').disabled;i++)await new Promise(r=>setTimeout(r,1));
  return {nodes,saved};
}
test('full download flow preserves caption and reports partial media failure honestly',async()=>{
  const {nodes,saved}=await setup(async options=>{
    if(options.url.startsWith('blob:'))return await(await fetch(options.url)).text();
    if(options.url.endsWith('/2.mp4'))throw new Error('SERVER_FORBIDDEN');
    return null;
  });
  assert.equal(nodes.get('username').textContent,'@sample');
  await nodes.get('save').listeners.click();
  assert.equal(saved.length,4); // caption + 2 completed media + metadata
  assert.equal(saved[0].text,'@sample\nhttps://www.instagram.com/p/Test/\n\nExact caption 🌲\n#tag\n');
  const metadata=JSON.parse(saved.at(-1).text);
  assert.equal(metadata.download_status,'partial');
  assert.deepEqual(metadata.downloads.map(d=>d.status),['complete','failed_or_pending','complete']);
  assert.equal(metadata.downloads[1].error,'SERVER_FORBIDDEN');
  assert.match(nodes.get('status').textContent,/2\/3 media files saved/);
  assert.equal(nodes.get('status').className,'error');
});
test('metadata write failure cannot produce a successful bundle status',async()=>{
  const {nodes}=await setup(async options=>{
    if(options.filename.endsWith('metadata.json'))throw new Error('FILE_ACCESS_DENIED');
    return options.url.startsWith('blob:')?await(await fetch(options.url)).text():null;
  });
  await nodes.get('save').listeners.click();
  assert.match(nodes.get('status').textContent,/Bundle incomplete: FILE_ACCESS_DENIED/);
  assert.equal(nodes.get('status').className,'error');
});
test('complete bundle contains all ordered media and both sidecars',async()=>{
  const {nodes,saved}=await setup(async options=>options.url.startsWith('blob:')?await(await fetch(options.url)).text():null);
  await nodes.get('save').listeners.click();
  assert.equal(saved.length,5);
  assert.deepEqual(saved.map(file=>file.filename.split('/').at(-1)), ['sample_Test_caption.txt','sample_Test_01_image.jpg','sample_Test_02_video.mp4','sample_Test_03_image.jpg','sample_Test_metadata.json']);
  assert.equal(JSON.parse(saved.at(-1).text).download_status,'complete');
  assert.match(nodes.get('status').textContent,/Saved all 3 media files with caption and metadata/);
});
