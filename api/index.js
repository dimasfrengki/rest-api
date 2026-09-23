const express=require('express'),fs=require('fs'),QR=require('qrcode'),crypto=require('crypto');
const app=express(),r=express.Router();
const CREATOR=process.env.CREATOR||'MyAPI',ADMIN=process.env.ADMIN_PASSWORD||'admin123';
const FILE=process.env.VERCEL?'/tmp/cfg.json':__dirname+'/../cfg.json';
const RU=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,RT=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
app.use(express.json());app.use((q,s,n)=>{s.set('Access-Control-Allow-Origin','*');s.set('Access-Control-Allow-Headers','*');n()});
if(!process.env.VERCEL)app.use(express.static(__dirname+'/../public'));
// rate limit
const hits=new Map();
app.use((q,s,n)=>{const k=q.headers['x-forwarded-for']||q.ip,t=Math.floor(Date.now()/6e4),h=hits.get(k);
 if(!h||h.t!=t)hits.set(k,{t,n:1});else if(++h.n>(+process.env.RATE||60))return s.status(429).json({status:false,message:'Rate limit'});n()});
// config (api upstream bisa diganti dari admin)
let cfg=null;
async function load(){if(cfg&&!RU)return cfg;try{if(RU){const j=await(await fetch(RU+'/get/cfg',{headers:{Authorization:'Bearer '+RT}})).json();cfg=JSON.parse(j.result||'{}')}else cfg=JSON.parse(fs.readFileSync(FILE))}catch{cfg={}}
 cfg.up=cfg.up||{};cfg.off=cfg.off||[];return cfg}
async function save(){if(RU)await fetch(RU+'/set/cfg',{method:'POST',headers:{Authorization:'Bearer '+RT},body:JSON.stringify(cfg)});else try{fs.writeFileSync(FILE,JSON.stringify(cfg))}catch{}}
// helpers
const E=[],P=s=>s?s.split(','):[];
const L=(cat,name,params,desc,fn)=>E.push({cat,name,params:P(params),desc,fn});
const U=(cat,name,params,desc,url,pick)=>E.push({cat,name,params:P(params),desc,url,pick,key:cat+'_'+name});
const rnd=a=>a[Math.floor(Math.random()*a.length)],esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const col=c=>/^[0-9a-f]{3,8}$/i.test(c)?'#'+c:esc(c),seed=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))%101,7);
const svg=(w,h,i)=>({type:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${i}</svg>`});
const T=(x,y,s,t,f='#fff',x2='')=>`<text x="${x}" y="${y}" font-size="${s}" fill="${f}" font-family="Arial,sans-serif" ${x2}>${esc(t)}</text>`;
const M='text-anchor="middle"',PO='https://text.pollinations.ai/',N='';
const YT='';// kosong = isi lewat admin
// ===== AI =====
U('ai','chat','text,system=','Chat AI',PO+'{text}?system={system}');
L('ai','image','prompt','Generate gambar AI (redirect)',q=>({redirect:'https://image.pollinations.ai/prompt/'+encodeURIComponent(q.prompt)}));
U('ai','translate','text,to=id,from=en','Terjemah teks','https://api.mymemory.translated.net/get?q={text}&langpair={from}|{to}',j=>j.responseData.translatedText);
U('ai','summarize','text','Ringkas teks',PO+'Ringkas teks berikut: {text}');
U('ai','code','text,lang=javascript','Generator kode',PO+'Tulis kode {lang} untuk: {text}. Hanya kode.');
U('ai','grammar','text','Perbaiki tata bahasa',PO+'Perbaiki tata bahasa teks ini, balas hasilnya saja: {text}');
// ===== CANVAS (SVG lokal) =====
const G=(a,b)=>`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col(a)}"/><stop offset="1" stop-color="${col(b)}"/></linearGradient></defs>`;
L('canvas','welcome','name,group=Grup','Kartu welcome',q=>svg(700,300,G('6366f1','ec4899')+'<rect width="700" height="300" rx="24" fill="url(#g)"/>'+T(350,120,28,'Selamat datang',"#fff",M)+T(350,185,46,q.name,'#fff',M+' font-weight="bold"')+T(350,235,22,'di '+q.group,'#fff',M)));
L('canvas','profile','name,bio=,color=0ea5e9','Kartu profil',q=>svg(500,220,`<rect width="500" height="220" rx="20" fill="${col(q.color)}"/><circle cx="90" cy="110" r="50" fill="#fff"/>`+T(90,125,44,q.name[0].toUpperCase(),col(q.color),M+' font-weight="bold"')+T(170,100,30,q.name,'#fff','font-weight="bold"')+T(170,140,18,q.bio)));
L('canvas','badge','label,message,color=4c1','Badge ala shields',q=>{const a=q.label.length*7+14,b=q.message.length*7+14;return svg(a+b,20,`<rect width="${a}" height="20" rx="3" fill="#555"/><rect x="${a}" width="${b}" height="20" rx="3" fill="${col(q.color)}"/>`+T(a/2,14,11,q.label,'#fff',M)+T(a+b/2,14,11,q.message,'#fff',M))});
L('canvas','progress','percent,color=22c55e','Progress bar',q=>{const p=Math.max(0,Math.min(100,+q.percent));return svg(400,40,`<rect width="400" height="40" rx="20" fill="#e5e7eb"/><rect width="${p*4}" height="40" rx="20" fill="${col(q.color)}"/>`+T(200,26,18,p+'%','#111',M))});
L('canvas','gradient','c1=6366f1,c2=ec4899,w=800,h=400','Gambar gradient',q=>svg(+q.w,+q.h,G(q.c1,q.c2)+'<rect width="100%" height="100%" fill="url(#g)"/>'));
L('canvas','banner','text,c1=0f172a,c2=7c3aed','Banner teks',q=>svg(1000,300,G(q.c1,q.c2)+'<rect width="1000" height="300" fill="url(#g)"/>'+T(500,165,56,q.text,'#fff',M+' font-weight="bold"')));
L('canvas','quote','text,author=Anonim','Kartu kutipan',q=>svg(700,350,`<rect width="700" height="350" rx="20" fill="#111827"/>`+T(50,110,80,'“','#6366f1')+T(50,190,26,q.text.slice(0,50))+T(50,225,26,q.text.slice(50,100))+T(650,310,20,'— '+q.author,'#9ca3af','text-anchor="end"')));
// ===== MAKER =====
L('maker','qr','text,size=400','QR Code (PNG)',async q=>({type:'image/png',body:await QR.toBuffer(q.text,{width:Math.min(+q.size,1000)})}));
L('maker','brat','text','Gambar gaya brat',q=>svg(512,512,'<rect width="512" height="512" fill="#8ace00"/>'+T(256,270,Math.max(28,Math.min(96,600/q.text.length*1.6)),q.text,'#000',M+' filter="blur(0.6)"')));
L('maker','ttp','text,color=ffffff','Text to picture',q=>svg(512,512,T(256,270,Math.max(30,Math.min(110,700/q.text.length*1.5)),q.text,col(q.color),M+' font-weight="bold" stroke="#000" stroke-width="4" paint-order="stroke"')));
L('maker','carbon','code','Screenshot kode',q=>{const ls=q.code.split('\n').slice(0,25);return svg(700,70+ls.length*24,`<rect width="700" height="${70+ls.length*24}" rx="12" fill="#1e1e2e"/><circle cx="25" cy="25" r="7" fill="#f55"/><circle cx="48" cy="25" r="7" fill="#fb3"/><circle cx="71" cy="25" r="7" fill="#3c5"/>`+ls.map((l,i)=>T(25,65+i*24,15,l,'#cdd6f4','font-family="monospace" xml:space="preserve"')).join(''))});
L('maker','sertifikat','name,title=Sertifikat Penghargaan','Sertifikat',q=>svg(800,560,'<rect width="800" height="560" fill="#fffbeb"/><rect x="20" y="20" width="760" height="520" fill="none" stroke="#b45309" stroke-width="6"/>'+T(400,150,44,q.title,'#b45309',M+' font-weight="bold"')+T(400,230,22,'Diberikan kepada','#444',M)+T(400,310,54,q.name,'#111',M+' font-weight="bold"')+T(400,400,20,new Date().toLocaleDateString('id-ID'),'#444',M)));
// ===== DOWNLOADER (isi/ganti upstream via admin) =====
U('downloader','tiktok','url','TikTok tanpa watermark','https://www.tikwm.com/api/?url={url}&hd=1\nhttps://www.tikwm.com/api/?url={url}',j=>j.data);
const SZ='https://api.siputzx.my.id',PIPED='https://pipedapi.kavin.rocks';
const yid=u=>(String(u).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)||[])[1]||'';
U('downloader','youtube','url','YouTube info + link video & audio',PIPED+'/streams/{id}',j=>({title:j.title,uploader:j.uploader,durasi:j.duration,thumbnail:j.thumbnailUrl,audio:(j.audioStreams||[]).slice(0,3),video:(j.videoStreams||[]).filter(v=>!v.videoOnly).slice(0,3)}));
U('downloader','ytmp3','url','YouTube ke audio',SZ+'/api/d/ytmp3?url={url}\n'+PIPED+'/streams/{id}');
U('downloader','ytmp4','url','YouTube ke video',SZ+'/api/d/ytmp4?url={url}\n'+PIPED+'/streams/{id}');
U('downloader','instagram','url','Instagram post/reel',SZ+'/api/d/igdl?url={url}');
U('downloader','facebook','url','Facebook video',SZ+'/api/d/facebook?url={url}');
U('downloader','twitter','url','Twitter/X media','https://api.vxtwitter.com{path}\n'+SZ+'/api/d/twitter?url={url}',j=>j.media_extended?{teks:j.text,user:j.user_screen_name,media:j.media_extended}:j);
U('downloader','spotify','url','Spotify track',SZ+'/api/d/spotify?url={url}');
U('downloader','mediafire','url','MediaFire',SZ+'/api/d/mediafire?url={url}');
U('downloader','pinterest','url','Pinterest',SZ+'/api/d/pinterest?url={url}');
U('downloader','capcut','url','CapCut template',SZ+'/api/d/capcut?url={url}');
U('downloader','threads','url','Threads',SZ+'/api/d/threads?url={url}');
U('downloader','soundcloud','url','SoundCloud',SZ+'/api/d/soundcloud?url={url}');
L('downloader','gdrive','url','Link direct Google Drive',q=>{const m=q.url.match(/[-\w]{25,}/);if(!m)throw new Error('ID Drive tidak ditemukan');return{id:m[0],download:'https://drive.google.com/uc?export=download&id='+m[0]}});
L('downloader','ytthumb','url','Thumbnail YouTube',q=>{const i=yid(q.url);if(!i)throw new Error('Link YouTube tidak valid');return{id:i,max:`https://img.youtube.com/vi/${i}/maxresdefault.jpg`,hq:`https://img.youtube.com/vi/${i}/hqdefault.jpg`}});
L('downloader','fileinfo','url','Info file: tipe & ukuran',async q=>{if(!/^https?:\/\//.test(q.url))throw new Error('URL harus http(s)');const x=await fetch(q.url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(8000)});return{status:x.status,tipe:x.headers.get('content-type'),bytes:+x.headers.get('content-length')||null,nama:decodeURIComponent(new URL(x.url).pathname.split('/').pop())}});
// ===== GAME =====
const TK=[['hewan berkaki 4 suara meong','kucing'],['ibu kota indonesia','jakarta'],['planet terdekat matahari','merkurius'],['alat tulis warna hitam untuk papan','spidol'],['benda langit malam hari','bulan']];
L('game','tebakkata','','Tebak kata',()=>{const [soal,jawaban]=rnd(TK);return{soal,jawaban}});
L('game','math','level=1','Soal matematika',q=>{const m=10**(+q.level+0),a=Math.ceil(Math.random()*m),b=Math.ceil(Math.random()*m),o=rnd(['+','-','*']);return{soal:`${a} ${o} ${b}`,jawaban:eval(`${a}${o}${b}`)}});
L('game','dice','sisi=6','Lempar dadu',q=>({hasil:1+Math.floor(Math.random()*+q.sisi)}));
L('game','coin','','Lempar koin',()=>({hasil:rnd(['Angka','Gambar'])}));
L('game','suit','pilihan','Batu gunting kertas',q=>{const o=['batu','gunting','kertas'],b=rnd(o),u=q.pilihan.toLowerCase(),w={batu:'gunting',gunting:'kertas',kertas:'batu'};return{kamu:u,bot:b,hasil:u==b?'Seri':w[u]==b?'Kamu menang':'Kamu kalah'}});
L('game','slot','','Mesin slot',()=>{const s=[rnd('🍒🍋🔔💎7️⃣'.match(/./gu)),rnd('🍒🍋🔔💎7️⃣'.match(/./gu)),rnd('🍒🍋🔔💎7️⃣'.match(/./gu))];return{slot:s.join(' '),menang:new Set(s).size==1}});
L('game','8ball','pertanyaan','Bola ajaib',()=>({jawaban:rnd(['Ya','Tidak','Mungkin','Tanya lagi nanti','Pasti','Jangan berharap'])}));
L('game','truth','','Truth',()=>({truth:rnd(['Siapa orang yang paling kamu rindukan?','Rahasia terbesarmu?','Kebiasaan aneh kamu?'])}));
L('game','dare','','Dare',()=>({dare:rnd(['Kirim voice note nyanyi','Ganti foto profil 1 jam','Chat mantan bilang halo'])}));
L('game','ship','nama1,nama2','Cek kecocokan',q=>({persen:seed(q.nama1.toLowerCase()+q.nama2.toLowerCase())}));
// ===== INFO =====
U('info','cuaca','city','Cuaca kota','https://wttr.in/{city}?format=j1',j=>({lokasi:j.nearest_area?.[0]?.areaName?.[0]?.value,...j.current_condition[0],besok:j.weather?.[1]}));
U('info','gempa','','Gempa terbaru BMKG','https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json',j=>j.Infogempa.gempa);
U('info','kurs','base=USD','Kurs mata uang','https://open.er-api.com/v6/latest/{base}',j=>j.rates);
U('info','jadwalsholat','city,country=Indonesia','Jadwal sholat','https://api.aladhan.com/v1/timingsByCity?city={city}&country={country}&method=20',j=>j.data.timings);
U('info','quran','surah=1','Surah Al-Quran + terjemah','https://api.alquran.cloud/v1/surah/{surah}/id.indonesian',j=>j.data);
U('info','negara','name','Info negara','https://restcountries.com/v3.1/name/{name}');
U('info','ip','ip=','Info IP (kosong = IP server)','http://ip-api.com/json/{ip}');
L('info','waktu','tz=Asia/Jakarta','Waktu zona tertentu',q=>({tz:q.tz,waktu:new Date().toLocaleString('id-ID',{timeZone:q.tz})}));
// ===== RANDOM =====
const QT=['Jatuh bangun adalah proses.','Mulai dari mana kamu berdiri.','Konsisten mengalahkan bakat.'],JK=['Kenapa ayam nyebrang? Biar sampai seberang.','Ikan apa yang bisa bunyi? Ikan tuna, nyanyi tuna-tuna.'],FK=['Madu tidak pernah basi.','Gurita punya tiga jantung.'],PT=['Buah apel buah mangga, kalau mau ya bilang saja.'];
L('random','quote','','Kutipan acak',()=>({quote:rnd(QT)}));L('random','joke','','Jokes',()=>({joke:rnd(JK)}));
L('random','fakta','','Fakta unik',()=>({fakta:rnd(FK)}));L('random','pantun','','Pantun',()=>({pantun:rnd(PT)}));
L('random','number','min=1,max=100','Angka acak',q=>({angka:+q.min+Math.floor(Math.random()*(+q.max-+q.min+1))}));
L('random','color','','Warna acak',()=>({hex:'#'+crypto.randomBytes(3).toString('hex')}));
L('random','uuid','','UUID v4',()=>({uuid:crypto.randomUUID()}));
L('random','password','length=16','Password acak',q=>({password:crypto.randomBytes(64).toString('base64').replace(/[^\w]/g,'').slice(0,Math.min(+q.length,64))}));
L('random','user','','Data user palsu',()=>({nama:rnd(['Budi','Siti','Andi','Dewi'])+' '+rnd(['Santoso','Wijaya','Putri']),email:crypto.randomBytes(4).toString('hex')+'@example.com'}));
U('random','cat','','Foto kucing','https://api.thecatapi.com/v1/images/search');U('random','dog','','Foto anjing','https://dog.ceo/api/breeds/image/random');
U('random','meme','','Meme acak','https://meme-api.com/gimme');U('random','waifu','','Waifu sfw','https://api.waifu.pics/sfw/waifu');
// ===== SEARCH =====
U('search','wikipedia','q','Cari Wikipedia','https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&format=json&origin=*',j=>j.query.search);
U('search','npm','q','Cari paket npm','https://registry.npmjs.org/-/v1/search?text={q}',j=>j.objects);
U('search','github','q','Cari repo GitHub','https://api.github.com/search/repositories?q={q}',j=>j.items);
U('search','itunes','q','Cari lagu iTunes','https://itunes.apple.com/search?term={q}&limit=10',j=>j.results);
U('search','lirik','q','Cari lirik','https://lrclib.net/api/search?q={q}');
U('search','youtube','q','Cari video YouTube',PIPED+'/search?q={q}&filter=videos\n'+SZ+'/api/s/youtube?query={q}',j=>j.items?j.items.slice(0,10):j);
U('search','pinterest','q','Cari gambar Pinterest',SZ+'/api/s/pinterest?query={q}');
U('search','spotify','q','Cari lagu Spotify',SZ+'/api/s/spotify?query={q}');
U('search','web','q','Ringkasan web (DuckDuckGo)','https://api.duckduckgo.com/?q={q}&format=json&no_html=1&skip_disambig=1',j=>({judul:j.Heading,ringkasan:j.AbstractText,sumber:j.AbstractURL,gambar:j.Image&&'https://duckduckgo.com'+j.Image,terkait:(j.RelatedTopics||[]).slice(0,8).map(t=>({teks:t.Text,url:t.FirstURL}))}));
U('search','stackoverflow','q','Cari StackOverflow','https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q={q}&site=stackoverflow&pagesize=10',j=>j.items);
U('search','urban','q','Urban Dictionary','https://api.urbandictionary.com/v0/define?term={q}',j=>j.list.slice(0,5));
U('search','kamus','q','Kamus Inggris','https://api.dictionaryapi.dev/api/v2/entries/en/{q}');
U('search','anime','q','Cari anime (MAL)','https://api.jikan.moe/v4/anime?q={q}&limit=10',j=>j.data);
U('search','manga','q','Cari manga (MAL)','https://api.jikan.moe/v4/manga?q={q}&limit=10',j=>j.data);
U('search','film','q','Cari film/serial (TVMaze)','https://api.tvmaze.com/search/shows?q={q}');
U('search','buku','q','Cari buku (OpenLibrary)','https://openlibrary.org/search.json?q={q}&limit=10',j=>j.docs);
U('search','resep','q','Cari resep (MealDB)','https://www.themealdb.com/api/json/v1/1/search.php?s={q}',j=>j.meals);
U('search','koktail','q','Cari koktail','https://www.thecocktaildb.com/api/json/v1/1/search.php?s={q}',j=>j.drinks);
U('search','hackernews','q','Cari Hacker News','https://hn.algolia.com/api/v1/search?query={q}',j=>j.hits);
U('search','gambar','q','Cari gambar bebas lisensi (Openverse)','https://api.openverse.org/v1/images/?q={q}&page_size=10',j=>j.results);
U('search','podcast','q','Cari podcast','https://itunes.apple.com/search?term={q}&media=podcast&limit=10',j=>j.results);
U('search','pokemon','q','Info Pokemon','https://pokeapi.co/api/v2/pokemon/{q}',j=>({nama:j.name,id:j.id,tinggi:j.height,berat:j.weight,tipe:j.types.map(t=>t.type.name),gambar:j.sprites.front_default}));
// ===== STALKER =====
U('stalker','github','username','Profil GitHub','https://api.github.com/users/{username}');
U('stalker','npm','name','Info paket npm','https://registry.npmjs.org/{name}',j=>({name:j.name,desc:j.description,latest:j['dist-tags']?.latest,license:j.license}));
U('stalker','tiktok','username','Profil TikTok','https://www.tikwm.com/api/user/info?unique_id={username}',j=>j.data);
for(const n of ['instagram','twitter','youtube','freefire','mobilelegends','roblox','telegram'])U('stalker',n,'username','Stalk '+n,'');
// ===== TOOLS =====
L('tools','base64','text,mode=enc','Base64 enc/dec',q=>q.mode=='dec'?Buffer.from(q.text,'base64').toString():Buffer.from(q.text).toString('base64'));
L('tools','urlencode','text,mode=enc','URL enc/dec',q=>q.mode=='dec'?decodeURIComponent(q.text):encodeURIComponent(q.text));
L('tools','hash','text,algo=sha256','Hash md5/sha1/sha256/sha512',q=>crypto.createHash(q.algo).update(q.text).digest('hex'));
L('tools','slug','text','Buat slug',q=>q.text.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-'));
L('tools','case','text,mode=upper','upper/lower/title/reverse',q=>({upper:q.text.toUpperCase(),lower:q.text.toLowerCase(),title:q.text.replace(/\b\w/g,c=>c.toUpperCase()),reverse:[...q.text].reverse().join('')}[q.mode]));
L('tools','count','text','Hitung karakter/kata',q=>({karakter:q.text.length,kata:q.text.trim().split(/\s+/).length,baris:q.text.split('\n').length}));
L('tools','kalkulator','expr','Kalkulator',q=>{if(!/^[\d+\-*/().%\s^]+$/.test(q.expr))throw new Error('Ekspresi tidak valid');return Function('"use strict";return ('+q.expr.replace(/\^/g,'**')+')')()});
L('tools','bmi','berat,tinggi','Hitung BMI (kg, cm)',q=>{const b=+q.berat/((+q.tinggi/100)**2);return{bmi:+b.toFixed(1),status:b<18.5?'Kurus':b<25?'Normal':b<30?'Gemuk':'Obesitas'}});
L('tools','umur','tanggal','Hitung umur (YYYY-MM-DD)',q=>{const d=new Date(q.tanggal),n=new Date();let y=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))y--;return{tahun:y}});
L('tools','timestamp','ts=','Unix <-> tanggal',q=>q.ts?{iso:new Date(+q.ts*1000).toISOString()}:{unix:Math.floor(Date.now()/1000)});
L('tools','ping','url','Cek URL online',async q=>{if(!/^https?:\/\//.test(q.url))throw new Error('URL harus http(s)');const t=Date.now(),x=await fetch(q.url,{method:'HEAD',signal:AbortSignal.timeout(8000)});return{status:x.status,ms:Date.now()-t}});
U('tools','shorturl','url','Perpendek URL','https://tinyurl.com/api-create.php?url={url}');
// ===== ENGINE =====
async function proxy(e,q,c){
 const urls=(c.up[e.key]??e.url??'').split('\n').map(s=>s.trim()).filter(Boolean);
 if(!urls.length)throw new Error('Upstream belum diset. Isi lewat menu Admin.');
 q.id=yid(q.url||'');try{q.path=new URL(q.url).pathname}catch{q.path=''}
 let last;for(const u of urls){try{
  const x=await fetch(u.replace(/\{(\w+)\}/g,(_,k)=>k=='path'?q.path:encodeURIComponent(q[k]??'')),{signal:AbortSignal.timeout(20000),headers:{'user-agent':'Mozilla/5.0'}});
  if(!x.ok)throw new Error('HTTP '+x.status);const t=await x.text();let j;try{j=JSON.parse(t)}catch{j=t}
  if(e.pick&&typeof j=='object')try{return e.pick(j)}catch{}return j}catch(z){last=z}}
 throw new Error('Semua upstream gagal: '+last.message)}
const auth=(q,s,n)=>q.get('x-admin-key')===ADMIN?n():s.status(401).json({status:false,message:'Password admin salah'});
r.get('/list',(q,s)=>s.json({status:true,total:E.length,items:E.map(({cat,name,params,desc})=>({cat,name,params,desc}))}));
r.get('/admin/config',auth,async(q,s)=>{const c=await load();s.json({status:true,items:E.map(e=>({path:e.cat+'/'+e.name,up:!!e.key,def:e.url||'',custom:e.key?c.up[e.key]??null:null,off:c.off.includes(e.cat+'/'+e.name)}))})});
r.put('/admin/config',auth,async(q,s)=>{const c=await load(),{path,url,off}=q.body,e=E.find(x=>x.cat+'/'+x.name==path);
 if(!e)return s.status(404).json({status:false,message:'Endpoint tidak ada'});
 if(url===null&&e.key)delete c.up[e.key];else if(typeof url=='string'&&e.key)c.up[e.key]=url;
 if(typeof off=='boolean')c.off=c.off.filter(x=>x!=path).concat(off?[path]:[]);
 await save();s.json({status:true})});
const SMP={url:'https://www.tiktok.com/@scout2015/video/6718335390845095173',q:'minecraft',username:'google',name:'lodash',text:'halo',city:'Jakarta'};
r.get('/admin/test',auth,async(q,s)=>{const e=E.find(x=>x.cat+'/'+x.name==q.query.path);if(!e||!e.key)return s.json({ok:false,message:'Bukan endpoint upstream'});
 const c=await load(),p={};e.params.forEach(x=>{const[n,d]=x.split('=');p[n]=d||SMP[n]||'test'});if(/^yt|youtube/.test(e.name)&&p.url)p.url='https://youtu.be/dQw4w9WgXcQ';
 const t=Date.now();try{const o=await proxy(e,p,c);s.json({ok:true,ms:Date.now()-t,preview:JSON.stringify(o).slice(0,300)})}catch(z){s.json({ok:false,ms:Date.now()-t,message:z.message})}});
r.put('/admin/replace',auth,async(q,s)=>{const{from,to}=q.body;if(!from||!to)return s.status(400).json({status:false,message:'from & to wajib'});const c=await load();let n=0;
 for(const e of E.filter(x=>x.key)){const cur=c.up[e.key]??e.url??'';if(cur.includes(from)){c.up[e.key]=cur.split(from).join(to);n++}}await save();s.json({status:true,diubah:n})});
r.all('/:cat/:name',async(req,res)=>{
 const e=E.find(x=>x.cat==req.params.cat&&x.name==req.params.name);
 if(!e)return res.status(404).json({status:false,message:'Endpoint tidak ada. Lihat /api/list'});
 const c=await load();if(c.off.includes(e.cat+'/'+e.name))return res.status(503).json({status:false,message:'Endpoint dinonaktifkan admin'});
 const q={...req.query,...(req.body||{})};
 for(const p of e.params){const[n,d]=p.split('=');if(q[n]==null||q[n]===''){if(d!==undefined)q[n]=d;else return res.status(400).json({status:false,message:`Parameter '${n}' wajib diisi`})}}
 try{const o=e.fn?await e.fn(q,req):await proxy(e,q,c);
  if(o&&o.type){res.type(o.type);return res.send(o.body)}
  if(o&&o.redirect)return res.redirect(o.redirect);
  res.json({status:true,creator:CREATOR,result:o})}
 catch(err){res.status(500).json({status:false,message:err.message})}});
app.use('/api',r);
module.exports=app;
if(!process.env.VERCEL)app.listen(process.env.PORT||3000,()=>console.log('http://localhost:3000'));
