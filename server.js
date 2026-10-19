const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const rooms = new Map();
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if(pathname === '/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,rooms:rooms.size}));}
  let file = pathname === '/' ? 'VS_QUIZZ_v30.html' : path.basename(decodeURIComponent(pathname));
  if(file !== 'VS_QUIZZ_v30.html'){res.writeHead(404);return res.end('Not found');}
  fs.readFile(path.join(ROOT,file),(err,data)=>{if(err){res.writeHead(500);return res.end('Could not load game file');}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(data);});
});
const wss = new WebSocket.Server({server,path:'/ws',maxPayload:16*1024});
function send(ws,obj){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(room,obj,except=null){for(const ws of room.clients){if(ws!==except)send(ws,obj);}}
function peers(room){return [...room.players.values()].map(p=>({id:p.id,name:p.name}));}
function newCode(){let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase().replace(/[0-9]/g,'').slice(0,4)+crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,2);}while(rooms.has(code));return code;}
wss.on('connection',ws=>{
  ws.id=crypto.randomUUID();ws.room=null;ws.role=null;ws.name=null;ws.isAlive=true;
  ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return;}if(!m||typeof m.type!=='string')return;
    if(m.type==='create-room'){
      if(ws.room&&rooms.has(ws.room))return send(ws,{type:'error',message:'Deja ești într-o cameră.'});
      const code=newCode();const room={code,host:ws,players:new Map(),clients:new Set([ws]),question:null,buzzed:false,started:false};rooms.set(code,room);ws.room=code;ws.role='host';send(ws,{type:'room-created',room:code});return;
    }
    if(m.type==='join-room'){
      const code=String(m.room||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);const name=String(m.name||'').trim().slice(0,24);
      const room=rooms.get(code);if(!room)return send(ws,{type:'error',message:'Camera nu există sau gazda nu este conectată.'});if(!name)return send(ws,{type:'error',message:'Introdu un nume valid.'});if(room.players.size>=20)return send(ws,{type:'error',message:'Camera este plină (maximum 20 jucători online).'});
      if([...room.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return send(ws,{type:'error',message:'Numele este deja folosit în această cameră.'});
      ws.room=code;ws.role='player';ws.name=name;room.clients.add(ws);room.players.set(ws.id,{id:ws.id,name,ws});send(ws,{type:'joined',room:code,name});send(room.host,{type:'player-joined',name,count:room.players.size});send(room.host,{type:'peers',players:peers(room)});return;
    }
    const room=rooms.get(ws.room);if(!room)return;
    if(m.type==='buzz'&&ws.role==='player'){
      if(!room.question||room.buzzed)return;room.buzzed=true;const player=room.players.get(ws.id);if(!player)return;
      // Server-side first-buzz lock: only the first valid message wins.
      broadcast(room,{type:'buzz-locked',id:ws.id,name:player.name});return;
    }
    if(ws.role==='host'&&m.room===room.code){
      if(m.type==='question'){room.question={category:String(m.category||'').slice(0,100),value:Number(m.value)||0,question:String(m.question||'').slice(0,2000)};room.buzzed=false;broadcast(room,{...m,type:'question'});}
      else if(m.type==='question-closed'){room.question=null;room.buzzed=false;broadcast(room,m);}
      else if(m.type==='game-started'||m.type==='answer-result'||m.type==='scores'||m.type==='game-ended'){broadcast(room,m);}
      else if(m.type==='host-close'){broadcast(room,{type:'error',message:'Gazda a închis camera.'});for(const client of room.clients){try{client.close()}catch{}}rooms.delete(room.code);}
    }
  });
  ws.on('close',()=>{const code=ws.room;if(!code)return;const room=rooms.get(code);if(!room)return;room.clients.delete(ws);if(ws.role==='player'){room.players.delete(ws.id);send(room.host,{type:'peers',players:peers(room)});send(room.host,{type:'player-left',name:ws.name,count:room.players.size});}else if(ws.role==='host'){for(const client of room.clients)send(client,{type:'error',message:'Gazda s-a deconectat. Camera s-a închis.'});for(const client of room.clients){try{client.close()}catch{}}rooms.delete(code);}});
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},30000);
wss.on('close',()=>clearInterval(heartbeat));
server.listen(PORT,'0.0.0.0',()=>console.log(`VS_QUIZZ v30 online listening on ${PORT}`));
