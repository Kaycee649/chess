(function(){
const g=new Chess();
const LV=[["Beginner",0,1,150],["Easy",3,3,300],["Casual",6,5,500],["Intermediate",10,8,900],["Advanced",15,12,1500],["Maximum (slow)",20,40,3000]];
const $=id=>document.getElementById(id);
let human='w',flip=false,sel=null,legal=[],redo=[],hint=null,thinking=false,ready=false,tok=0,pend=[],cur=null,msg='',w=null;
LV.forEach((l,i)=>{const o=document.createElement('option');o.value=i;o.textContent=l[0];$('lvl').appendChild(o)});
$('lvl').value=3;
try{const s=localStorage.getItem('lvl');if(s!==null)$('lvl').value=s}catch(e){}
$('lvl').onchange=()=>{try{localStorage.setItem('lvl',$('lvl').value)}catch(e){}};

function save(){try{localStorage.setItem('game',JSON.stringify({human,flip,moves:g.history({verbose:true}).map(m=>({from:m.from,to:m.to,promotion:m.promotion})),redo}))}catch(e){}}
function restore(){try{const s=JSON.parse(localStorage.getItem('game')||'null');if(!s)return;
 human=s.human;flip=s.flip;s.moves.forEach(m=>g.move(m));redo=s.redo||[]}catch(e){g.reset();redo=[]}}

function start(){
 try{w=new Worker('stockfish.js')}catch(e){msg='Engine could not start in this browser.';render();return}
 w.onerror=()=>{msg='Engine failed to load. Check your connection and reload.';ready=false;thinking=false;render()};
 w.onmessage=e=>on(typeof e.data==='string'?e.data:'');
 w.postMessage('uci');
 setTimeout(()=>{if(!ready){msg='Engine is slow to load. Reload the page to retry.';render()}},15000);
}
function ask(type,skill,depth,ms){
 if(!ready)return;
 if(pend.length)w.postMessage('stop');
 const t={id:++tok,type,fen:g.fen(),turn:g.turn()};
 pend.push(t);cur=t;
 w.postMessage('setoption name Skill Level value '+skill);
 w.postMessage('position fen '+t.fen);
 w.postMessage('go depth '+depth+' movetime '+ms);
}
function cancel(){tok++;cur=null;thinking=false;if(pend.length)w.postMessage('stop')}
function on(l){
 if(l==='uciok'){ready=true;msg='';render();maybeEngine();return}
 if(l.startsWith('info')&&cur&&pend[pend.length-1]===cur){
  const m=l.match(/depth (\d+).*?score (cp|mate) (-?\d+)/);
  if(m){let v=+m[3];if(cur.turn==='b')v=-v;showEval(m[2],v,+m[1])}
 }else if(l.startsWith('bestmove')){
  const t=pend.shift();if(!t||t!==cur)return;
  cur=null;const s=l.split(' ')[1];thinking=false;
  if(!s||s==='(none)'){render();return}
  const mv={from:s.slice(0,2),to:s.slice(2,4),promotion:s[4]};
  if(t.type==='engine'){
   if(!g.move(mv)){msg='Engine returned a move that could not be played. Try Undo or a new game.';render();return}
   hint=null;save();render();
  }else{
   const r=new Chess(t.fen).move(mv);
   if(r)hint={from:mv.from,to:mv.to,san:r.san,mv};
   render();
  }
 }
}
function showEval(k,v,d){
 let t,pct;
 if(k==='mate'){t='Mate in '+Math.abs(v)+' for '+(v>0?'White':'Black');pct=v>0?100:0}
 else{t=(v>0?'+':'')+(v/100).toFixed(2);pct=50+50*Math.tanh(v/400)}
 $('evt').textContent='Eval: '+t+' (depth '+d+')';
 $('bar').firstElementChild.style.width=pct+'%';
}
function maybeEngine(){
 if(!ready||g.game_over()||g.turn()===human||redo.length||thinking)return;
 thinking=true;const l=LV[$('lvl').value];ask('engine',l[1],l[2],l[3]);render();
}
function render(){
 const b=$('board');let h='';
 const last=g.history({verbose:true}).slice(-1)[0];
 let ks=null;
 if(g.in_check()){const bd=g.board();for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=bd[r][c];if(p&&p.type==='k'&&p.color===g.turn())ks='abcdefgh'[c]+(8-r)}}
 const dest=new Map(legal.map(m=>[m.to,m]));
 for(let i=0;i<64;i++){
  let r=Math.floor(i/8),c=i%8;if(flip){r=7-r;c=7-c}
  const sq='abcdefgh'[c]+(8-r),p=g.get(sq);
  let cl='sq '+((r+c)%2?'d':'l');
  if(last&&(last.from===sq||last.to===sq))cl+=' last';
  if(sel===sq)cl+=' sel';
  if(sq===ks)cl+=' chk';
  if(hint&&(hint.from===sq||hint.to===sq))cl+=' hint';
  if(dest.has(sq))cl+=/[ce]/.test(dest.get(sq).flags)?' cap':' dot';
  h+='<div class="'+cl+'" data-sq="'+sq+'">';
  if(p)h+='<div class="pc" style="background-image:url(\''+PIECES[p.color+p.type]+'\')"></div>';
  if(flip?c===7:c===0)h+='<span class="co cr">'+(8-r)+'</span>';
  if(flip?r===0:r===7)h+='<span class="co cf">'+'abcdefgh'[c]+'</span>';
  h+='</div>';
 }
 b.innerHTML=h;
 let s;
 if(msg)s=msg;
 else if(g.in_checkmate())s='Checkmate! '+(g.turn()===human?'Stockfish wins.':'You win!');
 else if(g.in_stalemate())s='Stalemate. Draw.';
 else if(g.insufficient_material())s='Draw by insufficient material.';
 else if(g.in_threefold_repetition())s='Draw by repetition.';
 else if(g.in_draw())s='Draw (fifty-move rule).';
 else if(!ready)s='Loading engine…';
 else if(thinking)s='Stockfish is thinking…';
 else if(hint&&g.turn()===human)s='Best move: '+hint.san+' (tap here to play it)';
 else s=(g.turn()===human?'Your turn':'Stockfish’s turn')+' ('+(g.turn()==='w'?'White':'Black')+')'+(g.in_check()?' – check!':'');
 $('status').textContent=s;
 const hs=g.history();let m='';
 for(let i=0;i<hs.length;i+=2)m+=(i/2+1)+'. '+hs[i]+' '+(hs[i+1]||'')+'  ';
 const mv=$('moves');mv.textContent=m||'No moves yet.';mv.scrollTop=mv.scrollHeight;
 $('un').disabled=!hs.length;$('re').disabled=!redo.length;
 $('hi').disabled=!ready||g.game_over()||thinking||g.turn()!==human;
}
function bar(html,btns){
 const e=$('bar2');e.style.display='flex';e.innerHTML='<span>'+html+'</span>';
 btns.forEach(([t,f,img])=>{const x=document.createElement('button');if(img){x.className='pr';x.style.backgroundImage="url('"+img+"')"}else x.textContent=t;x.onclick=()=>{e.style.display='none';f()};e.appendChild(x)});
}
function doMove(m){
 if(!g.move(m))return;
 sel=null;legal=[];redo=[];hint=null;msg='';save();render();maybeEngine();
}
$('board').addEventListener('click',e=>{
 const el=e.target.closest('.sq');if(!el||thinking||g.game_over()||g.turn()!==human||!ready)return;
 const sq=el.dataset.sq,p=g.get(sq);
 if(sel){
  const ms=legal.filter(m=>m.to===sq);
  if(ms.length){
   if(ms[0].promotion){
    const from=sel;sel=null;legal=[];render();
    bar('Promote to:',['q','r','b','n'].map(k=>['',()=>doMove({from,to:sq,promotion:k}),PIECES[human+k]]));
   }else doMove({from:sel,to:sq});
   return;
  }
 }
 if(p&&p.color===human&&sq!==sel){sel=sq;legal=g.moves({square:sq,verbose:true})}
 else{sel=null;legal=[]}
 render();
});
function newGame(c){
 const go=()=>{cancel();g.reset();human=c;flip=c==='b';sel=null;legal=[];redo=[];hint=null;msg='';
  $('evt').textContent='Eval: –';$('bar').firstElementChild.style.width='50%';save();render();maybeEngine()};
 if(g.history().length&&!g.game_over())bar('Abandon the current game?',[['Yes, start new',go],['Keep playing',()=>{}]]);else go();
}
$('nw').onclick=()=>newGame('w');$('nb').onclick=()=>newGame('b');
$('un').onclick=()=>{cancel();hint=null;msg='';if(!g.history().length)return;
 do{const m=g.undo();redo.push({from:m.from,to:m.to,promotion:m.promotion})}while(g.history().length&&g.turn()!==human);
 sel=null;legal=[];save();render()};
$('re').onclick=()=>{cancel();hint=null;
 do{g.move(redo.pop())}while(redo.length&&g.turn()!==human);
 sel=null;legal=[];save();render();maybeEngine()};
$('fl').onclick=()=>{flip=!flip;save();render()};
$('hi').onclick=()=>{thinking=true;msg='';ask('hint',20,40,1800);render()};
$('status').onclick=()=>{if(hint&&g.turn()===human&&!thinking)doMove(hint.mv)};
$('cp').onclick=async()=>{
 const t=g.pgn();
 try{await navigator.clipboard.writeText(t);msg='PGN copied.'}catch(e){msg='Copy blocked. PGN: '+t}
 render();setTimeout(()=>{msg='';render()},4000)};
restore();render();start();
})();
