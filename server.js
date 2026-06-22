const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const MAX_PLAYERS = 6;
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORLD = { w: 24000, h: 5200 };
const TICK_MS = 50;
const BROADCAST_MS = 85;
const SAFE_CENTER = { x: WORLD.w / 2, y: WORLD.h / 2 };
const SAFE_RADIUS = 760;

const server = http.createServer((req, res) => {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();


const enemyCatalog = [];
function addEnemy(def) {
  const roleToType = {
    swarm:'nibber',
    hunter:'snapper',
    charger:'barracuda',
    bruiser:'crab',
    tank:'turtle',
    tankRanged:'nautilus',
    ranged:'angler',
    turret:'clam',
    weaver:'eel',
    skirmisher:'stingray',
    ambusher:'ghostShrimp',
    pulse:'jelly',
    burster:'puffer',
    summoner:'coralSiren',
    elite:'manta',
    boss:'boss',
    finalBoss:'boss'
  };
  const kindToType = {
    nibber:'nibber', reefWasp:'reefWasp', snapper:'snapper', crab:'crab', eel:'eel', puffer:'puffer',
    jelly:'jelly', barracuda:'barracuda', shark:'shark', stingray:'stingray', angler:'angler',
    clam:'clam', urchin:'urchin', squid:'squid', ghostShrimp:'ghostShrimp', nautilus:'nautilus',
    coralSiren:'coralSiren', sawfish:'sawfish', turtle:'turtle', manta:'manta',
    leviathan:'boss', kraken:'boss', abyssMaw:'boss', coralTitan:'boss', stormSerpent:'boss', final:'boss'
  };
  enemyCatalog.push({
    realm: 'reef',
    role: 'swarm',
    type: def.type || kindToType[def.kind] || roleToType[def.role] || 'nibber',
    ...def
  });
}

const zoneDefs = {
  deepsea: { label:'Deep Sea', color:'#76f2d1', mat:'scales', difficulty:1.0 },
  reef:    { label:'Relic Reef', color:'#76f2d1', mat:'coral', difficulty:1.0 },
  space:   { label:'Space Rift', color:'#d8b4ff', mat:'pearls', difficulty:1.25 },
  sky:     { label:'Sky Land', color:'#9ff7ff', mat:'pearls', difficulty:1.18 },
  ember:   { label:'Ember Trench', color:'#ff8d7a', mat:'coral', difficulty:1.35 },
  crystal: { label:'Crystal Grotto', color:'#79a7ff', mat:'pearls', difficulty:1.42 },
  void:    { label:'Void Abyss', color:'#ff5b6e', mat:'scales', difficulty:1.62 }
};

const coreEnemies = [
  { kind:'nibber', type:'nibber', realm:'reef', name:'Nibber', hp:26, speed:126, damage:9, r:14, score:18, xp:4, color:'#73d9ff', mat:'pearls', role:'swarm' },
  { kind:'reefWasp', type:'reefWasp', realm:'reef', name:'Reef Wasp', hp:18, speed:176, damage:8, r:10, score:24, xp:5, color:'#fff06a', mat:'pearls', role:'swarm' },
  { kind:'snapper', type:'snapper', realm:'reef', name:'Blood Snapper', hp:38, speed:148, damage:13, r:16, score:39, xp:7, color:'#ff6b6b', mat:'scales', role:'hunter' },
  { kind:'crab', type:'crab', realm:'reef', name:'Iron Crab', hp:55, speed:82, damage:14, r:18, score:34, xp:7, color:'#ff8d7a', mat:'coral', role:'bruiser' },
  { kind:'eel', type:'eel', realm:'reef', name:'Glass Eel', hp:34, speed:170, damage:11, r:13, score:42, xp:8, color:'#d8ff6e', mat:'scales', role:'weaver' },
  { kind:'puffer', type:'puffer', realm:'reef', name:'Storm Puffer', hp:74, speed:62, damage:18, r:24, score:60, xp:11, color:'#c58bff', mat:'coral', role:'burster' },
  { kind:'jelly', type:'jelly', realm:'reef', name:'Moon Jelly', hp:42, speed:76, damage:10, r:21, score:48, xp:9, color:'#9ff7ff', mat:'pearls', role:'pulse' },
  { kind:'barracuda', type:'barracuda', realm:'reef', name:'Barracuda Spear', hp:62, speed:162, damage:18, r:20, score:78, xp:13, color:'#a3f7ff', mat:'scales', role:'charger' },
  { kind:'shark', type:'shark', realm:'reef', name:'Razor Shark', hp:72, speed:145, damage:20, r:23, score:78, xp:13, color:'#8cc7ff', mat:'scales', role:'charger' },
  { kind:'stingray', type:'stingray', realm:'reef', name:'Volt Stingray', hp:82, speed:94, damage:16, r:26, score:92, xp:15, color:'#79a7ff', mat:'pearls', role:'ranged' },
  { kind:'angler', type:'angler', realm:'reef', name:'Lantern Angler', hp:66, speed:90, damage:13, r:22, score:86, xp:15, color:'#ffd166', mat:'pearls', role:'ranged' },
  { kind:'clam', type:'clam', realm:'reef', name:'Clam Sentinel', hp:118, speed:34, damage:17, r:25, score:108, xp:18, color:'#ffe0a3', mat:'coral', role:'turret' },
  { kind:'urchin', type:'urchin', realm:'reef', name:'Spike Urchin', hp:90, speed:46, damage:16, r:22, score:92, xp:16, color:'#ff6fae', mat:'coral', role:'turret' },
  { kind:'squid', type:'squid', realm:'reef', name:'Ink Squid', hp:78, speed:108, damage:15, r:24, score:104, xp:18, color:'#b490ff', mat:'scales', role:'skirmisher' },
  { kind:'ghostShrimp', type:'ghostShrimp', realm:'reef', name:'Ghost Shrimp', hp:52, speed:190, damage:14, r:15, score:112, xp:17, color:'#c5fff0', mat:'pearls', role:'ambusher' },
  { kind:'nautilus', type:'nautilus', realm:'reef', name:'Nautilus Guard', hp:165, speed:48, damage:22, r:31, score:154, xp:26, color:'#ffb86b', mat:'coral', role:'tankRanged' },
  { kind:'coralSiren', type:'coralSiren', realm:'reef', name:'Coral Siren', hp:128, speed:72, damage:17, r:29, score:168, xp:28, color:'#ff86c8', mat:'coral', role:'summoner', elite:true },
  { kind:'sawfish', type:'sawfish', realm:'reef', name:'Sawfish Raider', hp:188, speed:118, damage:24, r:35, score:182, xp:31, color:'#b7f7c1', mat:'scales', role:'charger', elite:true },
  { kind:'turtle', type:'turtle', realm:'reef', name:'Ancient Turtle', hp:210, speed:48, damage:26, r:34, score:168, xp:30, color:'#6ee7a8', mat:'coral', role:'tank', elite:true },
  { kind:'manta', type:'manta', realm:'reef', name:'Manta Warden', hp:160, speed:96, damage:22, r:32, score:145, xp:28, color:'#ffd166', mat:'pearls', role:'elite', elite:true },

  { kind:'starMite', type:'reefWasp', realm:'space', name:'Star Mite', hp:34, speed:180, damage:12, r:11, score:90, xp:12, color:'#eaffff', mat:'pearls', role:'swarm' },
  { kind:'cometEel', type:'eel', realm:'space', name:'Comet Eel', hp:72, speed:210, damage:18, r:17, score:145, xp:18, color:'#9ff7ff', mat:'scales', role:'charger' },
  { kind:'orbitCrab', type:'crab', realm:'space', name:'Orbit Crab', hp:120, speed:92, damage:20, r:26, score:180, xp:22, color:'#ffd166', mat:'coral', role:'tankRanged' },
  { kind:'novaJelly', type:'jelly', realm:'space', name:'Nova Jelly', hp:95, speed:96, damage:17, r:25, score:170, xp:21, color:'#d8b4ff', mat:'pearls', role:'pulse' },
  { kind:'meteorRay', type:'stingray', realm:'space', name:'Meteor Ray', hp:150, speed:124, damage:24, r:31, score:235, xp:29, color:'#ff8d7a', mat:'coral', role:'ranged', elite:true },
  { kind:'voidShrimp', type:'ghostShrimp', realm:'space', name:'Void Shrimp', hp:84, speed:230, damage:21, r:16, score:210, xp:25, color:'#7f6bff', mat:'scales', role:'ambusher' },
  { kind:'satellitePuffer', type:'puffer', realm:'space', name:'Satellite Puffer', hp:165, speed:74, damage:25, r:30, score:250, xp:32, color:'#ff6fae', mat:'coral', role:'burster', elite:true },
  { kind:'plasmaManta', type:'manta', realm:'space', name:'Plasma Manta', hp:240, speed:122, damage:30, r:38, score:360, xp:42, color:'#79a7ff', mat:'pearls', role:'elite', elite:true },
  { kind:'moonNautilus', type:'nautilus', realm:'space', name:'Moon Nautilus', hp:310, speed:58, damage:32, r:42, score:420, xp:50, color:'#f8f7ff', mat:'coral', role:'tankRanged', elite:true },
  { kind:'quasarSiren', type:'coralSiren', realm:'space', name:'Quasar Siren', hp:260, speed:90, damage:29, r:36, score:455, xp:54, color:'#ff86c8', mat:'pearls', role:'summoner', elite:true },

  { kind:'leviathan', type:'boss', realm:'deepsea', name:'Leviathan Mini-Boss', hp:560, speed:62, damage:30, r:56, score:650, xp:90, color:'#ff5b6e', mat:'scales', role:'boss', boss:true },
  { kind:'kraken', type:'boss', realm:'void', name:'Kraken of the Rifts', hp:820, speed:52, damage:34, r:64, score:980, xp:135, color:'#c58bff', mat:'pearls', role:'boss', boss:true },
  { kind:'abyssMaw', type:'boss', realm:'void', name:'Abyss Maw', hp:1040, speed:46, damage:38, r:70, score:1250, xp:165, color:'#ff8d7a', mat:'scales', role:'boss', boss:true },
  { kind:'coralTitan', type:'boss', realm:'reef', name:'Coral Titan', hp:1350, speed:36, damage:42, r:76, score:1580, xp:205, color:'#ff6fae', mat:'coral', role:'boss', boss:true },
  { kind:'stormSerpent', type:'boss', realm:'space', name:'Storm Serpent', hp:1160, speed:78, damage:36, r:62, score:1420, xp:190, color:'#9ff7ff', mat:'scales', role:'boss', boss:true },
  { kind:'final', type:'boss', realm:'void', name:'Abyss Parliament Final Boss', hp:8500, speed:30, damage:45, r:260, score:5000, xp:650, color:'#ff5b6e', mat:'scales', role:'finalBoss', boss:true, finalBoss:true }
];
for (const e of coreEnemies) addEnemy(e);

function addBiomeCreatures(){
  const roles = ['swarm','charger','weaver','ranged','pulse','skirmisher','tankRanged','ambusher','summoner'];
  const mats = ['pearls','coral','scales'];
  const creaturePrefix = {
    deepsea:'Trench', reef:'Reef', space:'Astral', sky:'Sky', ember:'Ember', crystal:'Crystal', void:'Void'
  };
  const creatureNouns = ['Fry','Wasp','Ray','Shrimp','Eel','Crab','Siren','Manta','Nautilus','Puffer','Sawfish','Warden'];
  const roleVisual = {
    swarm:'nibber',
    charger:'barracuda',
    weaver:'eel',
    ranged:'angler',
    pulse:'jelly',
    skirmisher:'stingray',
    tankRanged:'nautilus',
    ambusher:'ghostShrimp',
    summoner:'coralSiren'
  };
  for (const realm of Object.keys(zoneDefs)) {
    for (let i=1;i<=40;i++) {
      const role = roles[i % roles.length];
      const tier = Math.max(1, Math.ceil(i/4));
      addEnemy({
        kind:`${realm}BiomeSpecies${i}`,
        type: roleVisual[role] || 'nibber',
        name:`${creaturePrefix[realm]} ${creatureNouns[i%creatureNouns.length]} ${i}`,
        hp: 24 + tier*10 + i*1.8,
        speed: 72 + (i%8)*12 + (role === 'swarm' ? 42 : 0),
        damage: 8 + tier*2.3,
        r: 11 + (i%9)*2.3,
        score: 28 + i*7,
        xp: 5 + tier*2,
        color: zoneDefs[realm].color,
        mat: mats[i%mats.length],
        role,
        tier,
        realm,
        elite: i % 17 === 0
      });
    }
    for (let b=1;b<=7;b++) {
      addEnemy({
        kind:`${realm}BiomeBoss${b}`,
        type:'boss',
        name:`${zoneDefs[realm].label} Boss ${b}`,
        hp: 650 + b*180 + zoneDefs[realm].difficulty*240,
        speed: 44 + b*4,
        damage: 25 + b*4,
        r: 50 + b*5,
        score: 720 + b*260,
        xp: 105 + b*30,
        color: zoneDefs[realm].color,
        mat: zoneDefs[realm].mat,
        role: b%2 ? 'boss' : 'summoner',
        boss:true,
        realm,
        tier: 4 + b*2
      });
    }
  }
}
addBiomeCreatures();

function realmFromPlayerState(raw) {
  const r = String(raw || 'deepsea').toLowerCase().replace(/\s+/g, '');
  if (r.includes('space')) return 'space';
  if (r.includes('sky')) return 'sky';
  if (r.includes('ember')) return 'ember';
  if (r.includes('crystal')) return 'crystal';
  if (r.includes('void')) return 'void';
  if (r.includes('reef')) return 'reef';
  if (r.includes('deep')) return 'deepsea';
  return 'deepsea';
}

function rand(a, b) { return Math.random() * (b - a) + a; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function roomClients(room) { return rooms.get(room)?.clients || new Set(); }
function broadcast(room, data, except = null) {
  for (const client of roomClients(room)) if (client !== except) safeSend(client, data);
}
function cleanRoomCode(room) {
  return String(room || 'reef').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'reef';
}
function getRoom(roomCode) {
  const code = cleanRoomCode(roomCode);
  if (!rooms.has(code)) rooms.set(code, makeRoom(code));
  return rooms.get(code);
}
function makeRoom(code) {
  return {
    code,
    clients: new Set(),
    enemies: [],
    wave: 0,
    total: 0,
    remainingToSpawn: 0,
    spawnTimer: 0,
    waveBreak: 0,
    nextEnemyId: 1,
    lastBroadcast: 0,
    lastTick: Date.now()
  };
}
function playerArray(room) {
  return [...room.clients].filter(c => c.state && Number.isFinite(c.state.x) && Number.isFinite(c.state.y));
}
function averagePlayerPos(room) {
  const players = playerArray(room);
  if (!players.length) return { x: WORLD.w / 2, y: WORLD.h / 2 };
  let x = 0, y = 0;
  for (const p of players) { x += p.state.x; y += p.state.y; }
  return { x: x / players.length, y: y / players.length };
}

function isSafePlayer(client) {
  const s = client && client.state ? client.state : {};
  const realm = String(s.realm || '').toLowerCase();
  const x = Number(s.x), y = Number(s.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const nearPlaza = Math.hypot(x - SAFE_CENTER.x, y - SAFE_CENTER.y) < SAFE_RADIUS;
  return (s.safe === true) || ((realm === 'deepsea' || realm === 'deep sea' || realm === '') && nearPlaza);
}
function combatPlayerArray(room) {
  return playerArray(room).filter(p => !isSafePlayer(p));
}
function averageCombatPlayerPos(room) {
  const players = combatPlayerArray(room);
  if (!players.length) return { x: SAFE_CENTER.x + SAFE_RADIUS + 900, y: SAFE_CENTER.y };
  let x = 0, y = 0;
  for (const p of players) { x += p.state.x; y += p.state.y; }
  return { x: x / players.length, y: y / players.length };
}
function pushOutOfSafeZone(pos, extra = 180) {
  const dx = pos.x - SAFE_CENTER.x;
  const dy = pos.y - SAFE_CENTER.y;
  const d = Math.hypot(dx, dy) || 1;
  const min = SAFE_RADIUS + extra;
  if (d >= min) return pos;
  return {
    x: SAFE_CENTER.x + dx / d * min,
    y: SAFE_CENTER.y + dy / d * min
  };
}


function activeRoomRealm(room) {
  const players = combatPlayerArray(room);
  if (!players.length) return 'deepsea';
  const counts = Object.create(null);
  for (const p of players) {
    const realm = realmFromPlayerState(p.state && p.state.realm);
    counts[realm] = (counts[realm] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'deepsea';
}
function coopHpScale(room, boss = false) {
  const n = Math.max(1, combatPlayerArray(room).length || 1);
  return boss ? 1 + (n - 1) * 0.52 : 1 + (n - 1) * 0.30;
}

function startWave(room) {
  if (combatPlayerArray(room).length === 0) return;
  room.wave += 1;
  room.enemies = [];
  room.total = Math.min(34 + room.wave * 8 + combatPlayerArray(room).length * 6, 260);
  room.remainingToSpawn = room.total;
  room.spawnTimer = 0.1;
  room.waveBreak = 0;
  broadcast(room.code, { type: 'waveStart', wave: room.wave, total: room.total });

  if (room.wave % 20 === 0) {
    spawnEnemy(room, 'final');
    room.remainingToSpawn = Math.max(0, room.remainingToSpawn - 1);
  } else if (room.wave % 5 === 0) {
    const realm = activeRoomRealm(room);
    const biomeBosses = enemyCatalog.filter(e => e.boss && !e.finalBoss && e.realm === realm).map(e => e.kind);
    const fallbackBosses = ['leviathan', 'kraken', 'abyssMaw', 'coralTitan', 'stormSerpent'];
    const bosses = biomeBosses.length ? biomeBosses : fallbackBosses;
    spawnEnemy(room, bosses[(Math.floor(room.wave / 5) - 1) % bosses.length]);
    room.remainingToSpawn = Math.max(0, room.remainingToSpawn - 1);
  }
}
function chooseType(room, forcedKind) {
  if (forcedKind) return enemyCatalog.find(e => e.kind === forcedKind) || enemyCatalog[0];
  const realm = activeRoomRealm(room);
  let pool = enemyCatalog.filter(e => {
    if (e.finalBoss || e.boss) return false;
    if (e.realm !== realm) return false;
    if (e.elite) return room.wave >= 3 && Math.random() < .28;
    return true;
  });
  if (pool.length < 10) pool = enemyCatalog.filter(e => !e.finalBoss && !e.boss && (e.realm === 'reef' || e.realm === 'deepsea'));
  const max = clamp(12 + room.wave * 5, 12, pool.length);
  return pool[Math.floor(rand(0, max))] || enemyCatalog[0];
}
function spawnEnemy(room, forcedKind = null) {
  const base = chooseType(room, forcedKind);
  const center = averageCombatPlayerPos(room);
  const a = rand(0, Math.PI * 2);
  const dist = base.finalBoss ? rand(900, 1300) : base.boss ? rand(760, 1120) : rand(580, 980);
  const scale = 1 + Math.max(0, room.wave - 1) * 0.10;
  const hpScale = (base.finalBoss ? 1 + room.wave * .08 : base.boss ? 1 + room.wave * .055 : scale) * coopHpScale(room, base.boss || base.finalBoss);
  const r = Math.floor(base.r * (base.finalBoss ? 1 : base.boss ? 1.04 : 1));
  let spawn = {
    x: clamp(center.x + Math.cos(a) * dist, 120, WORLD.w - 120),
    y: clamp(center.y + Math.sin(a) * dist, 120, WORLD.h - 120)
  };
  spawn = pushOutOfSafeZone(spawn, base.boss || base.finalBoss ? 420 : 220);
  spawn.x = clamp(spawn.x, 120, WORLD.w - 120);
  spawn.y = clamp(spawn.y, 120, WORLD.h - 120);
  const enemy = {
    id: `${room.code}-${room.nextEnemyId++}`,
    kind: base.kind,
    type: base.type || 'nibber',
    role: base.role || 'swarm',
    realm: base.realm || activeRoomRealm(room),
    tier: base.tier || 1,
    name: base.name,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle: rand(0, Math.PI * 2),
    r,
    hp: Math.floor(base.hp * hpScale),
    maxHp: Math.floor(base.hp * hpScale),
    speed: Math.floor(base.speed * (1 + room.wave * .010)),
    damage: Math.floor(base.damage * (1 + room.wave * .020)),
    score: Math.floor(base.score * (1 + room.wave * .08)),
    xp: Math.floor(base.xp * (1 + room.wave * .06)),
    color: base.color,
    mat: base.mat,
    elite: !!base.elite,
    boss: !!base.boss,
    finalBoss: !!base.finalBoss,
    hit: 0,
    contrib: Object.create(null)
  };
  room.enemies.push(enemy);
}
function linePointDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / ab2, 0, 1);
  const x = ax + abx * t, y = ay + aby * t;
  return { d: Math.hypot(px - x, py - y), t };
}
function weaponProfile(msg) {
  const id = String(msg.weapon || 'bubbleLance');
  let damage = Number(msg.damage || 18);
  damage = clamp(damage, 8, 140);
  let range = 980, width = 28, pierce = 1;
  if (/shotgun|flak/i.test(id)) { width = 110; range = 520; pierce = 5; damage *= .7; }
  if (/rail|beam|laser|needler|trident/i.test(id)) { width = 22; range = 1550; pierce = 4; damage *= 1.15; }
  if (/cannon|mortar|bomb|vortex|mine/i.test(id)) { width = 135; range = 850; pierce = 6; damage *= 1.35; }
  if (/swarm|zapper|boomerang|whip/i.test(id)) { width = 70; range = 950; pierce = 3; }
  return { damage, range, width, pierce };
}
function handleShot(ws, msg) {
  if (!ws.room) return;
  const room = rooms.get(ws.room);
  if (!room) return;
  const sx = Number(msg.x ?? ws.state.x), sy = Number(msg.y ?? ws.state.y), angle = Number(msg.angle || 0);
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(angle)) return;
  const profile = weaponProfile(msg);
  const ex = sx + Math.cos(angle) * profile.range;
  const ey = sy + Math.sin(angle) * profile.range;
  const hits = [];
  for (const e of room.enemies) {
    const info = linePointDistance(e.x, e.y, sx, sy, ex, ey);
    if (info.d <= profile.width + e.r) hits.push({ e, t: info.t, d: info.d });
  }
  hits.sort((a,b) => a.t - b.t || a.d - b.d);
  let count = Math.min(profile.pierce, hits.length);
  for (let i = 0; i < count; i++) {
    const e = hits[i].e;
    let dmg = Math.floor(profile.damage * (1 - i * .18));
    if (Math.random() < clamp(Number(msg.crit || 0), 0, .4)) dmg = Math.floor(dmg * 1.75);
    e.hp -= dmg;
    e.hit = 0.18;
    e.contrib[ws.id] = (e.contrib[ws.id] || 0) + dmg;
    if (e.hp <= 0) killEnemy(room, e);
  }
  broadcast(ws.room, { type: 'playerShot', id: ws.id, x: sx, y: sy, angle, weapon: msg.weapon }, ws);
}
function rarityByWave(wave, boss) {
  const roll = Math.random();
  const bonus = Math.min(.35, wave * .006) + (boss ? .20 : 0);
  if (roll < .006 + bonus * .08) return 'cosmic';
  if (roll < .02 + bonus * .15) return 'mythic';
  if (roll < .06 + bonus * .25) return 'legendary';
  if (roll < .14 + bonus * .35) return 'epic';
  if (roll < .32 + bonus * .4) return 'rare';
  if (roll < .62) return 'uncommon';
  return 'common';
}
function rewardItem(room, e) {
  const types = ['relic','core','shard','gem','rune'];
  const namesByRealm = {
    deepsea:['Abyss Relic','Trench Core','Pressure Sigil','Midnight Shard'],
    reef:['Coral Relic','Pearl Lens','Kelp Charm','Shell Compass'],
    space:['Nova Core','Comet Sigil','Orbit Lens','Gravity Shard'],
    sky:['Cloud Relic','Zephyr Lens','Aether Charm','Halo Shard'],
    ember:['Magma Core','Ash Sigil','Basalt Charm','Molten Shard'],
    crystal:['Prism Relic','Quartz Lens','Mirror Core','Sapphire Shard'],
    void:['Void Sigil','Eclipse Core','Rift Rune','Umbral Shard']
  };
  const names = namesByRealm[e.realm] || namesByRealm.deepsea;
  return {
    type: types[Math.floor(rand(0, types.length))],
    rarity: rarityByWave(room.wave, e.boss || e.finalBoss),
    name: names[Math.floor(rand(0, names.length))],
    count: 1
  };
}
function killEnemy(room, enemy) {
  const idx = room.enemies.indexOf(enemy);
  if (idx >= 0) room.enemies.splice(idx, 1);
  broadcast(room.code, { type:'enemyKilled', id: enemy.id, x: enemy.x, y: enemy.y, color: enemy.color });
  const contributors = Object.entries(enemy.contrib || {}).filter(([,d]) => d > 0);
  const totalDamage = contributors.reduce((s, [,d]) => s + d, 0) || 1;
  for (const [id, dmg] of contributors) {
    const client = [...room.clients].find(c => c.id === id);
    if (!client) continue;
    const share = clamp(dmg / totalDamage, .25, 1);
    safeSend(client, {
      type:'sharedReward',
      score: Math.floor(enemy.score * share),
      xp: Math.max(1, Math.floor(enemy.xp * share)),
      mat: enemy.mat,
      matCount: enemy.boss ? 3 : enemy.elite ? 2 : 1,
      item: Math.random() < (enemy.finalBoss ? 1 : enemy.boss ? .8 : enemy.elite ? .32 : .10) ? rewardItem(room, enemy) : null,
      x: enemy.x,
      y: enemy.y
    });
  }
}
function updateRoom(room, dt) {
  if (room.clients.size === 0) return;
  const players = playerArray(room);
  const combatPlayers = combatPlayerArray(room);

  if (combatPlayers.length === 0) {
    if (room.enemies.length || room.remainingToSpawn > 0) {
      room.enemies = [];
      room.remainingToSpawn = 0;
      room.total = 0;
      room.waveBreak = 0;
      broadcast(room.code, { type: 'safePlazaClear' });
    }
    return;
  }

  if (room.wave === 0 || (room.remainingToSpawn <= 0 && room.enemies.length === 0 && room.total === 0)) startWave(room);

  const maxOnScreen = Math.min(42 + room.wave * 6 + combatPlayers.length * 8, 170);
  room.spawnTimer -= dt;
  if (room.remainingToSpawn > 0 && room.spawnTimer <= 0 && room.enemies.length < maxOnScreen) {
    let burst = Math.min(3 + Math.floor(room.wave / 3), 14);
    while (burst-- > 0 && room.remainingToSpawn > 0 && room.enemies.length < maxOnScreen) {
      spawnEnemy(room);
      room.remainingToSpawn--;
    }
    room.spawnTimer = Math.max(0.07, 0.36 - room.wave * 0.006);
  }

  if (!combatPlayers.length) return;
  for (const e of room.enemies) {
    e.hit = Math.max(0, e.hit - dt);
    let target = combatPlayers[0];
    let best = Infinity;
    for (const p of combatPlayers) {
      const d = Math.hypot((p.state.x || 0) - e.x, (p.state.y || 0) - e.y);
      if (d < best) { best = d; target = p; }
    }
    const dx = (target.state.x || WORLD.w/2) - e.x;
    const dy = (target.state.y || WORLD.h/2) - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const avoid = {x:0,y:0};
    for (const o of room.enemies) {
      if (o === e) continue;
      const ox = e.x - o.x, oy = e.y - o.y;
      const od = Math.hypot(ox, oy) || 1;
      const range = e.r + o.r + 20;
      if (od < range) { avoid.x += ox / od * (1 - od/range); avoid.y += oy / od * (1 - od/range); }
    }
    const ax = dx / len + avoid.x * 1.6;
    const ay = dy / len + avoid.y * 1.6;
    const al = Math.hypot(ax, ay) || 1;
    const speed = e.speed * (e.finalBoss ? .50 : e.boss ? .70 : e.elite ? .90 : .84);
    e.vx = e.vx * Math.pow(.05, dt) + ax / al * speed * dt * 5.6;
    e.vy = e.vy * Math.pow(.05, dt) + ay / al * speed * dt * 5.6;
    e.x = clamp(e.x + e.vx * dt, e.r, WORLD.w - e.r);
    e.y = clamp(e.y + e.vy * dt, e.r, WORLD.h - e.r);
    e.angle = Math.atan2(e.vy || dy, e.vx || dx);

    if (best < e.r + 22) {
      const now = Date.now();
      if (!target.nextHurtAt || now >= target.nextHurtAt) {
        target.nextHurtAt = now + (e.finalBoss ? 1000 : e.boss ? 820 : 650);
        safeSend(target, { type:'playerHurt', id: target.id, amount: e.damage, source: e.name });
      }
    }
  }

  if (room.remainingToSpawn <= 0 && room.enemies.length === 0) {
    room.waveBreak += dt;
    if (room.waveBreak > 1.4) startWave(room);
  } else {
    room.waveBreak = 0;
  }
}
function serializeState(room) {
  const remaining = room.remainingToSpawn + room.enemies.length;
  return {
    type:'sharedState',
    wave: room.wave || 1,
    total: room.total || 1,
    remaining,
    enemies: room.enemies.map(e => ({
      id:e.id, kind:e.kind, type:e.type, role:e.role, realm:e.realm, name:e.name, x:Math.round(e.x), y:Math.round(e.y), angle:e.angle,
      r:e.r, hp:Math.max(0, Math.round(e.hp)), maxHp:e.maxHp, color:e.color,
      elite:e.elite, boss:e.boss, finalBoss:e.finalBoss, hit:e.hit
    }))
  };
}
function leaveRoom(ws) {
  if (!ws.room) return;
  const room = rooms.get(ws.room);
  if (room) {
    room.clients.delete(ws);
    broadcast(ws.room, { type: 'peerLeave', id: ws.id, count: room.clients.size, maxPlayers: MAX_PLAYERS });
    if (room.clients.size === 0) rooms.delete(ws.room);
  }
  ws.room = null;
}


function coopHealthScale(playerCount, boss = false) {
  const n = Math.max(1, Number(playerCount) || 1);
  if (boss) return 1 + (n - 1) * 0.82;
  return 1 + (n - 1) * 0.55;
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 10);
  ws.name = 'Player';
  ws.room = null;
  ws.state = {};
  ws.nextHurtAt = 0;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      const roomCode = cleanRoomCode(msg.room);
      const room = getRoom(roomCode);
      const name = String(msg.name || 'Player').slice(0, 18);

      if (room.clients.size >= MAX_PLAYERS && !room.clients.has(ws)) {
        safeSend(ws, { type: 'roomFull', room: roomCode, maxPlayers: MAX_PLAYERS });
        return;
      }

      leaveRoom(ws);
      ws.room = roomCode;
      ws.name = name;
      ws.state = { id: ws.id, name, x: WORLD.w/2, y: WORLD.h/2, hp: 100, maxHp: 100 };
      room.clients.add(ws);
      if (room.wave === 0) startWave(room);

      const players = [...room.clients].map(client => ({ id: client.id, name: client.name, ...(client.state || {}) }));
      safeSend(ws, { type: 'joined', id: ws.id, room: roomCode, count: room.clients.size, maxPlayers: MAX_PLAYERS, players });
      safeSend(ws, serializeState(room));
      broadcast(roomCode, { type: 'peerJoin', count: room.clients.size, maxPlayers: MAX_PLAYERS, player: { id: ws.id, name } }, ws);
      return;
    }

    if (!ws.room) return;

    if (msg.type === 'playerUpdate') {
      const p = msg.player || {};
      ws.state = {
        id: ws.id,
        name: ws.name,
        x: Number.isFinite(Number(p.x)) ? Number(p.x) : ws.state.x,
        y: Number.isFinite(Number(p.y)) ? Number(p.y) : ws.state.y,
        hp: Number.isFinite(Number(p.hp)) ? Number(p.hp) : ws.state.hp,
        maxHp: Number.isFinite(Number(p.maxHp)) ? Number(p.maxHp) : ws.state.maxHp,
        angle: Number.isFinite(Number(p.angle)) ? Number(p.angle) : ws.state.angle,
        weapon: p.weapon,
        realm: p.realm,
        wave: p.wave,
        score: p.score,
        safe: p.safe === true
      };
      broadcast(ws.room, { type: 'playerUpdate', id: ws.id, player: ws.state }, ws);
      return;
    }

    if (msg.type === 'playerShot') {
      handleShot(ws, msg);
      return;
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min(.1, (now - room.lastTick) / 1000 || .05);
    room.lastTick = now;
    updateRoom(room, dt);
    if (now - room.lastBroadcast >= BROADCAST_MS) {
      room.lastBroadcast = now;
      broadcast(room.code, serializeState(room));
    }
  }
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`Tidefall.io shared-enemy co-op server running at http://localhost:${PORT}`);
});
