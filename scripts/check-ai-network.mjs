// An intentionally invalid credential exercises the real route without generating content.
const response=await fetch('http://localhost:5173/api/create',{
 method:'POST',headers:{'content-type':'application/json','x-openai-key':'sk-diagnostic-invalid-not-a-real-key'},
 body:JSON.stringify({action:'reference',style:'日系彩漫',characters:[{name:'测试',role:'测试',appearance:'测试',personality:'测试'}]}),
 signal:AbortSignal.timeout(20000),
});
const result=await response.json();
if(response.status!==401||!String(result.error).includes('API Key 无效'))throw new Error('OpenAI 链路未验证通过，HTTP '+response.status);
console.log('OpenAI 网络链路正常：真实绘图接口返回预期的无效测试密钥响应；未发起付费生成。');
