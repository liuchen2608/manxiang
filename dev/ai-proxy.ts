import {publicImageUrl,verifyPublicImageHost} from '../lib/public-image-url';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fetch as nodeFetch,ProxyAgent} from 'undici';

export function detectProxy():string|undefined {
 if(process.env.MANXIANG_AI_PROXY==='off')return;
 const explicit=process.env.MANXIANG_AI_PROXY||process.env.HTTPS_PROXY||process.env.https_proxy;
 if(explicit)return explicit;
 if(process.platform!=='darwin')return;
 try{
  const settings=execFileSync('/usr/sbin/scutil',['--proxy'],{encoding:'utf8',timeout:2000});
  if(!/HTTPSEnable\s*:\s*1/.test(settings))return;
  const host=settings.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1];
  const port=settings.match(/HTTPSPort\s*:\s*(\d+)/)?.[1];
  if(host&&port)return `http://${host}:${port}`;
 }catch{/* No system proxy: preserve normal direct behavior. */}
}
const allowed=new Set(['/v1/chat/completions','/v1/images/generations','/v1/images/edits']);
// Development-only loopback relay: fixed OpenAI endpoints, per-process secret,
// TLS verified by ProxyAgent; neither API keys nor payloads are logged.
export async function startAiProxy(proxyUrl:string){
 const dispatcher=new ProxyAgent(proxyUrl);
 const token=randomBytes(32).toString('hex');
 const diagnostics:object[]=[];
 const record=(event:object)=>{diagnostics.push(event);if(diagnostics.length>50)diagnostics.shift();try{mkdirSync('.wrangler',{recursive:true});writeFileSync('.wrangler/ai-diagnostics.json',JSON.stringify(diagnostics,null,2),{mode:0o600});}catch{/* Diagnostics must never break generation. */}};
 const server=createServer(async(req,res)=>{
  if(req.headers['x-manxiang-relay']!==token){res.writeHead(403).end();return;}
  const download=req.method==='GET'&&req.url==='/image-fetch';
  if(!download&&(req.method!=='POST'||!allowed.has(req.url||''))){res.writeHead(404).end();return;}
  let target='https://api.openai.com'+req.url;
  if(download){try{target=publicImageUrl(String(req.headers['x-manxiang-image-url']||'')).href;}catch{res.writeHead(400).end();return;}}
  const id="local_"+randomBytes(8).toString("hex"),started=Date.now();
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),180000);
  res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  try{
   const chunks:Buffer[]=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>13_000_000){res.writeHead(413).end();return;}chunks.push(chunk);}
   if(download&&new URL(target).origin!=='https://cloudflare-dns.com')await verifyPublicImageHost(new URL(target).hostname,((url,init)=>nodeFetch(String(url),{method:'GET',headers:{accept:'application/dns-json'},signal:init?.signal,redirect:'error',dispatcher}) as unknown as Promise<Response>) as typeof fetch);
   const upstream=await nodeFetch(target,{method:download?'GET':'POST',dispatcher,redirect:download?'manual':'error',signal:abort.signal,headers:download?{accept:new URL(target).hostname==='cloudflare-dns.com'?'application/dns-json':'image/*'}:{authorization:req.headers.authorization||'','content-type':req.headers['content-type']||'application/json'},body:download?undefined:Buffer.concat(chunks)});
   const requestId=upstream.headers.get('x-request-id');
   record({id,time:new Date().toISOString(),stage:'upstream-response',status:upstream.status,ms:Date.now()-started,...(requestId&&/^[A-Za-z0-9_-]{1,100}$/.test(requestId)?{requestId}:{})});
   res.writeHead(upstream.status,{...(upstream.headers.get('location')?{location:upstream.headers.get('location')!}:{}),'x-manxiang-diagnostic':id,'content-type':upstream.headers.get('content-type')||'application/json','cache-control':'no-store'});
   if(upstream.body)await pipeline(Readable.fromWeb(upstream.body),res);else res.end();
  }catch(error){
   const cause=error instanceof Error?error.cause:undefined;
   const rawCode=cause&&typeof cause==='object'&&'code' in cause?String(cause.code):'';
   const code=['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(rawCode)?rawCode:'NETWORK_ERROR';
   const timeout=abort.signal.aborted||code.includes('TIMEOUT')||code==='ETIMEDOUT';
   record({id,time:new Date().toISOString(),stage:res.headersSent?'response-body-failed':'relay-failed',code,ms:Date.now()-started});
   if(res.headersSent){res.destroy();return;}
   res.writeHead(timeout?504:502,{'content-type':'application/json','x-manxiang-relay-error':timeout?'timeout':'connection','x-manxiang-diagnostic':id});
   res.end(JSON.stringify({error:{code:'local_proxy_unavailable'}}));
  }finally{clearTimeout(timer);}
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();if(!address||typeof address==='string')throw Error('Invalid proxy listener');
 const close=()=>{server.close();void dispatcher.close();};
 server.unref();
 return {url:`http://127.0.0.1:${address.port}`,token,close};
}
