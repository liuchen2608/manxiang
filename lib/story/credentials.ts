import {openaiBase} from "../openai-endpoints";
/** Validate locally without exposing the credential in error messages. */
export function normalizeApiKey(value:string):string {
 const key=value.trim();
 if(!/^[\x21-\x7e]{20,500}$/.test(key)) {
  throw new Error("API Key 格式不正确：请粘贴平台生成的完整密钥，不要包含中文、空格、换行或隐藏字符。");
 }
 return key;
}
export function storyRequestHeaders(key:string,provider:string,usesModel:boolean,endpoint="official"):Headers {
 const headers=new Headers({"Content-Type":"application/json"});
 if(usesModel){
  if(provider!=="deepseek"&&provider!=="openai")throw new Error("请选择 DeepSeek 或 OpenAI。");
  if(provider==="openai"){openaiBase(endpoint);headers.set("x-openai-endpoint",endpoint);}
  headers.set("x-ai-key",normalizeApiKey(key));
  headers.set("x-ai-provider",provider);
 }
 return headers;
}
