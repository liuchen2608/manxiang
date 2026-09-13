export const openaiEndpoints={
 official:'https://api.openai.com/v1',
 next:'https://api.openai-next.com/v1',
} as const;
export function openaiBase(endpoint:string='official'):string {
 if(endpoint!=='official'&&endpoint!=='next')throw new Error('请选择已支持的 OpenAI 接口地址。');
 return openaiEndpoints[endpoint];
}
