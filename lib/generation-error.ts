/** Never expose upstream messages: they may echo credentials or story input. */
export async function generationFailure(response:Response,label:string){
 const status=response.status;
 const relay=response.headers.get('x-manxiang-relay-error');
 const diagnostic=response.headers.get('x-manxiang-diagnostic')||response.headers.get('x-request-id');
 const suffix=diagnostic&&/^[A-Za-z0-9_-]{1,100}$/.test(diagnostic)?`（诊断编号：${diagnostic}）`:'';
 let code='';
 try{
  const reader=response.body?.getReader();let size=0;const parts:Uint8Array[]=[];
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();break;}parts.push(value);}
   if(size<=16384){const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}const data=JSON.parse(new TextDecoder().decode(bytes));if(typeof data?.error?.code==='string')code=data.error.code;}}
 }catch{/* HTTP status still provides a useful error for HTML/invalid JSON. */}
 let message:string;
 if(relay==='timeout')message='本地代理等待 OpenAI 响应超时。请检查代理节点是否稳定；当前作品已保留。';
 else if(relay==='connection')message='本地代理连接 OpenAI 失败。请确认代理软件仍在运行，或切换可用代理节点后重试。';
 else if(status===401)message='API Key 无效，请在「连接 AI」中重新填写。';
 else if(status===404||code==='model_not_found')message=`${label} 模型不存在或当前项目没有模型访问权限，请检查所用 API 项目。`;
 else if(status===403)message=`${label} 拒绝访问，请检查项目的模型权限、组织验证及服务可用地区。`;
 else if(status===402||code==='insufficient_quota'||code==='billing_hard_limit_reached')message=`${label} 账户余额不足或额度已用尽，请检查 API 账单与项目预算。`;
 else if(status===429)message=`${label} 请求过于频繁，请稍后重试；同时检查账户额度。`;
 else if(status===400)message=`${label} 未接受生成参数或内容，请调整描述并检查模型设置。`;
 else if(status===413)message='请求内容过大，请减少图片或描述大小。';
 else if(status===504||status===408)message=`${label} 或代理网关等待生成超时（HTTP ${status}），当前作品已保留。`;
 else message=`${label} 或中间代理返回错误（HTTP ${status}）。当前作品已保留，请稍后重试。`;
 return {message:message+suffix,status:status>=400&&status<=599?status:502};
}
