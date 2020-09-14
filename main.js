'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
const statusBadRequest = 400;
const statusNotFound = 404;
const statusInternalServerError = 500;
const schema = 'social';

const client = mysqlx.getClient({
  user: 'app',
  password: 'pass',
  host: '0.0.0.0',
  port: 33060
});

function sendResponse(response, {status = statusOk, headers = {}, body = null}) {
  Object.entries(headers).forEach(function ([key, value]) {
    response.setHeader(key, value);
  });
  response.writeHead(status);
  response.end(body);
}

function sendJSON(response, body) {
  sendResponse(response, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function map(columns) {
  return row => row.reduce((res, value, i) => ({...res, [columns[i].getColumnLabel()]: value}), {});
}

const methods = new Map();

methods.set('/posts.get', async ({response, db}) => {
  const table = await db.getTable('posts');
  const deletedFalse = await table.select(['id', 'content', 'likes', 'created'])
  .where('removed = :removed')
  .bind('removed', 0)
  .orderBy('id DESC')
  .execute();

  const data = deletedFalse.fetchAll();
  const columns = deletedFalse.getColumns();
  const posts = data.map(map(columns));
  sendJSON(response, posts);
});

methods.set('/posts.getById', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const table = await db.getTable('posts');
  const byId = await table.select(['id', 'content', 'likes', 'created'])

  .where('id = :id AND removed = :removed')
  .bind('id', id )
  .bind('removed', false)
  .execute();

  const data = byId.fetchAll();
  const columns = byId.getColumns();
  const post = data.map(map(columns))[0];

  if (post === undefined || data.length === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  sendJSON(response, post);
});


methods.set('/posts.post', async ({response, searchParams, db}) => {
  if (!searchParams.has('content')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const content = searchParams.get('content');

  const table = db.getTable('posts');
  await table.insert('content').values(content).execute();

  const newPost = await table.select(['id', 'content', 'likes', 'created'])
  .where('content = :content')
  .bind('content', content)
  .execute();

  const data = newPost.fetchAll();
  const columns = newPost.getColumns();
  const posts = data.map(map(columns));

  sendJSON(response, posts[0]);
});


methods.set('/posts.edit', async ({response, searchParams,db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }
  
  const content = searchParams.get('content');
  if (!searchParams.has('content')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }


  const table = db.getTable('posts');
 await table.update()
  .set('content', content)
  .where('id = :id AND removed = :removed')
  .bind('id', id)
  .bind('removed', false)
  .execute();


  const edited = await table.select(['id', 'content', 'likes', 'created'])
  .where('id = :id AND removed = :removed')
  .bind('id', id)
  .bind('removed', false)
  .execute();

  const data = edited.fetchAll();
  const columns = edited.getColumns();
  const posts = data.map(map(columns));

  if (posts === undefined || data.length === 0) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  sendJSON(response, posts[0]);
});


methods.set('/posts.delete', async ({response, searchParams, db}) => {
  if (!searchParams.has('id')) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }
  const table = db.getTable('posts');
 
let result = await table.update()
 .set('removed', true)
 .where('id = :id AND removed = :removed')
 .bind('id', id)
 .bind('removed', false)
 .execute();

 const removed = result.getAffectedItemsCount();
  result = await table.select(['id', 'content', 'likes', 'created'])
  .where('id = :id AND removed = :removed')
  .bind('id', id)
  .bind('removed', true)
  .execute();

  const data = result.fetchAll();
  const columns = result.getColumns();
  const posts = data.map(map(columns)); 

  if (removed === 0){
      sendResponse(response, {status: statusNotFound});
  }

  sendJSON(response, posts[0]);

});



methods.set('/posts.restore', async ({response, searchParams,db}) => {
  if (!searchParams.has('id')){
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const table = db.getTable('posts');
  let result = await table.update()
   .set('removed', false)
   .where('id = :id AND removed = :removed')
   .bind('id', id)
   .bind('removed', true)
   .execute();

    const restore = result.getAffectedItemsCount();
    result = await table.select(['id', 'content', 'likes', 'created'])
    .where('id = :id AND removed = :removed')
    .bind('id', id)
    .bind('removed', false)
    .execute();

    const data = result.fetchAll();
    const columns = result.getColumns();
    const posts = data.map(map(columns)); 

    if (restore === 0){
      sendResponse(response, {status: statusNotFound});
  }

  sendJSON(response, posts[0]);

});











methods.set('/posts.like', async ({response, searchParams,db}) => {
  if (!searchParams.has('id')){
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }



  const table = await db.getTable('posts');

 const row = await table.select(['id', 'content', 'likes', 'created'])
  .where('id = :id && removed = :removed')
  .bind('id', id)
  .bind('removed', false)
  .execute();

  const data = row.fetchAll();

  if (data.length === 0){
    sendResponse(response, {status: statusNotFound});
    return;
  }

  const columns = row.getColumns();
  const post = data.map(map(columns))[0]; 
  const like = post.likes+1;

  
  const result = await table.update()
   .set('likes', like)
   .where('id = :id')
   .bind('id', id)
   .execute();

   const liked = result.getAffectedItemsCount();

   if (liked === 0){
     sendResponse(response, {status: statusNotFound});
     return;
   }

   post.likes++;

  sendJSON(response, post);

});


methods.set('/posts.dislike', async ({response, searchParams,db}) => {
  if (!searchParams.has('id')){
    sendResponse(response, {status: statusBadRequest});
    return;
  }

  const id = Number(searchParams.get('id'));
  if (Number.isNaN(id)) {
    sendResponse(response, {status: statusBadRequest});
    return;
  }


  const table = await db.getTable('posts');

 const row = await table.select(['id', 'content', 'likes', 'created'])
  .where('id = :id && removed = :removed')
  .bind('id', id)
  .bind('removed', false)
  .execute();

  const data = row.fetchAll();

  if (data.length === 0){
    sendResponse(response, {status: statusNotFound});
    return;
  }

  const columns = row.getColumns();
  const post = data.map(map(columns))[0]; 
  const like = post.likes-1;

  const result = await table.update()
   .set('likes', like)
   .where('id = :id')
   .bind('id', id)
   .execute();

   const liked = result.getAffectedItemsCount();

   if (liked === 0){
     sendResponse(response, {status: statusNotFound});
     return;
   }

   post.likes--;

  sendJSON(response, post);

});


const server = http.createServer(async (request, response) => {
  const {pathname, searchParams} = new URL(request.url, `http://${request.headers.host}`);

  const method = methods.get(pathname);
  if (method === undefined) {
    sendResponse(response, {status: statusNotFound});
    return;
  }

  let session = null;
  try {
    session = await client.getSession();
    const db = await session.getSchema(schema);

    const params = {
      request,
      response,
      pathname,
      searchParams,
      db,
    };

    await method(params);
  } catch (e) {
    sendResponse(response, {status: statusInternalServerError});
  } finally {
    if (session !== null) {
      try {
        await session.close();
      } catch (e) {
        console.log(e);
      }
    }
  }
});

server.listen(port);
