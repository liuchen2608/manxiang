import templates from '../skills/watercolor-picture-book/templates.json';
import type {Character,Panel} from './comic';
function fill(template:string,values:Record<string,string>){
 return template.replace(/\{\{(\w+)\}\}/g,(_match,key:string)=>{
  if(!(key in values))throw new Error('水彩绘本模板字段缺失：'+key);
  return values[key];
 });
}
export function watercolorPrompt(characters:Character[],panel?:Panel){
 const cast=characters.map(c=>`${c.name}：${c.role}；外貌与服装：${c.appearance}；性格：${c.personality}`).join('\n');
 const positive=templates.style+'\n'+(panel?fill(templates.panel,{characters:cast,title:panel.title,scene:panel.scene,shot:panel.shot}):fill(templates.reference,{characters:cast}));
 return {skill:templates.skill,version:templates.version,mode:panel?'comic_panel':'character_reference',positive_prompt:positive,negative_prompt:templates.negative,aspect_ratio:templates.aspect_ratio,size:templates.size,prompt:positive+'\n【避免出现】\n'+templates.negative};
}
