import {publicImageUrl as imageUrl,verifyPublicImageHost} from "./public-image-url";
const MAX_BYTES=8_900_000;
function mimeOf(bytes:Uint8Array){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 throw new Error('图片地址返回的内容不是有效的 PNG、JPEG 或 WebP 图片。');
}
function encode(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
export async function resolveGeneratedImage(item:{b64_json?:string;url?:string}|undefined,fetcher:typeof fetch,verifyHost=(host:string)=>verifyPublicImageHost(host,fetcher)){
 if(item?.b64_json?.trim()){
  const raw=item.b64_json.trim();const embedded=raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]*)$/);
  const base64=(embedded?.[2]||raw).replace(/\s/g,'');
  if(base64.length>11_900_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||base64.length%4===1)throw new Error('图片 Base64 数据不完整或超过容量限制。');
  return `data:${embedded?.[1]||'image/png'};base64,${base64}`;
 }
 if(!item?.url)throw new Error('图片接口未返回 b64_json 或 url。请检查该平台是否支持当前绘图模型与同步图片接口。');
 let url=imageUrl(item.url);const signal=AbortSignal.timeout(60000);
 for(let redirect=0;redirect<4;redirect++){
  await verifyHost(url.hostname);
  // Do not forward generation API credentials to the image storage service.
  let response:Response;try{response=await fetcher(url.href,{method:'GET',redirect:'manual',signal});}catch{throw new Error('图片已返回下载链接，但下载失败或超时，请检查图片存储服务的网络连接。');}
  if([301,302,303,307,308].includes(response.status)){
   const target=response.headers.get('location');await response.body?.cancel();
   if(!target)throw new Error('图片下载重定向缺少目标地址。');url=imageUrl(new URL(target,url).href);continue;
  }
  if(!response.ok){await response.body?.cancel();throw new Error(`图片下载失败（HTTP ${response.status}），链接可能已过期或无权访问。`);}
  if(Number(response.headers.get('content-length'))>MAX_BYTES){await response.body?.cancel();throw new Error('返回图片超过容量限制，请降低图片大小。');}
  const reader=response.body?.getReader();if(!reader)throw new Error('图片下载结果为空。');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('返回图片超过容量限制，请降低图片大小。');}chunks.push(value);}}catch(error){if(signal.aborted)throw new Error('图片下载超时，请稍后重试。');throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return `data:${mimeOf(bytes)};base64,${encode(bytes)}`;
 }
 throw new Error('图片下载重定向次数过多。');
}
