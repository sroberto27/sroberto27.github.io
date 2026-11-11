import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(path.join(root,'videos'),{recursive:true});
const tracks=[];
for(const directory of ['', 'videos']){
 for(const file of await readdir(path.join(root,directory),{withFileTypes:true})){
  if(file.isFile()&&/\.(mp4|webm|m4v)$/i.test(file.name))tracks.push({title:file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' '),src:(directory?directory+'/':'')+encodeURIComponent(file.name)});
 }
}
tracks.sort((a,b)=>a.title.localeCompare(b.title));
await writeFile(path.join(root,'videos.json'),JSON.stringify(tracks,null,2)+'\n');
console.log(`Playlist generated: ${tracks.length} videos.`);
