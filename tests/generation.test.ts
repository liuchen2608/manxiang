import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generate, requestSchema, GenerationError } from '../lib/generation';
import { imagePrompt, sampleProject } from '../lib/comic';
const sample=sampleProject();
const valid={action:'plan' as const,story:'一个怕黑的小女孩遇见一只邮差猫',style:'日系彩漫' as const,count:4 as const};
test('reject invalid count, short story and external image reference',()=>{
 assert.equal(requestSchema.safeParse({...valid,count:100}).success,false);
 assert.equal(requestSchema.safeParse({...valid,story:'hi'}).success,false);
 assert.equal(requestSchema.safeParse({action:'image',style:valid.style,characters:sample.characters,panel:sample.panels[0],reference:'https://attacker.example/image.png'}).success,false);
});
test('plan schema enforces the requested panel count',async()=>{
 const fake=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...sample,panels:sample.panels.concat(sample.panels.slice(0,2))})}}]});
 await assert.rejects(generate(valid,'test',fake as typeof fetch),/分镜数量/);
});
test('valid generated plan is parsed, stripping untrusted extra fields',async()=>{
 let upstream='';const fake=async(input:RequestInfo|URL,init?:RequestInit)=>{upstream=String(input);const body=JSON.parse(String(init?.body));assert.equal(body.response_format.json_schema.strict,true);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(sample)}}]});};
 const result=await generate(valid,'test',fake as typeof fetch);assert.equal(upstream,'https://api.openai.com/v1/chat/completions');assert.ok('panels' in result);assert.equal('demo' in result,false);
});
test('API errors do not expose provider response or secret',async()=>{
 const fake=async()=>Response.json({error:{message:'sensitive upstream detail'}},{status:401});
 await assert.rejects(generate(valid,'secret',fake as typeof fetch),e=>e instanceof GenerationError&&e.status===401&&!e.message.includes('secret')&&!e.message.includes('sensitive'));
});
test('render uses reference image and current character appearance via edits',async()=>{
 const cast=[{...sample.characters[0],appearance:'紫色雨衣，绿色短靴'}];
 const fake=async(input:RequestInfo|URL,init?:RequestInit)=>{assert.equal(String(input),'https://api.openai.com/v1/images/edits');assert.ok(init?.body instanceof FormData);assert.match(String(init.body.get('prompt')),/紫色雨衣/);assert.ok(init.body.get('image[]') instanceof Blob);assert.equal(init.body.get('response_format'),null);return Response.json({data:[{b64_json:'YWJj'}]});};
 const r=await generate({action:'image',style:valid.style,characters:cast,panel:sample.panels[0],reference:'data:image/png;base64,YWJj'},'test',fake as typeof fetch);assert.deepEqual(r,{image:'data:image/png;base64,YWJj'});
});
test('captions remain separate from rendered artwork',()=>{const panel={...sample.panels[0],dialogue:'独立排版的台词'};assert.ok(!imagePrompt(sample,panel).includes(panel.dialogue));});
test('DeepSeek text requests reach DeepSeek with JSON mode',async()=>{
 const fake:typeof fetch=async(url,init)=>{assert.equal(String(url),'https://api.deepseek.com/chat/completions');const body=JSON.parse(String(init?.body));assert.equal(body.model,'deepseek-flash');assert.equal(body.response_format.type,'json_object');assert.equal(body.max_tokens,6500);assert.equal(body.max_completion_tokens,undefined);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(sample)}}]});};
 await generate(valid,'test',fake,'deepseek');
});
test('DeepSeek credential cannot be routed to image generation',async()=>{
 let called=false;const fake:typeof fetch=async()=>{called=true;throw Error('unexpected');};
 await assert.rejects(generate({action:'reference',characters:sample.characters,style:valid.style},'test',fake,'deepseek'),/绘图.*OpenAI/);assert.equal(called,false);
});
test('network failures identify provider and distinguish timeout',async()=>{
 await assert.rejects(generate(valid,'test',async()=>{throw new DOMException('timeout','TimeoutError');}),/OpenAI.*超时/);
 await assert.rejects(generate(valid,'test',async()=>{throw new TypeError('fetch failed');}),/无法连接 OpenAI/);
});
test('local relay failures remain distinguishable from OpenAI errors',async()=>{
 const fake:typeof fetch=async()=>Response.json({error:{code:'local_proxy_timeout'}},{status:504,headers:{'x-manxiang-relay-error':'timeout'}});
 await assert.rejects(generate(valid,'secret',fake),e=>e instanceof GenerationError&&e.status===504&&/本地代理.*超时/.test(e.message));
});
test('upstream model and quota errors have actionable messages without raw details',async()=>{
 for(const [status,code,expected] of [[404,'model_not_found',/模型不存在|模型访问权限/],[429,'insufficient_quota',/余额|额度已用尽/],[500,'server_error',/OpenAI.*500/]] as const){
  const fake:typeof fetch=async()=>Response.json({error:{code,message:'secret raw provider message'}},{status,headers:{'x-request-id':'req_audit123'}});
  await assert.rejects(generate(valid,'secret',fake),e=>e instanceof GenerationError&&expected.test(e.message)&&!e.message.includes('secret')&&e.message.includes('req_audit123'));
 }
});
test('selected OpenAI-Next endpoint handles text, reference, and edits',async()=>{
 for(const input of [valid,{action:'reference' as const,characters:sample.characters,style:valid.style},{action:'image' as const,characters:sample.characters,style:valid.style,panel:sample.panels[0],reference:'data:image/png;base64,YWJj'}]){
  const fake:typeof fetch=async(url)=>{const path=input.action==='plan'?'chat/completions':input.action==='reference'?'images/generations':'images/edits';assert.equal(String(url),'https://api.openai-next.com/v1/'+path);return input.action==='plan'?Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(sample)}}]}):Response.json({data:[{b64_json:'YWJj'}]});};
  await generate(input,'test',fake,'openai','next');
 }
 await assert.rejects(generate(valid,'test',async()=>{throw Error('must not fetch');},'openai','https://untrusted.example'),/接口地址/);
});
import {changeProjectStyle} from '../lib/comic';
import {japaneseColorPrompt} from '../lib/japanese-color-comic';
test('Japanese skill fills current scene without importing the sample story',()=>{
 const cast=[{name:'宇航员',role:'主角',appearance:'银色宇航服',personality:'谨慎'}];
 const panel={title:'着陆',shot:'远景',scene:'宇航员在晴朗的火星平原检查飞船',dialogue:'此句只在界面排版'};
 const prompt=japaneseColorPrompt(cast,panel);
 assert.equal(prompt.mode,'comic_panel');assert.equal(prompt.aspect_ratio,'1:1');
 assert.match(prompt.prompt,/银色宇航服/);assert.match(prompt.prompt,/火星平原/);assert.match(prompt.prompt,/日系动画电影/);
 assert.doesNotMatch(prompt.prompt,/白猫|邮局|雨夜|黄雨衣|此句只在界面排版/);
 const ref=japaneseColorPrompt(cast);assert.equal(ref.mode,'character_reference');assert.match(ref.prompt,/正面与侧面/);assert.doesNotMatch(ref.prompt,/火星平原/);
});
test('Japanese style reaches both image API actions with square size and reference',async()=>{
 for(const action of ['reference','image'] as const){
  const input=action==='reference'?{action,style:valid.style,characters:sample.characters}:{action,style:valid.style,characters:sample.characters,panel:sample.panels[0],reference:'data:image/png;base64,YWJj'};
  await generate(input,'test',async(_url,init)=>{
   if(init?.body instanceof FormData){assert.equal(init.body.get('size'),'1024x1024');assert.ok(init.body.get('image[]') instanceof Blob);assert.match(String(init.body.get('prompt')),/日系动画电影/);assert.match(String(init.body.get('prompt')),/避免出现/);}
   else{const body=JSON.parse(String(init?.body));assert.equal(body.size,'1024x1024');assert.match(body.prompt,/正面与侧面/);assert.equal(body.negative_prompt,undefined);}
   return Response.json({data:[{b64_json:'YWJj'}]});
  });
 }
});
test('changing selected style updates existing project and invalidates artwork without deleting it',()=>{
 const source={...sample,style:'水彩绘本',reference:'data:image/png;base64,YWJj'};
 const changed=changeProjectStyle(source,'日系彩漫');assert.equal(changed.style,'日系彩漫');assert.equal(changed.referenceStale,true);assert.equal(changed.panels[0].stale,true);assert.equal(changed.panels[0].image,source.panels[0].image);assert.equal(source.style,'水彩绘本');assert.equal(changeProjectStyle(changed,'日系彩漫'),changed);
 assert.doesNotMatch(imagePrompt({...source,style:'黑白漫画'},sample.panels[0]),/日系动画电影/);
});
test('image URL response is downloaded instead of discarded',async()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 let calls=0;
 const fake:typeof fetch=async(url,init)=>{
  calls++;
  if(calls===1)return Response.json({data:[{url:'https://images.provider-cdn.net/generated/test.png'}]});
  assert.equal(String(url),'https://images.provider-cdn.net/generated/test.png');
  assert.equal(new Headers(init?.headers).has('authorization'),false);
  return new Response(png,{headers:{'content-type':'image/png'}});
 };
 const result=await generate({action:'reference',characters:sample.characters,style:valid.style},'test',fake,'openai','next',async()=>{});
 assert.ok('image' in result);assert.match(result.image,/^data:image\/png;base64,/);assert.equal(calls,2);
});
import {resolveGeneratedImage} from '../lib/generated-image';
test('image downloads reject private URLs, unsafe redirects and non-images',async()=>{
 let calls=0;const unused:typeof fetch=async()=>{calls++;throw Error('should not fetch');};
 await assert.rejects(resolveGeneratedImage({url:'https://127.0.0.1/image.png'},unused),/公开的 HTTPS/);assert.equal(calls,0);
 await assert.rejects(resolveGeneratedImage({url:'https://api.openai-next.com/image.png'},async()=>new Response(null,{status:302,headers:{location:'http://localhost/private'}}),async()=>{}),/公开的 HTTPS/);
 await assert.rejects(resolveGeneratedImage({url:'https://api.openai-next.com/image.png'},async()=>new Response('<html>error</html>'),async()=>{}),/不是有效/);
 await assert.rejects(resolveGeneratedImage(undefined,unused),/未返回 b64_json 或 url/);
 await assert.rejects(resolveGeneratedImage({url:'https://api.openai-next.com/image.png'},async()=>new Response('large',{headers:{'content-length':'99999999'}}),async()=>{}),/容量限制/);
});
test('JPEG URL outputs remain valid reference inputs with correct upload MIME',async()=>{
 const image=await resolveGeneratedImage({url:'https://api.openai-next.com/image.jpg'},async()=>new Response(Uint8Array.from([255,216,255,224,0,0])),async()=>{});
 const input=requestSchema.parse({action:'image',characters:sample.characters,style:valid.style,panel:sample.panels[0],reference:image});
 await generate(input,'test',async(_url,init)=>{assert.ok(init?.body instanceof FormData);const file=init.body.get('image[]');assert.ok(file instanceof Blob);assert.equal(file.type,'image/jpeg');return Response.json({data:[{b64_json:'YWJj'}]});});
});
import {isPublicAddress,verifyPublicImageHost} from '../lib/public-image-url';
test('CDN validation accepts public DNS and rejects private or mixed answers',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','::1','fc00::1','::ffff:127.0.0.1'])assert.equal(isPublicAddress(ip),false,ip);
 assert.equal(isPublicAddress('8.8.8.8'),true);
 await verifyPublicImageHost('images.example.org',async url=>Response.json({Status:0,Answer:[{type:String(url).endsWith('AAAA')?28:1,data:String(url).endsWith('AAAA')?'2606:4700:4700::1111':'1.1.1.1'}]}));
 await assert.rejects(verifyPublicImageHost('images.example.org',async()=>Response.json({Status:0,Answer:[{type:1,data:'1.1.1.1'},{type:1,data:'127.0.0.1'}]})),/公网/);
});
test('CDN redirects are checked at each hop and signed query is preserved',async()=>{
 const checked:string[]=[];let calls=0;
 const image=await resolveGeneratedImage({url:'https://cdn.vendor.net/a?sig=keep-me'},async(url,init)=>{
  assert.equal(new Headers(init?.headers).has('authorization'),false);
  if(calls++===0){assert.equal(String(url),'https://cdn.vendor.net/a?sig=keep-me');return new Response(null,{status:302,headers:{location:'https://storage.vendor.net/b?sig=next'}});}
  assert.equal(String(url),'https://storage.vendor.net/b?sig=next');return new Response(Uint8Array.from([137,80,78,71,13,10,26,10]));
 },async host=>{checked.push(host);});
 assert.deepEqual(checked,['cdn.vendor.net','storage.vendor.net']);assert.match(image,/^data:image\/png/);
});

test('DNS verification works with Worker redirect modes and refuses redirects',async()=>{
 const workerFetch:typeof fetch=async(_input,init)=>{
  if(init?.redirect==='error')throw new TypeError('Invalid redirect value');
  assert.equal(init?.redirect,'manual');
  return Response.json({Status:0,Answer:[{type:1,data:'1.1.1.1'}]});
 };
 await verifyPublicImageHost('images.example.org',workerFetch);
 await assert.rejects(verifyPublicImageHost('images.example.org',async(_input,init)=>{
  assert.equal(init?.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}});
 }),/解析失败/);
});

import {blackWhitePrompt} from '../lib/black-white-comic';
test('black-white selection reaches reference and panel image requests with current content',async()=>{
 const characters=[{name:'行者',role:'主角',appearance:'红色披风，左眼下有疤，佩戴{{title}}徽章',personality:'沉稳'}];
 const panel={title:'渡河',shot:'远景俯视',scene:'行者牵马走过石桥，清晨薄雾笼罩河面',dialogue:'只在界面显示的台词'};
 const project=changeProjectStyle({...sample,characters,reference:'data:image/png;base64,YWJj'},'黑白漫画');
 assert.equal(project.referenceStale,true);
 assert.equal(project.panels[0].stale,true);
 assert.equal(project.panels[0].image,sample.panels[0].image);
 for(const action of ['reference','image'] as const){
  const expected=blackWhitePrompt(characters,action==='image'?panel:undefined);
  assert.equal(expected.skill,'black-white-comic');
  assert.equal(expected.mode,action==='image'?'comic_panel':'character_reference');
  assert.match(expected.positive_prompt,/中性灰阶/);
  assert.match(expected.prompt,/红色披风，左眼下有疤，佩戴\{\{title\}\}徽章/);
  assert.doesNotMatch(expected.prompt,/日系动画电影|雨衣|邮局|只在界面显示的台词/);
  if(action==='image')assert.ok(expected.prompt.includes(panel.scene));
  else assert.ok(!expected.prompt.includes(panel.scene));
  const input=action==='reference'?{action,style:project.style,characters}:{action,style:project.style,characters,panel,reference:project.reference!};
  await generate(requestSchema.parse(input),'test',async(url,init)=>{
   if(action==='image'){
    assert.match(String(url),/images\/edits$/);
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get('prompt'),expected.prompt);
    assert.equal(init.body.get('size'),expected.size);
    const reference=init.body.get('image[]');assert.ok(reference instanceof Blob);
    assert.equal(await reference.text(),'abc');
   }else{
    assert.match(String(url),/images\/generations$/);
    const body=JSON.parse(String(init?.body));
    assert.equal(body.prompt,expected.prompt);assert.equal(body.size,expected.size);
    assert.equal(body.negative_prompt,undefined);
   }
   return Response.json({data:[{b64_json:'YWJj'}]});
  });
 }
 const switched=changeProjectStyle(project,'日系彩漫');
 assert.equal(imagePrompt(switched,panel),japaneseColorPrompt(characters,panel).prompt);
 assert.doesNotMatch(imagePrompt(switched,panel),/中性灰阶|网点密度/);
});

import {watercolorPrompt} from '../lib/watercolor-picture-book';
test('watercolor selection routes both image modes and keeps other styles isolated',async()=>{
 const characters=[{name:'守灯人',role:'年迈的主角',appearance:'蓝色大衣，胸前{{scene}}徽章',personality:'忧虑'}];
 const panel={title:'守望',shot:'近景',scene:'老人站在灯塔窗前，紧张地观察暴风雨中的海面',dialogue:'这句由界面排版'};
 const original={...sample,characters,reference:'data:image/png;base64,YWJj'};
 const selected=changeProjectStyle(original,'水彩绘本');
 assert.equal(selected.reference,original.reference);assert.equal(selected.referenceStale,true);
 assert.equal(selected.panels[0].image,original.panels[0].image);assert.equal(selected.panels[0].stale,true);
 for(const action of ['reference','image'] as const){
  const expected=watercolorPrompt(characters,action==='image'?panel:undefined);
  assert.equal(expected.skill,'watercolor-picture-book');
  assert.equal(expected.mode,action==='image'?'comic_panel':'character_reference');
  assert.match(expected.positive_prompt,/透明水彩/);
  assert.ok(expected.prompt.includes(characters[0].appearance));
  assert.doesNotMatch(expected.prompt,/这句由界面排版|日系动画电影|日式黑白漫画|邮差猫/);
  assert.equal(expected.prompt.includes(panel.scene),action==='image');
  const input=requestSchema.parse(action==='reference'?{action,style:selected.style,characters}:{action,style:selected.style,characters,panel,reference:selected.reference});
  await generate(input,'test',async(url,init)=>{
   if(action==='image'){
    assert.match(String(url),/images\/edits$/);
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get('prompt'),expected.prompt);assert.equal(init.body.get('size'),expected.size);
    const ref=init.body.get('image[]');assert.ok(ref instanceof Blob);assert.equal(await ref.text(),'abc');
   }else{
    assert.match(String(url),/images\/generations$/);
    const body=JSON.parse(String(init?.body));assert.equal(body.prompt,expected.prompt);assert.equal(body.size,expected.size);
    assert.equal(body.negative_prompt,undefined);
   }
   return Response.json({data:[{b64_json:'YWJj'}]});
  });
 }
 for(const style of ['日系彩漫','黑白漫画','美式漫画']){
  const switched=changeProjectStyle(selected,style);
  assert.doesNotMatch(imagePrompt(switched,panel),/透明水彩|湿画法/);
 }
});

import {americanComicPrompt} from '../lib/american-comic';
test('American comic selection routes both image modes and preserves authored content',async()=>{
 const characters=[{name:'钟表匠',role:'老年配角',appearance:'瘦小身材，棕色围裙，刻有{{title}}的眼镜',personality:'耐心'}];
 const panel={title:'修表',shot:'近景俯视',scene:'钟表匠安静地坐在工作台前，用镊子调整齿轮',dialogue:'这句只由界面排版'};
 const original={...sample,characters,reference:'data:image/png;base64,YWJj'};
 const selected=changeProjectStyle(original,'美式漫画');
 assert.equal(selected.reference,original.reference);assert.equal(selected.referenceStale,true);
 assert.equal(selected.panels[0].image,original.panels[0].image);assert.equal(selected.panels[0].stale,true);
 for(const action of ['reference','image'] as const){
  const expected=americanComicPrompt(characters,action==='image'?panel:undefined);
  assert.equal(expected.skill,'american-comic');
  assert.equal(expected.mode,action==='image'?'comic_panel':'character_reference');
  assert.match(expected.positive_prompt,/美式彩色漫画/);
  assert.ok(expected.prompt.includes(characters[0].appearance));
  assert.doesNotMatch(expected.positive_prompt,/日系动画电影|透明水彩|日式黑白漫画|邮差猫/);
  assert.ok(!expected.prompt.includes(panel.dialogue));
  assert.equal(expected.prompt.includes(panel.scene),action==='image');
  const input=requestSchema.parse(action==='reference'?{action,style:selected.style,characters}:{action,style:selected.style,characters,panel,reference:selected.reference});
  await generate(input,'test',async(url,init)=>{
   if(action==='image'){
    assert.match(String(url),/images\/edits$/);assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get('prompt'),expected.prompt);assert.equal(init.body.get('size'),expected.size);
    const ref=init.body.get('image[]');assert.ok(ref instanceof Blob);assert.equal(await ref.text(),'abc');
   }else{
    assert.match(String(url),/images\/generations$/);
    const body=JSON.parse(String(init?.body));assert.equal(body.prompt,expected.prompt);assert.equal(body.size,expected.size);
    assert.equal(body.negative_prompt,undefined);
   }
   return Response.json({data:[{b64_json:'YWJj'}]});
  });
 }
 for(const [style,prompt] of [['日系彩漫',japaneseColorPrompt(characters,panel)],['黑白漫画',blackWhitePrompt(characters,panel)],['水彩绘本',watercolorPrompt(characters,panel)]] as const){
  assert.equal(imagePrompt(changeProjectStyle(selected,style),panel),prompt.prompt);
 }
});
