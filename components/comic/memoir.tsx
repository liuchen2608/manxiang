"use client";
import {useEffect,useState} from 'react';
import {BookHeart,Download,Heart,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {deleteMemoir,hasMemoir,listMemoirs,memoirFilename,memoirError,memoirId,saveMemoir,type MemoirEntry} from '@/lib/memoir';
import type {Project} from '@/lib/comic';
import {download} from '@/lib/export';
import {toast} from 'sonner';
export function BlobImage({blob,alt,...props}:{blob:Blob;alt:string;className?:string}){
 const [url,setUrl]=useState('');useEffect(()=>{const next=URL.createObjectURL(blob);setUrl(next);return()=>URL.revokeObjectURL(next);},[blob]);
 return url?<img src={url} alt={alt} {...props}/>:null;
}
export function CollectCharacter({project,revision,onSaved,disabled}:{project:Project;revision:number;onSaved:()=>void;disabled:boolean}){
 const [saved,setSaved]=useState(false),[saving,setSaving]=useState(false);
 useEffect(()=>{let active=true;setSaved(false);if(!project.reference||project.referenceStale)return;
 void fetch(project.reference).then(r=>r.blob()).then(image=>memoirId({kind:'character',title:project.title,style:project.style,characters:project.characters,image})).then(hasMemoir).then(value=>{if(active)setSaved(value);}).catch(()=>{});return()=>{active=false;};
 },[project.reference,project.referenceStale,project.characters,project.title,project.style,revision]);
 async function collect(){if(saving||saved||!project.reference)return;setSaving(true);try{const image=await fetch(project.reference).then(r=>r.blob());await saveMemoir({kind:'character',title:project.title,style:project.style,characters:structuredClone(project.characters),image});setSaved(true);onSaved();toast.success('角色图已收藏到回忆录');}catch(e){toast.error(memoirError(e));}finally{setSaving(false);}}
 return <button className="secondary" disabled={disabled||saving||saved||!!project.referenceStale} onClick={collect}><Heart size={16} fill={saved?'currentColor':'none'}/>{saving?'正在收藏…':saved?'已收藏':'收藏角色图'}</button>;
}
export function Memoir({revision,onChanged}:{revision:number;onChanged:()=>void}){
 const [open,setOpen]=useState(false),[entries,setEntries]=useState<MemoirEntry[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [preview,setPreview]=useState<MemoirEntry|null>(null),[pending,setPending]=useState<MemoirEntry|null>(null),[deleting,setDeleting]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;let active=true;setLoading(true);setError('');void listMemoirs().then(v=>{if(active)setEntries(v);}).catch(e=>{if(active)setError(memoirError(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[open,revision,retry]);
 async function remove(){if(!pending||deleting)return;setDeleting(true);try{await deleteMemoir(pending.id);setEntries(v=>v.filter(e=>e.id!==pending.id));if(preview?.id===pending.id)setPreview(null);setPending(null);onChanged();toast.success('已删除收藏');}catch(e){toast.error(memoirError(e));}finally{setDeleting(false);}}
 return <><button className="secondary" onClick={()=>setOpen(true)}><BookHeart size={16}/>回忆录</button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="memoir-dialog"><DialogHeader><DialogTitle>回忆录</DialogTitle><DialogDescription>留住完成的故事与喜欢的角色。仅保存在当前浏览器，清除浏览器数据会丢失。</DialogDescription></DialogHeader>
 <Tabs defaultValue="comic"><TabsList><TabsTrigger value="comic">漫画作品</TabsTrigger><TabsTrigger value="character">角色收藏</TabsTrigger></TabsList>
 {(['comic','character'] as const).map(kind=><TabsContent key={kind} value={kind}>
 {loading?<p role="status">正在读取回忆录…</p>:error?<div role="alert">{error}<button className="secondary" onClick={()=>setRetry(v=>v+1)}>重试</button></div>:<div className="memoir-grid">{entries.filter(e=>e.kind===kind).map(entry=><article className="memoir-card" key={entry.id}>
 <button className="memoir-cover" onClick={()=>setPreview(entry)} aria-label={`查看${entry.title}`}><BlobImage blob={entry.thumbnail} alt={entry.kind==='character'?entry.characters.map(c=>c.name).join('、'):entry.title}/></button>
 <div className="memoir-details"><strong>{entry.kind==='character'?entry.characters.map(c=>c.name).join('、'):entry.title}</strong>{kind==='character'&&<small>来源：{entry.title}</small>}<small>{entry.style} · {new Date(entry.createdAt).toLocaleString('zh-CN')}</small><div className="memoir-actions"><button className="secondary" onClick={()=>download(entry.image,memoirFilename(entry))}><Download size={14}/>下载</button><button className="secondary" onClick={()=>setPending(entry)} aria-label={`删除${entry.title}`}><Trash2 size={14}/>删除</button></div></div></article>)}{!entries.some(e=>e.kind===kind)&&<p className="memoir-empty">{kind==='comic'?'导出第一张长图，留下你的创作回忆。':'生成角色参考图后，点击图片下方的收藏按钮。'}</p>}</div>}
 </TabsContent>)}</Tabs></DialogContent></Dialog>
 <Dialog open={!!preview} onOpenChange={v=>{if(!v)setPreview(null);}}><DialogContent className="memoir-dialog">{preview&&<><DialogHeader><DialogTitle>{preview.title}</DialogTitle><DialogDescription>{preview.style} · {preview.kind==='comic'?'漫画作品':'角色收藏'}</DialogDescription></DialogHeader><BlobImage blob={preview.image} alt={preview.title} className="memoir-full"/>{preview.kind==='character'&&preview.characters.map((c,i)=><div key={i}><strong>{c.name} · {c.role}</strong><p>{c.appearance}</p><p>{c.personality}</p></div>)}<button className="secondary" onClick={()=>download(preview.image,memoirFilename(preview))}><Download size={16}/>下载图片</button></>}</DialogContent></Dialog>
 <Dialog open={!!pending} onOpenChange={v=>{if(!v&&!deleting)setPending(null);}}><DialogContent><DialogHeader><DialogTitle>删除这份收藏？</DialogTitle><DialogDescription>“{pending?.title}”删除后无法恢复。当前创作与已下载文件不受影响。</DialogDescription></DialogHeader><div className="memoir-actions"><button className="secondary" disabled={deleting} onClick={()=>setPending(null)}>取消</button><button className="primary" disabled={deleting} onClick={remove}>{deleting?'正在删除…':'确认删除'}</button></div></DialogContent></Dialog></>;
}
