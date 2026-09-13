/** Image URLs come from the configured generation service; never send API credentials. */
export function publicImageUrl(value:string){
 let url:URL;try{url=new URL(value);}catch{throw new Error('图片接口返回了无效链接。');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||host.endsWith('.')||/(^|\.)(localhost|local|internal|test|invalid|lan|home|arpa)$/.test(host))throw new Error('图片下载地址必须是公开的 HTTPS 域名。');
 return url;
}
export function isPublicAddress(ip:string){
 if(ip.includes(':'))return /^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:(?:db8|0*0|0*2|0*10|0*20):/i.test(ip)&&!/^2002:/i.test(ip);
 const n=ip.split('.').map(Number);
 if(n.length!==4||n.some(v=>!Number.isInteger(v)||v<0||v>255))return false;
 const [a,b,c]=n;
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export async function verifyPublicImageHost(host:string,lookup:typeof fetch=fetch){
 // Workers support follow/manual only. Inspect non-2xx below to reject redirects.
 const records=await Promise.all(['A','AAAA'].map(async type=>{
  let r:Response;try{r=await lookup('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(10000),redirect:'manual'});}catch{throw new Error('图片域名解析服务连接失败，请检查网络或代理后重试下载。');}
  if(!r.ok)throw new Error('图片域名解析失败，请稍后重试下载。');
  const data=await r.json() as {Status?:number;Answer?:{type:number;data:string}[]};
  if(data.Status!==0)throw new Error('图片域名暂时无法解析，请稍后重试下载。');
  return (data.Answer||[]).filter(a=>a.type===1||a.type===28).map(a=>a.data);
 }));
 const addresses=records.flat();
 if(!addresses.length||addresses.some(ip=>!isPublicAddress(ip)))throw new Error('图片域名未解析到可用的公网地址。');
}
