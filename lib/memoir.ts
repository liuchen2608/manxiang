import type {Character} from './comic';
export type MemoirKind='comic'|'character';
export type MemoirEntry={id:string;kind:MemoirKind;title:string;style:string;createdAt:number;characters:Character[];image:Blob;thumbnail:Blob};
export type MemoirInput=Omit<MemoirEntry,'id'|'createdAt'|'thumbnail'>;
const STORE='entries';
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 const request=indexedDB.open('manxiang-memoir',1);
 request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
 request.onerror=()=>reject(request.error);
 request.onblocked=()=>reject(new Error('请关闭其他创作台页面后重试。'));
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
});}
async function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await openDB();
 try{return await new Promise<T>((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);const request=operation(tx.objectStore(STORE));
  tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error||request.error||new Error('存储操作未完成。'));tx.onerror=()=>{};
 });}finally{db.close();}
}
export async function memoirId(input:MemoirInput){
 const metadata=JSON.stringify([input.kind,input.title,input.style,input.characters]);
 const bytes=await new Blob([metadata,input.image]).arrayBuffer();
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
}
async function thumbnail(blob:Blob){
 const url=URL.createObjectURL(blob);
 try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=360;c.height=Math.max(1,Math.round(Math.min(img.height/img.width,1.2)*360));
 const ctx=c.getContext('2d');if(!ctx)throw new Error('无法创建缩略图。');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);const h=img.height*360/img.width;ctx.drawImage(img,0,0,360,h);
 return await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('无法创建缩略图。')),'image/jpeg',0.8));
 }finally{URL.revokeObjectURL(url);}
}
export async function saveMemoir(input:MemoirInput,createThumbnail:(image:Blob)=>Promise<Blob>=thumbnail){
 const id=await memoirId(input);const existing=await transaction('readonly',s=>s.get(id));if(existing)return id;
 const entry:MemoirEntry={...input,id,createdAt:Date.now(),thumbnail:await createThumbnail(input.image)};
 // A single put is atomic, and the content key also deduplicates concurrent saves.
 await transaction('readwrite',s=>s.put(entry));return id;
}
export async function listMemoirs():Promise<MemoirEntry[]>{const entries:MemoirEntry[]=await transaction('readonly',s=>s.getAll());return entries.sort((a,b)=>b.createdAt-a.createdAt);}
export async function deleteMemoir(id:string){await transaction('readwrite',s=>s.delete(id));}
export async function hasMemoir(id:string){return !!await transaction('readonly',s=>s.getKey(id));}
export function memoirError(error:unknown){return error instanceof DOMException&&error.name==='QuotaExceededError'?'浏览器存储空间不足，请删除部分收藏后重试。':'保存或读取失败，请检查浏览器是否允许本地存储后重试。';}

export function memoirFilename(entry:MemoirEntry){const extension=entry.image.type==='image/jpeg'?'jpg':entry.image.type==='image/webp'?'webp':'png';return `${entry.title}${entry.kind==='character'?'-角色参考图':''}.${extension}`;}
