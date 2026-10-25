import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authoringRoot,authoringPath} from '../../../../tools/art-authoring.mjs';
import {serveDir} from '../../../../tools/browser.mjs';
import {createHandler} from '../../../server.mjs';

export const reviewRelative = 'pose-studio/stances/update-stances/sequence-review';
const gameRoot = fileURLToPath(new URL('../../../../',import.meta.url));

export function reviewPaths({root=gameRoot,assetRoot,env=process.env}={}) {
  root=path.resolve(root);
  const art=authoringRoot({root,assetRoot,env,required:false});
  const folder=path.join(root,reviewRelative);
  const output=art?authoringPath(reviewRelative+'/renders',{root,assetRoot:art,env}):path.join(folder,'renders');
  return {root,folder,output,art,env};
}

export async function serveReview(paths) {
  if(!paths.art)return serveDir(paths.folder);
  const server=http.createServer(createHandler({root:paths.root,assetRoot:paths.art,env:paths.env}));
  server.on('connection',socket=>socket.unref());
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  server.unref();
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {server,origin,url:(name='')=>`${origin}/${reviewRelative}/${String(name).split(/[\\/]/).map(encodeURIComponent).join('/')}`,
    close:()=>new Promise(resolve=>server.close(resolve))};
}
