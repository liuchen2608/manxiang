/** Use the developer's existing proxy only in local Vite development. */
export const aiFetch:typeof fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 const download=(init?.method||'GET')==='GET'&&url.protocol==='https:';
 if(import.meta.env?.DEV&&(url.origin==='https://api.openai.com'||download)){
  const {env}=await import('cloudflare:workers');
  const relay=env.MANXIANG_DEV_AI_RELAY;
  const token=env.MANXIANG_DEV_AI_TOKEN;
  if(relay&&token){
   const headers=new Headers(download?undefined:init?.headers);headers.set('x-manxiang-relay',token);
   if(download)headers.set('x-manxiang-image-url',url.href);
   return fetch(relay+(download?'/image-fetch':url.pathname),{...init,headers});
  }
 }
 return fetch(input,init);
};
