import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {saveMemoir,listMemoirs,deleteMemoir,hasMemoir,memoirId,memoirFilename,type MemoirInput} from '../lib/memoir';
const image=new Blob(['image bytes'],{type:'image/webp'});
const input:MemoirInput={kind:'character',title:'测试作品',style:'水彩绘本',characters:[{name:'角色',role:'主角',appearance:'蓝衣',personality:'安静'}],image};
const thumb=async()=>new Blob(['thumbnail'],{type:'image/jpeg'});
test('memoir stores blobs and snapshots across connections, deduplicates, versions and deletes independently',async()=>{
 const id=await saveMemoir(input,thumb);
 const [stored]=await listMemoirs();assert.equal(stored.id,id);assert.equal(await stored.image.text(),'image bytes');assert.equal(await stored.thumbnail.text(),'thumbnail');
 assert.equal(memoirFilename(stored),'测试作品-角色参考图.webp');
 assert.equal(await saveMemoir(input,async()=>{throw Error('should not recreate duplicate');}),id);
 assert.equal((await listMemoirs()).length,1);
 input.characters[0].appearance='红衣';
 assert.equal((await listMemoirs())[0].characters[0].appearance,'蓝衣');
 const newId=await saveMemoir({...input,image:new Blob(['new image'])},thumb);assert.notEqual(newId,id);
 const comicId=await saveMemoir({...input,kind:'comic'},thumb);assert.equal((await listMemoirs()).length,3);
 await deleteMemoir(id);assert.equal(await hasMemoir(id),false);assert.equal(await hasMemoir(newId),true);assert.equal(await hasMemoir(comicId),true);
 const entries=await listMemoirs();assert.ok(entries[0].createdAt>=entries[1].createdAt);
 await deleteMemoir(newId);await deleteMemoir(comicId);
});
test('failed image preparation saves no partial record and allows retry',async()=>{
 await assert.rejects(saveMemoir(input,async()=>{throw Error('thumbnail failed');}),/thumbnail failed/);
 assert.equal(await hasMemoir(await memoirId(input)),false);
 const id=await saveMemoir(input,thumb);assert.equal(await hasMemoir(id),true);await deleteMemoir(id);
});
test('concurrent duplicate saves create one record',async()=>{
 const ids=await Promise.all([saveMemoir(input,thumb),saveMemoir(input,thumb)]);assert.equal(ids[0],ids[1]);assert.equal((await listMemoirs()).length,1);await deleteMemoir(ids[0]);
});
