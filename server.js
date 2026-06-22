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
  enemyCatalog.push({
    realm: 'reef',
    role: 'swarm',
    type: def.kind,
    ...def
  });
}

const biomePalettes = {
  reef: {
    prefix: ['Reef', 'Kelp', 'Pearl', 'Tide', 'Shell', 'Lagoon', 'Coral', 'Azure'],
    body: ['Minnow', 'Snapper', 'Crab', 'Eel', 'Jelly', 'Puffer', 'Angler', 'Manta'],
    colors: ['#73d9ff','#76f2d1','#ffd166','#9ff7ff','#ff8d7a','#6ee7a8'],
    types: ['fish','crab','eel','jelly','puffer','angler','manta','shark'],
    roles: ['swarm','bruiser','weaver','pulse','burster','ranged','elite','charger']
  },
  space: {
    prefix: ['Nova', 'Orbit', 'Comet', 'Star', 'Astro', 'Lunar', 'Solar', 'Cosmic'],
    body: ['Drone', 'Wisp', 'Ray', 'Serpent', 'Skimmer', 'Meteorling', 'Watcher', 'Leaper'],
    colors: ['#8ca7ff','#c58bff','#eaffff','#ffd166','#7f6bff','#ff86c8'],
    types: ['starfish','jelly','ray','eel','barracuda','squid','nautilus','fish'],
    roles: ['ranged','pulse','skirmisher','weaver','charger','summoner','tankRanged','swarm']
  },
  sky: {
    prefix: ['Sky', 'Cloud', 'Tempest', 'Zephyr', 'Wing', 'Halo', 'Aero', 'Storm'],
    body: ['Manta', 'Kite', 'Ray', 'Drifter', 'Eel', 'Shrike', 'Glider', 'Gullfish'],
    colors: ['#b8f7ff','#ffffff','#79a7ff','#ffd166','#9ff7ff','#c5fff0'],
    types: ['manta','fish','ray','jelly','eel','barracuda','shrimp','angler'],
    roles: ['elite','swarm','skirmisher','pulse','weaver','charger','ambusher','ranged']
  },
  ember: {
    prefix: ['Ember', 'Magma', 'Ash', 'Lava', 'Cinder', 'Furnace', 'Char', 'Blaze'],
    body: ['Lobster', 'Urchin', 'Crab', 'Puffer', 'Snapper', 'Warden', 'Eel', 'Maw'],
    colors: ['#ff7043','#ff5b6e','#ffd166','#ff8d7a','#ff9f43','#ff6fae'],
    types: ['crab','urchin','puffer','fish','shark','clam','eel','squid'],
    roles: ['bruiser','turret','burster','hunter','charger','tank','weaver','skirmisher']
  },
  crystal: {
    prefix: ['Crystal', 'Prism', 'Glass', 'Quartz', 'Shard', 'Mirror', 'Opal', 'Gem'],
    body: ['Jelly', 'Eel', 'Ray', 'Nautilus', 'Shrimp', 'Clam', 'Serpent', 'Wisp'],
    colors: ['#eaffff','#b8f7ff','#d8b4ff','#c5fff0','#9ff7ff','#ffd166'],
    types: ['jelly','eel','ray','nautilus','shrimp','clam','barracuda','fish'],
    roles: ['pulse','weaver','skirmisher','tankRanged','ambusher','tank','charger','swarm']
  },
  void: {
    prefix: ['Void', 'Abyss', 'Null', 'Rift', 'Shadow', 'Dread', 'Black', 'Night'],
    body: ['Maw', 'Squid', 'Serpent', 'Wraith', 'Urchin', 'Leviathan', 'Hunter', 'Manta'],
    colors: ['#7f6bff','#c58bff','#2d3142','#ff5b6e','#b490ff','#ff86c8'],
    types: ['shark','squid','eel','shrimp','urchin','boss','barracuda','manta'],
    roles: ['hunter','summoner','weaver','ambusher','turret','boss','charger','elite']
  },
  deepsea: {
    prefix: ['Deep', 'Trench', 'Abyssal', 'Pressure', 'Sunken', 'Ancient', 'Midnight', 'Fossil'],
    body: ['Angler', 'Crab', 'Nautilus', 'Eel', 'Leviathan', 'Puffer', 'Titan', 'Ray'],
    colors: ['#0bd3d3','#76f2d1','#ffd166','#8cc7ff','#c58bff','#6ee7a8'],
    types: ['angler','crab','nautilus','eel','boss','puffer','clam','ray'],
    roles: ['ranged','bruiser','tankRanged','weaver','boss','burster','tank','skirmisher']
  }
};

function biomeFromRealm(raw) {
  const r = String(raw || '').toLowerCase().replace(/\s+/g, '');
  if (r.includes('space')) return 'space';
  if (r.includes('sky')) return 'sky';
  if (r.includes('ember') || r.includes('trench')) return 'ember';
  if (r.includes('crystal') || r.includes('grotto')) return 'crystal';
  if (r.includes('void')) return 'void';
  if (r.includes('deep')) return 'deepsea';
  return 'reef';
}

function addBiomeSpecies(biome, count, baseTier = 1) {
  const p = biomePalettes[biome] || biomePalettes.reef;
  for (let i = 0; i < count; i++) {
    const tier = baseTier + Math.floor(i / 10);
    const type = p.types[i % p.types.length];
    const role = p.roles[i % p.roles.length];
    const bossLike = role === 'boss';
    const elite = role === 'elite' || (tier >= 5 && i % 13 === 0);
    addEnemy({
      kind: `${biome}_${i}`,
      realm: biome,
      type,
      role,
      name: `${p.prefix[i % p.prefix.length]} ${p.body[(i * 5) % p.body.length]}`,
      hp: Math.floor((bossLike ? 650 : elite ? 230 : 42) + tier * (bossLike ? 160 : elite ? 34 : 12) + (i % 7) * 7),
      speed: Math.floor((bossLike ? 34 : role === 'charger' ? 112 : role === 'swarm' ? 118 : role === 'ambusher' ? 122 : role === 'tank' ? 42 : 76) + Math.min(45, tier * 3)),
      r: Math.floor((bossLike ? 62 : elite ? 34 : 13) + (i % 8) * (bossLike ? 2.5 : elite ? 1.2 : .9)),
      damage: Math.floor((bossLike ? 26 : elite ? 17 : 6) + tier * (bossLike ? 3 : elite ? 2 : 1)),
      score: Math.floor((bossLike ? 600 : elite ? 150 : 24) + tier * 18 + i * 2),
      xp: Math.floor((bossLike ? 80 : elite ? 28 : 5) + tier * 2),
      color: p.colors[i % p.colors.length],
      mat: ['pearls','coral','scales'][i % 3],
      elite,
      boss: bossLike,
      finalBoss: false
    });
  }
}

const coreEnemies = [
  { kind:'nibber', realm:'reef', type:'fish', role:'swarm', name:'Reef Nibber', hp:46, speed:104, r:15, damage:5, score:22, xp:5, color:'#73d9ff', mat:'pearls' },
  { kind:'crab', realm:'reef', type:'crab', role:'bruiser', name:'Iron Crab', hp:92, speed:58, r:21, damage:8, score:38, xp:8, color:'#ff8d7a', mat:'coral' },
  { kind:'eel', realm:'reef', type:'eel', role:'weaver', name:'Glass Eel', hp:70, speed:126, r:14, damage:7, score:42, xp:9, color:'#d8ff6e', mat:'scales' },
  { kind:'jelly', realm:'reef', type:'jelly', role:'pulse', name:'Moon Jelly', hp:86, speed:54, r:23, damage:6, score:50, xp:10, color:'#9ff7ff', mat:'pearls' },
  { kind:'shark', realm:'reef', type:'shark', role:'charger', name:'Razor Shark', hp:125, speed:104, r:26, damage:12, score:85, xp:15, color:'#8cc7ff', mat:'scales' },
  { kind:'angler', realm:'deepsea', type:'angler', role:'ranged', name:'Deep Lantern Angler', hp:135, speed:70, r:25, damage:9, score:92, xp:16, color:'#ffd166', mat:'pearls' },
  { kind:'squid', realm:'void', type:'squid', role:'summoner', name:'Ink Rift Squid', hp:125, speed:82, r:27, damage:10, score:105, xp:18, color:'#b490ff', mat:'scales' },
  { kind:'wasp', realm:'sky', type:'barracuda', role:'charger', name:'Sky Wasp', hp:64, speed:132, r:13, damage:8, score:58, xp:11, color:'#fff275', mat:'pearls' },
  { kind:'ray', realm:'space', type:'ray', role:'skirmisher', name:'Volt Star Ray', hp:175, speed:76, r:32, damage:14, score:135, xp:23, color:'#9ff7ff', mat:'pearls' },
  { kind:'turtle', realm:'reef', type:'turtle', role:'tank', name:'Ancient Turtle Elite', hp:390, speed:42, r:40, damage:19, score:260, xp:42, color:'#6ee7a8', mat:'coral', elite:true },
  { kind:'manta', realm:'sky', type:'manta', role:'elite', name:'Manta Warden Elite', hp:350, speed:74, r:38, damage:18, score:245, xp:40, color:'#ffd166', mat:'pearls', elite:true },
  { kind:'leviathan', realm:'deepsea', type:'boss', role:'boss', name:'Leviathan Boss', hp:1450, speed:44, r:70, damage:24, score:900, xp:125, color:'#ff5b6e', mat:'scales', boss:true },
  { kind:'kraken', realm:'void', type:'squid', role:'boss', name:'Kraken Boss', hp:2050, speed:38, r:82, damage:28, score:1250, xp:165, color:'#c58bff', mat:'pearls', boss:true },
  { kind:'titan', realm:'ember', type:'clam', role:'boss', name:'Ember Coral Titan', hp:2650, speed:30, r:92, damage:31, score:1500, xp:205, color:'#ff6fae', mat:'coral', boss:true },
  { kind:'final', realm:'void', type:'boss', role:'finalBoss', name:'Abyss Parliament Final Boss', hp:8200, speed:22, r:260, damage:38, score:5000, xp:650, color:'#ff5b6e', mat:'scales', boss:true, finalBoss:true }
];
for (const e of coreEnemies) addEnemy(e);
for (const biome of ['reef','space','sky','ember','crystal','void','deepsea']) addBiomeSpecies(biome, 28);

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


function activeRoomBiome(room) {
  const players = combatPlayerArray(room);
  if (!players.length) return 'reef';
  const counts = Object.create(null);
  for (const p of players) {
    const b = biomeFromRealm(p.state && p.state.realm);
    counts[b] = (counts[b] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'reef';
}
function playerCountScale(room, boss = false) {
  const n = Math.max(1, combatPlayerArray(room).length || room.clients.size || 1);
  return boss ? 1 + (n - 1) * 0.48 : 1 + (n - 1) * 0.28;
}

function startWave(room) {
  if (combatPlayerArray(room).length === 0) return;
  room.wave += 1;
  room.enemies = [];
  room.total = Math.min(24 + room.wave * 5 + combatPlayerArray(room).length * 4, 150);
  room.remainingToSpawn = room.total;
  room.spawnTimer = 0.1;
  room.waveBreak = 0;
  broadcast(room.code, { type: 'waveStart', wave: room.wave, total: room.total });

  if (room.wave % 20 === 0) {
    spawnEnemy(room, 'final');
    room.remainingToSpawn = Math.max(0, room.remainingToSpawn - 1);
  } else if (room.wave % 5 === 0) {
    const biome = activeRoomBiome(room);
    const bossesByBiome = {
      reef: ['leviathan'],
      deepsea: ['leviathan'],
      space: ['space_5','space_13','space_21'],
      sky: ['manta'],
      ember: ['titan'],
      crystal: ['crystal_5','crystal_13','crystal_21'],
      void: ['kraken']
    };
    const bosses = bossesByBiome[biome] || ['leviathan', 'kraken', 'titan'];
    spawnEnemy(room, bosses[(Math.floor(room.wave / 5) - 1) % bosses.length]);
    room.remainingToSpawn = Math.max(0, room.remainingToSpawn - 1);
  }
}

function chooseType(room, forcedKind) {
  if (forcedKind) return enemyCatalog.find(e => e.kind === forcedKind) || enemyCatalog[0];
  const biome = activeRoomBiome(room);
  const pool = enemyCatalog.filter(e => {
    if (e.finalBoss || e.boss) return false;
    if (e.realm !== biome && e.realm !== 'all') return false;
    if (e.elite) return room.wave >= 4 && Math.random() < .15;
    return true;
  });
  const max = clamp(7 + room.wave * 2, 7, pool.length);
  return pool[Math.floor(rand(0, max))] || enemyCatalog[0];
}
function spawnEnemy(room, forcedKind = null) {
  const base = chooseType(room, forcedKind);
  const center = averageCombatPlayerPos(room);
  const a = rand(0, Math.PI * 2);
  const dist = base.finalBoss ? rand(1200, 1700) : base.boss ? rand(950, 1350) : rand(780, 1250);
  const scale = 1 + Math.max(0, room.wave - 1) * 0.075;
  const hpScale = (base.finalBoss ? 1 + room.wave * .065 : base.boss ? 1 + room.wave * .045 : scale) * playerCountScale(room, base.boss || base.finalBoss);
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
    name: base.name,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle: rand(0, Math.PI * 2),
    r,
    hp: Math.floor(base.hp * hpScale),
    maxHp: Math.floor(base.hp * hpScale),
    speed: Math.floor(base.speed * (1 + room.wave * .006)),
    damage: Math.floor(base.damage * (1 + room.wave * .014)),
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
  const names = ['Co-op Pearl Lens','Shared Tide Cog','Abyss Sync Shard','Twin Rift Rune','Leviathan Circuit','Coral Signal Gem','Party Relic'];
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

  const maxOnScreen = Math.min(18 + room.wave * 3 + combatPlayers.length * 5, 95);
  room.spawnTimer -= dt;
  if (room.remainingToSpawn > 0 && room.spawnTimer <= 0 && room.enemies.length < maxOnScreen) {
    let burst = Math.min(1 + Math.floor(room.wave / 4), 6);
    while (burst-- > 0 && room.remainingToSpawn > 0 && room.enemies.length < maxOnScreen) {
      spawnEnemy(room);
      room.remainingToSpawn--;
    }
    room.spawnTimer = Math.max(0.16, 0.72 - room.wave * 0.006);
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
    const speed = e.speed * (e.finalBoss ? .38 : e.boss ? .56 : e.elite ? .78 : .72);
    e.vx = e.vx * Math.pow(.035, dt) + ax / al * speed * dt * 4.2;
    e.vy = e.vy * Math.pow(.035, dt) + ay / al * speed * dt * 4.2;
    e.x = clamp(e.x + e.vx * dt, e.r, WORLD.w - e.r);
    e.y = clamp(e.y + e.vy * dt, e.r, WORLD.h - e.r);
    e.angle = Math.atan2(e.vy || dy, e.vx || dx);

    if (best < e.r + 22) {
      const now = Date.now();
      if (!target.nextHurtAt || now >= target.nextHurtAt) {
        target.nextHurtAt = now + (e.finalBoss ? 1450 : e.boss ? 1100 : e.elite ? 850 : 760);
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
