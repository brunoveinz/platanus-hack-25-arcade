// ---------- Boot Phaser ----------
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0e1020',
  scene: { create, update }
};
new Phaser.Game(config);

// ---------- Estado ----------
let g, ui, keys, txtScore, txtEnergy;
let over = false;
let lastNow = 0;

const player = { x: 400, y: 300, sp: 240, ang: 0 };
let score = 0;
let energy = 0;              // Energy real (gameplay)
let visualEnergy = 0;        // Energy visual (para radio paulatino)
let gameTime = 0;
let maxEnergyUsed = 0;

// Botones arcade (edge detection)
let prevP1A = false;
let prevSTART1 = false;

// Energy
const energyOrbs = [];
let nextOrbSpawn = 2000;
const ORB_SPAWN_INTERVAL = 3000;
const ORB_VALUE = 1;
const ORB_SIZE = 6;
const ORB_COLLECT_RADIUS = 15;

// Power-up (tipo Pac-Man)
const POWER_UNLOCK_TIME = 5;     // seg: antes de esto no hay orbes de poder
const POWER_ORB_CHANCE  = 0.10;  // chance baja de power
const POWER_ORB_COLOR   = 0x66aaff;
const POWER_DURATION    = 7000;   // ms activo
const POWER_WAVE_PERIOD = 300;    // ms entre ondas (menos frecuente)
const POWER_WAVE_RADIUS = 260;    // radio máx de la onda
let powerActive = false;
let powerEndAt = 0;
let nextPowerWaveAt = 0;
const powerWaves = [];            // ondas azules visibles/letales

// Power-up de congelamiento (verde)
const FREEZE_ORB_CHANCE = 0.10;   // chance de orbe verde
const FREEZE_ORB_COLOR  = 0x44ff88;
const FREEZE_DURATION   = 5000;   // ms de congelamiento
let freezeActive = false;
let freezeEndAt = 0;

// Power-up de ralentización (naranja)
const SLOW_ORB_CHANCE   = 0.10;   // chance de orbe naranja
const SLOW_ORB_COLOR    = 0xff8833;
const SLOW_DURATION     = 6000;   // ms de ralentización
const SLOW_SPEED_MULT   = 0.4;    // velocidad reducida al 40%
let slowActive = false;
let slowEndAt = 0;

// Pulsos normales
const pulses = [];
const PULSE_SPEED = 350;
const PULSE_THICK = 4;
const PULSE_BASE_RADIUS = 80;
const PULSE_RADIUS_PER_ENERGY = 15;
const PULSE_LIFE = 400;
const ECHO_DELAY = 2000;
const ECHO_LIFETIME = 6000;
const MIN_ENERGY_TO_SHOOT = 1;

// Enemigos / ecos
const enemies = [];
const echoes = [];
let nextSpawn = 700;

// Música de fondo
let bgMusic = null;
let musicNodes = [];
let tempoSmooth = 1.0; // suavizado del tempo (evita saltos abruptos)
let powerMusic = null; // música especial para el poder

// ---------- Utils ----------
const dist = (ax,ay,bx,by)=>Math.hypot(ax-bx, ay-by);
function ringHit(x,y,r, thick, cx,cy, cr){
  const d = dist(x,y,cx,cy);
  return Math.abs(d - r) <= (thick*0.5 + cr);
}
function tone(scene,freq,dur=0.07, gain=0.08){
  if(!scene.sound||!scene.sound.context) return;
  const ctx=scene.sound.context, o=ctx.createOscillator(), gn=ctx.createGain();
  o.type='sine'; o.frequency.value=freq; o.connect(gn); gn.connect(ctx.destination);
  gn.gain.setValueAtTime(gain, ctx.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.002, ctx.currentTime+dur);
  o.start(); o.stop(ctx.currentTime+dur);
}

// ---------- Arcade Controls (mapping + helpers) ----------
const isDown = k => !!k && k.isDown;
const ARCADE = {
  // Player 1 joystick (WASD + Arrows)
  P1U:   () => isDown(keys.W) || isDown(keys.UP),
  P1D:   () => isDown(keys.S) || isDown(keys.DOWN),
  P1L:   () => isDown(keys.A) || isDown(keys.LEFT),
  P1R:   () => isDown(keys.D) || isDown(keys.RIGHT),
  // Player 1 action buttons (U/I/O/J/K/L) + SPACE como A
  P1A:   () => isDown(keys.SPACE) || isDown(keys.J) || isDown(keys.U),
  P1B:   () => isDown(keys.K) || isDown(keys.I),
  P1C:   () => isDown(keys.L) || isDown(keys.O),
  P1X:   () => isDown(keys.J),
  P1Y:   () => isDown(keys.K),
  P1Z:   () => isDown(keys.L),
  START1:() => isDown(keys.ENTER) || isDown(keys.ONE),
  // Player 2 (por si lo necesitas después)
  P2U:   () => isDown(keys.UP),
  P2D:   () => isDown(keys.DOWN),
  P2L:   () => isDown(keys.LEFT),
  P2R:   () => isDown(keys.RIGHT),
  P2A:   () => isDown(keys.F) || isDown(keys.R),
  P2B:   () => isDown(keys.G) || isDown(keys.T),
  P2C:   () => isDown(keys.H) || isDown(keys.Y),
  P2X:   () => isDown(keys.F),
  P2Y:   () => isDown(keys.G),
  P2Z:   () => isDown(keys.H),
  START2:() => false
};

// ---------- Draw Players ----------
function drawPlayerShip(g, p, now, powered){
  const c = Math.cos(p.ang), s = Math.sin(p.ang);
  const R = (px,py)=>({ x: p.x + px*c - py*s, y: p.y + px*s + py*c });

  const sz = 8.5;
  const hull = powered ? 0x66aaff : 0x88ffea;
  const outline = powered ? 0x113355 : 0x0b2a2a;

  const nose  = R(sz*2.0, 0);
  const left  = R(-sz*0.9, -sz*1.1);
  const right = R(-sz*0.9,  sz*1.1);
  const tail  = R(-sz*1.5,  0);

  g.fillStyle(hull, 1);
  g.beginPath();
  g.moveTo(nose.x, nose.y);
  g.lineTo(left.x, left.y);
  g.lineTo(tail.x, tail.y);
  g.lineTo(right.x, right.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, outline, 0.5);
  g.strokePath();

  const cab = R(sz*0.6, 0);
  g.fillStyle(0xffffff, powered ? 0.95 : 0.85);
  g.fillCircle(cab.x, cab.y, sz*0.4);

  const flick = 0.8 + 0.6 * Math.sin(now*0.02 + p.x*0.07);
  const flame = R(-sz*1.8 - sz*flick, 0);
  g.lineStyle(2, powered ? 0xaaddff : 0xffee66, 0.95);
  g.lineBetween(tail.x, tail.y, flame.x, flame.y);

  const Lp = R(0, -sz*1.05), Rp = R(0, sz*1.05);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(Lp.x, Lp.y, 1.6);
  g.fillCircle(Rp.x, Rp.y, 1.6);
}


// ---------- Manejar el toque de un enemigo ----------
function handleEnemyTouch(scene) {
  if (energy > 0) {
    activateDefensePower(scene);
    energy = 0;
    visualEnergy = 0;
    txtEnergy.setText(`Energy: 0 ⚡`);
  } else {
    gameOver(scene);
  }
}

// ---------- Activar el poder de defensa ----------
function activateDefensePower(scene) {
  tone(scene, 880, 0.15, 0.2);
  const now = performance.now();
  const energyUsed = energy;
  tryPulse(scene, now);
  energy = 0;
  visualEnergy = 0;

  const explosionRadius = 150;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (dist(player.x, player.y, enemy.x, enemy.y) < explosionRadius) {
      makeEcho(scene, enemy.x, enemy.y);
      enemies.splice(i, 1);
      score += 10;
      txtScore.setText('Score: ' + score);
    }
  }
}

// ---------- Música "electro" pero con subida MUY suave ----------
function getTempoTarget(){
  const byScore = Math.min(0.8, score * 0.004);
  const byTime  = Math.min(0.20, gameTime * 0.0015);
  return 1.0 + byScore + byTime; // ~1.0–2.0
}
function startBgMusic(scene){
  if(!scene.sound || !scene.sound.context) return;
  stopBgMusic();
  const ctx = scene.sound.context;
  musicNodes = [];

  const target = Math.min(1.7, getTempoTarget());
  tempoSmooth += (target - tempoSmooth) * 0.12;
  const spb = 0.5 / tempoSmooth;

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  musicNodes.push({ g: master });

  function envGain(target, t0, a=0.002, d=0.15, sus=0.0009){
    target.gain.setValueAtTime(0.0001, t0);
    target.gain.exponentialRampToValueAtTime(0.35, t0 + a);
    target.gain.exponentialRampToValueAtTime(Math.max(sus,0.0009), t0 + d);
  }

  // KICK
  for(let i=0;i<8;i++){
    const t = ctx.currentTime + i*spb;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(125, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12/tempoSmooth);
    envGain(g, t, 0.001, 0.10/tempoSmooth, 0.0012);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.18/tempoSmooth);
    musicNodes.push({o,g});
  }

  // HI-HAT
  for(let i=0;i<8;i++){
    const t = ctx.currentTime + i*spb + spb*0.5;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 5000;
    envGain(g, t, 0.0008, 0.04/tempoSmooth, 0.001);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.06/tempoSmooth);
    musicNodes.push({o,g});
  }

  // ARPEGIO
  const base = 165;
  const scale = [1, 6/5, 4/3, 3/2, 8/5, 9/5, 2];
  const pattern = [0,2,4,1,3,5,4,2, 0,2,3,1,4,5,6,4];
  const noteDur = spb * 0.9;
  for(let i=0;i<pattern.length;i++){
    const t = ctx.currentTime + i*(spb*0.5);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = (i%4===0) ? 'square' : 'triangle';
    o.frequency.value = base * scale[ pattern[i] % scale.length ];
    envGain(g, t, 0.006, noteDur*0.7, 0.0012);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + noteDur);
    musicNodes.push({o,g});
  }

  const loopLen = spb*8;
  bgMusic = scene.time.addEvent({
    delay: loopLen*1000,
    callback: () => startBgMusic(scene),
    loop: false
  });
}
function stopBgMusic(){
  if(bgMusic) bgMusic.remove();
  musicNodes.forEach(n => {
    try { n.o && n.o.stop(0); } catch(e){}
    try { n.g && n.g.disconnect(); } catch(e){}
  });
  musicNodes = [];
}

// ---------- Música de PODER (estilo Mario Star) ----------
function startPowerMusic(scene){
  if(!scene.sound || !scene.sound.context) return;
  stopPowerMusic();
  const ctx = scene.sound.context;
  musicNodes = [];

  const spb = 0.15; // rápido
  const master = ctx.createGain();
  master.gain.value = 0.28;
  master.connect(ctx.destination);
  musicNodes.push({ g: master });

  function envGain(target, t0, a=0.001, d=0.08, sus=0.0008){
    target.gain.setValueAtTime(0.0001, t0);
    target.gain.exponentialRampToValueAtTime(0.4, t0 + a);
    target.gain.exponentialRampToValueAtTime(Math.max(sus,0.0008), t0 + d);
  }

  const baseFreq = 440;
  const melody = [1,1.25,1.5,1.875,2,2.25,2.5,2.25, 2,1.875,1.75,1.5,1.875,2.25,2,1.5];
  for(let i=0; i<melody.length; i++){
    const t = ctx.currentTime + i*spb;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = baseFreq * melody[i];
    envGain(g, t, 0.001, spb*0.7, 0.001);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + spb*0.8);
    musicNodes.push({o,g});
  }

  for(let i=0; i<16; i++){
    const t = ctx.currentTime + i*spb;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 110;
    envGain(g, t, 0.001, 0.05, 0.001);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.06);
    musicNodes.push({o,g});
  }

  const loopLen = spb*16;
  powerMusic = scene.time.addEvent({
    delay: loopLen*1000,
    callback: () => { if(powerActive) startPowerMusic(scene); },
    loop: false
  });
}
function stopPowerMusic(){
  if(powerMusic) powerMusic.remove();
  musicNodes.forEach(n => {
    try { n.o && n.o.stop(0); } catch(e){}
    try { n.g && n.g.disconnect(); } catch(e){}
  });
  musicNodes = [];
}

// ---------- Scene ----------
function create(){
  g  = this.add.graphics();
  ui = this.add.graphics();

  // === Futuristic Title (Neon Glow) ===
  const titleText = 'NEBULA RUNNER';
  const titleY = 26;

  const tGlow1 = this.add.text(400, titleY, titleText, {
    fontFamily: 'Arial Black, Arial',
    fontSize: 26,
    color: '#ffffff',
    stroke: '#1a243a',
    strokeThickness: 8
  }).setOrigin(0.5).setDepth(1).setAlpha(0.22).setScale(1.06);

  const tGlow2 = this.add.text(400, titleY, titleText, {
    fontFamily: 'Arial Black, Arial',
    fontSize: 26,
    color: '#ffffff',
    stroke: '#1a243a',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(1).setAlpha(0.45).setScale(1.02);

  const tMain = this.add.text(400, titleY, titleText, {
    fontFamily: 'Arial Black, Arial',
    fontSize: 26,
    color: '#9ccfff',
    stroke: '#1a243a',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(2);

  this.tweens.add({
    targets: [tGlow1, tGlow2, tMain],
    scale: { from: 1.0, to: 1.015 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut'
  });

  // === Minimal HUD hint (arcade-friendly) ===
  const hint = this.add.text(400, 52, 'WASD/Arrows: Move  •  SPACE or (U/J) Pulse  •  ENTER: Start/Restart', {
    fontFamily: 'Arial',
    fontSize: 14,
    color: '#8fe6ff'
  }).setOrigin(0.5).setDepth(2).setAlpha(0.9);

  this.tweens.add({
    targets: hint,
    alpha: { from: 0.9, to: 0.6 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut'
  });

  // === HUD ===
  txtScore = this.add.text(16, 16, 'Score: 0', {
    fontFamily:'Arial', fontSize:18, color:'#7ff'
  });
  txtEnergy = this.add.text(16, 40, 'Energy: 0 ⚡', {
    fontFamily:'Arial', fontSize:18, color:'#ffdd00'
  });

  // === Inputs ===
  keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE');
  const extra = this.input.keyboard.addKeys('U,I,O,J,K,L,R,T,Y,F,G,H,ENTER,ONE');
  keys = { ...keys, ...extra };

  // === Música de fondo ===
  this.input.keyboard.once('keydown', () => {
    if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
      this.sound.context.resume().then(() => startBgMusic(this));
    } else {
      startBgMusic(this);
    }
  });

  // === Setup inicial ===
  for(let i=0;i<3;i++) spawnEnemy();
  spawnEnergyOrb();
  tone(this, 440, 0.09);
}

function restart(scene){
  over=false; score=0; energy=0; visualEnergy=0; gameTime=0; maxEnergyUsed=0;
  powerActive=false; powerEndAt=0; nextPowerWaveAt=0;
  freezeActive=false; freezeEndAt=0;
  slowActive=false; slowEndAt=0;
  pulses.length=0; powerWaves.length=0;
  enemies.length=0; echoes.length=0; energyOrbs.length=0;
  nextSpawn=600; nextOrbSpawn=2000;
  tempoSmooth=1.0;
  prevP1A=false; prevSTART1=false;

  txtScore.setText('Score: 0');
  txtEnergy.setText('Energy: 0 ⚡');
  player.x=400; player.y=300;
  g.clear(); ui.clear();

  // limpiar overlays de game over
  const toDestroy = [];
  scene.children.list.forEach(child => { if(child.depth >= 9) toDestroy.push(child); });
  toDestroy.forEach(child => { if(child && child.destroy) child.destroy(); });

  for(let i=0;i<3;i++) spawnEnemy();
  spawnEnergyOrb();
  tone(scene, 440, 0.09);
  startBgMusic(scene);
}

function spawnEnemy(){
  const edge = Math.random()<0.5?'x':'y';
  let x = Phaser.Math.Between(0,800), y = Phaser.Math.Between(0,600);
  if(edge==='x'){ x = Math.random()<0.5 ? -20 : 820; } else { y = Math.random()<0.5 ? -20 : 620; }
  const speedBoost = Math.floor(gameTime / 10) * 10;
  const sp = Phaser.Math.Between(90 + speedBoost, 130 + speedBoost);
  enemies.push({ x, y, r:5, vx:0, vy:0, sp });
}

function spawnEnergyOrb(){
  let x, y, attempts = 0;
  do {
    x = Phaser.Math.Between(80, 720);
    y = Phaser.Math.Between(100, 500);
    attempts++;
  } while (dist(x, y, player.x, player.y) < 150 && attempts < 10);

  const canPower = (gameTime >= POWER_UNLOCK_TIME);
  let orbType = 'normal';
  if(canPower){
    const roll = Math.random();
    if(roll < POWER_ORB_CHANCE) orbType = 'power';
    else if(roll < POWER_ORB_CHANCE + FREEZE_ORB_CHANCE) orbType = 'freeze';
    else if(roll < POWER_ORB_CHANCE + FREEZE_ORB_CHANCE + SLOW_ORB_CHANCE) orbType = 'slow';
  }

  energyOrbs.push({ 
    x, y,
    type: orbType,
    value: (orbType === 'normal') ? ORB_VALUE : 0, 
    createdAt: performance.now() 
  });
}

function makeEcho(scene,x,y){
  echoes.push({ x, y, createdAt: performance.now(), usedCount: 0 });
  const base = 310, step = [1, 5/4, 3/2, 2, 5/3][echoes.length % 5];
  tone(scene, base*step, 0.11, 0.08);
}

// ---------- Input ----------
function tryPulse(scene, now){
  if(energy < MIN_ENERGY_TO_SHOOT) {
    tone(scene, 150, 0.1, 0.05);
    return false;
  }
  const maxRadius = PULSE_BASE_RADIUS + (energy * PULSE_RADIUS_PER_ENERGY);
  maxEnergyUsed = Math.max(maxEnergyUsed, energy);
  const energyUsed = energy;

  energy = 0;
  visualEnergy = 0;
  txtEnergy.setText('Energy: 0 ⚡');

  pulses.push({ t: now, x: player.x, y: player.y, maxRadius });

  const pitchBoost = Math.min(energyUsed * 50, 400);
  tone(scene, 660 + pitchBoost, 0.06, 0.07);

  if(scene.cameras && scene.cameras.main){
    scene.cameras.main.shake(80, 0.002);
    scene.cameras.main.flash(60, 80, 160, 160);
  }
  if(scene.sound && scene.sound.context){
    const ctx = scene.sound.context;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(90, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0009, ctx.currentTime + 0.09);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.12);
  }
  return true;
}

// ---------- Electric Field Visual ----------
function drawElectricField(g, x, y, baseR, energyVal, nowMs, colMain=0xffdd00, colAccent=0xfff299){
  const t = nowMs * 0.004;
  const segs = 42;
  const jitter = 4 + Math.min(16, energyVal * 1.2);
  const thick = 2 + Math.min(3, energyVal * 0.2);

  g.lineStyle(thick, colMain, 0.65);
  g.beginPath();
  for(let i=0;i<=segs;i++){
    const a = (i/segs)*Math.PI*2;
    const j = Math.sin(a*3 + t*1.7)*0.6 + Math.sin(a*7 - t*1.1)*0.4 + Math.sin(a*11 + t*0.6)*0.25;
    const r = baseR + j*jitter;
    const px = x + Math.cos(a)*r;
    const py = y + Math.sin(a)*r;
    if(i===0) g.moveTo(px,py); else g.lineTo(px,py);
  }
  g.strokePath();

  const arcCount = 6 + Math.min(10, Math.floor(energyVal*0.6));
  for(let k=0;k<arcCount;k++){
    const seed = (k*9283 + Math.floor(t*60))%9999;
    const a0 = ((seed%1000)/1000)*Math.PI*2;
    const len = 10 + (seed%17);
    const steps = 4 + (seed%3);
    let ra = a0;
    let rr = baseR + jitter*0.5;
    g.lineStyle(1.5, colAccent, 0.9);
    g.beginPath();
    for(let s=0;s<=steps;s++){
      const aj = ra + (Math.random()-0.5)*0.28;
      const rj = rr + (Math.random()-0.5)*8;
      const px = x + Math.cos(aj)*rj;
      const py = y + Math.sin(aj)*rj;
      if(s===0) g.moveTo(px,py); else g.lineTo(px,py);
      ra += (len/baseR);
      rr += (Math.random()-0.5)*4;
    }
    g.strokePath();
  }

  const sparkCount = Math.min(18, 4 + Math.floor(energyVal*0.5));
  g.lineStyle(1, 0xffffcc, 0.9);
  for(let s=0;s<sparkCount;s++){
    const a = ((s*137 + Math.floor(t*120)) % 360) * (Math.PI/180);
    const r1 = baseR + jitter + 4;
    const r2 = r1 + 6 + (s%4);
    const x1 = x + Math.cos(a)*r1, y1 = y + Math.sin(a)*r1;
    const x2 = x + Math.cos(a)*r2, y2 = y + Math.sin(a)*r2;
    g.lineBetween(x1,y1,x2,y2);
  }

  g.lineStyle(1, 0xffff77, 0.25 + 0.25*Math.sin(t*3));
  g.strokeCircle(x, y, baseR);
}

// ---------- Update ----------
function update(_t, dt){
  const scene = this;
  const now = performance.now();
  const frameMs = Math.max(1, now - lastNow);
  lastNow = now;

  // Edge-detect START1 para restart en game over (ENTER/1)
  const start1 = ARCADE.START1();
  if (over) {
    if (Phaser.Input.Keyboard.JustDown(keys.SPACE) || (start1 && !prevSTART1)) {
      restart(scene);
    }
    prevSTART1 = start1;
    return;
  }
  prevSTART1 = start1;

  const s = dt/1000;
  gameTime += s;

  // Suavizado del radio (Energy visual)
  const lerp = Math.min(1, dt / 220);
  visualEnergy += (energy - visualEnergy) * lerp;
  if (energy <= 0 && visualEnergy < 0.5) visualEnergy = 0;

  // Movimiento + orientación de la nave (arcade-friendly)
  const L = ARCADE.P1L(), R = ARCADE.P1R(), U = ARCADE.P1U(), D = ARCADE.P1D();
  let ax=(L?-1:0)+(R?1:0), ay=(U?-1:0)+(D?1:0);
  if(ax||ay){
    const len=Math.hypot(ax,ay)||1;
    ax/=len; ay/=len;
    const targetAng = Math.atan2(ay, ax);
    player.ang = Phaser.Math.Angle.RotateTo(player.ang || 0, targetAng, 6 * s);
  }
  player.x = Phaser.Math.Clamp(player.x + ax*player.sp*s, 10, 790);
  player.y = Phaser.Math.Clamp(player.y + ay*player.sp*s, 10, 590);

  // Fin de power/freezes/slows
  if(powerActive && now >= powerEndAt){
    powerActive = false;
    powerWaves.length = 0;
    stopPowerMusic();
    startBgMusic(scene);
  }
  if(freezeActive && now >= freezeEndAt) freezeActive = false;
  if(slowActive && now >= slowEndAt) slowActive = false;

  // Recolectar orbes
  for(let i = energyOrbs.length - 1; i >= 0; i--){
    const orb = energyOrbs[i];
    if(dist(player.x, player.y, orb.x, orb.y) < ORB_COLLECT_RADIUS){
      if(orb.type === 'power'){
        powerActive = true;
        powerEndAt = now + POWER_DURATION;
        nextPowerWaveAt = now;
        stopBgMusic(); startPowerMusic(scene);
        if(scene.cameras && scene.cameras.main){
          scene.cameras.main.shake(300, 0.010);
          scene.cameras.main.flash(250, 120, 180, 255);
        }
        if(scene.sound && scene.sound.context){
          const ctx = scene.sound.context;
          for(let t=0; t<4; t++){
            const startTime = ctx.currentTime + t*0.08;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(220 * (1 + t*0.5), startTime);
            o.frequency.exponentialRampToValueAtTime(880 * (1 + t*0.3), startTime + 0.15);
            g.gain.setValueAtTime(0.0001, startTime);
            g.gain.exponentialRampToValueAtTime(0.15, startTime + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
            o.connect(g); g.connect(ctx.destination);
            o.start(startTime); o.stop(startTime + 0.2);
          }
        }
      } else if(orb.type === 'freeze'){
        freezeActive = true;
        freezeEndAt = now + FREEZE_DURATION;
        if(scene.cameras && scene.cameras.main){
          scene.cameras.main.shake(150, 0.004);
          scene.cameras.main.flash(180, 100, 255, 200);
        }
        tone(scene, 1800, 0.10, 0.09);
        tone(scene, 2200, 0.12, 0.08);
        tone(scene, 1400, 0.14, 0.07);
      } else if(orb.type === 'slow'){
        slowActive = true;
        slowEndAt = now + SLOW_DURATION;
        if(scene.cameras && scene.cameras.main){
          scene.cameras.main.shake(120, 0.003);
          scene.cameras.main.flash(160, 255, 150, 80);
        }
        tone(scene, 180, 0.16, 0.10);
        tone(scene, 220, 0.18, 0.09);
        tone(scene, 150, 0.20, 0.08);
      } else {
        energy += orb.value;
        txtEnergy.setText(`Energy: ${energy} ⚡`);
        tone(scene, 1200, 0.08, 0.1);
        tone(scene, 1600, 0.08, 0.08);
      }
      energyOrbs.splice(i, 1);
    }
  }

  // Spawn de Energy
  nextOrbSpawn -= dt;
  if(nextOrbSpawn <= 0){
    spawnEnergyOrb();
    nextOrbSpawn = ORB_SPAWN_INTERVAL + Phaser.Math.Between(-500, 500);
  }

  // Disparo: SPACE (JustDown) o P1A (edge)
  const p1a = ARCADE.P1A();
  if(Phaser.Input.Keyboard.JustDown(keys.SPACE) || (p1a && !prevP1A)){
    tryPulse(scene, now);
  }
  prevP1A = p1a;

  // Enemigos
  for(const e of enemies){
    if(!freezeActive){
      let dx=player.x-e.x, dy=player.y-e.y, len=Math.hypot(dx,dy)||1;
      dx/=len; dy/=len;
      const flee = powerActive;
      const dirx = flee ? -dx : dx;
      const diry = flee ? -dy : dy;

      let speedMul = flee ? 1.3 : 1.0;
      if(slowActive) speedMul *= SLOW_SPEED_MULT;

      e.vx = dirx * e.sp * speedMul; 
      e.vy = diry * e.sp * speedMul;
      e.x += e.vx * s; 
      e.y += e.vy * s;

      e.x = Phaser.Math.Clamp(e.x, 15, 785);
      e.y = Phaser.Math.Clamp(e.y, 15, 585);
    } else {
      e.vx = 0; e.vy = 0;
    }
  }

  // Spawns de enemigos
  nextSpawn -= dt;
  if(nextSpawn <= 0){
    spawnEnemy();
    const spawnInterval = Math.max(300, 1100 - (gameTime * 8));
    nextSpawn = Phaser.Math.Between(spawnInterval * 0.7, spawnInterval);
  }

  // Limpiar pulsos/ondas viejos
  for(let i = pulses.length - 1; i >= 0; i--){
    if(now - pulses[i].t > PULSE_LIFE) pulses.splice(i, 1);
  }
  for(let i = powerWaves.length - 1; i >= 0; i--){
    if(now - powerWaves[i].t > PULSE_LIFE) powerWaves.splice(i, 1);
  }

  // Limpiar ecos viejos
  for(let i = echoes.length - 1; i >= 0; i--){
    if(now - echoes[i].createdAt > ECHO_LIFETIME) {
      echoes.splice(i, 1);
      tone(scene, 200, 0.08, 0.04);
    }
  }

  // Ondas azules automáticas en power
  if(powerActive && now >= nextPowerWaveAt){
    powerWaves.push({
      t: now, x: player.x, y: player.y,
      maxRadius: PULSE_BASE_RADIUS + POWER_WAVE_RADIUS
    });
    nextPowerWaveAt = now + POWER_WAVE_PERIOD;
  }

  // Daño
  handlePulseDamage(scene, now, pulses, (evt) => ({ x: evt.x, y: evt.y, t: evt.t }));
  handlePulseDamage(scene, now, powerWaves, (ev) => ev);
  for(let i = echoes.length - 1; i >= 0; i--){
    const eco = echoes[i];
    if(eco.usedCount >= 3) { echoes.splice(i, 1); continue; }
    handlePulseDamage(scene, now, pulses, (evt) => ({ 
      x: eco.x, y: eco.y, t: evt.t + ECHO_DELAY 
    }), eco);
  }

  // Tonos de ecos
  const onsetWin = Math.max(1, now - lastNow) + 2;
  for (let i = 0; i < echoes.length; i++) {
    const eco = echoes[i];
    const ratios = [1, 5/4, 3/2, 2];
    const ratio = ratios[i % ratios.length];
    for (let j = 0; j < pulses.length; j++) {
      const mt = pulses[j].t + ECHO_DELAY;
      const age = now - mt;
      if (age >= 0 && age < onsetWin) tone(scene, 330 * ratio, 0.05, 0.05);
    }
  }

  render(scene, now);

  // Colisión enemigo-jugador
  for (const e of enemies) {
    if (dist(e.x, e.y, player.x, player.y) < (e.r + 5)) {
      handleEnemyTouch(scene);
      break;
    }
  }
}



// ---------- Daño ----------
function handlePulseDamage(scene, now, eventList, mapEvent, sourceEcho = null){
  for(const ev of eventList){
    const m = mapEvent(ev);
    const age = now - m.t;
    if(age < 0 || age > PULSE_LIFE) continue;

    let maxRadius = ev.maxRadius != null ? ev.maxRadius : PULSE_BASE_RADIUS;
    const radius = Math.min((age/1000) * PULSE_SPEED, maxRadius);
    
    const isBlueWave = eventList === powerWaves;

    for(let i=enemies.length-1; i>=0; i--){
      const en = enemies[i];
      if(ringHit(m.x, m.y, radius, PULSE_THICK, en.x, en.y, en.r)){
        if(isBlueWave && scene.add && scene.add.graphics){
          const lightning = scene.add.graphics();
          lightning.lineStyle(2, 0xaaddff, 1);
          let lx = m.x, ly = m.y;
          const steps = 5;
          for(let s=0; s<steps; s++){
            const t = (s+1)/steps;
            const tx = m.x + (en.x - m.x) * t + (Math.random()-0.5) * 20;
            const ty = m.y + (en.y - m.y) * t + (Math.random()-0.5) * 20;
            lightning.lineBetween(lx, ly, tx, ty);
            lx = tx; ly = ty;
          }
          lightning.lineBetween(lx, ly, en.x, en.y);
          scene.time.delayedCall(100, () => { if(lightning && lightning.destroy) lightning.destroy(); });
          if(scene.sound && scene.sound.context){
            const ctx = scene.sound.context;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'square';
            o.frequency.setValueAtTime(3000, ctx.currentTime);
            o.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.04);
            g.gain.setValueAtTime(0.0001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            o.connect(g); g.connect(ctx.destination);
            o.start(); o.stop(ctx.currentTime + 0.06);
          }
        }
        makeEcho(scene, en.x, en.y);
        enemies.splice(i,1);
        score += 10; 
        txtScore.setText('Score: '+score);
        if(sourceEcho) sourceEcho.usedCount++;
        break;
      }
    }
  }
}

// 
function drawEnemyShip(g, e, now, mode){
  const mv = Math.abs(e.vx)+Math.abs(e.vy);
  const ax = mv>0.01 ? e.vx : (player.x - e.x);
  const ay = mv>0.01 ? e.vy : (player.y - e.y);
  const ang = Math.atan2(ay, ax), c = Math.cos(ang), s = Math.sin(ang);
  const R = (px,py)=>({ x: e.x + px*c - py*s, y: e.y + px*s + py*c });
  const sz = e.r + 2;

  let hull = 0xff5577;                   // normal
  if(mode==='freeze') hull = 0x99ddff;   // congelado
  else if(mode==='slow') hull = 0xffaa55;// ralentizado
  else if(mode==='panic') hull = 0xff88aa;// pánico

  const nose  = R(sz*2.0, 0);
  const left  = R(-sz*0.8, -sz*1.0);
  const right = R(-sz*0.8,  sz*1.0);
  const tail  = R(-sz*1.4,  0);

  g.fillStyle(hull, 1);
  g.beginPath();
  g.moveTo(nose.x, nose.y);
  g.lineTo(left.x, left.y);
  g.lineTo(tail.x, tail.y);
  g.lineTo(right.x, right.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, 0x000000, 0.35);
  g.strokePath();

  const cab = R(sz*0.6, 0);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cab.x, cab.y, sz*0.35);

  const flick = 0.8 + 0.6 * Math.sin(now*0.02 + e.x*0.1);
  const flame = R(-sz*1.6 - sz*flick, 0);
  g.lineStyle(2, 0xffee66, 0.9);
  g.lineBetween(tail.x, tail.y, flame.x, flame.y);

  const Lp = R(-sz*0.2, -sz*1.05), Rp = R(-sz*0.2, sz*1.05);
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(Lp.x, Lp.y, 1.5);
  g.fillCircle(Rp.x, Rp.y, 1.5);
}

// ---------- Render ----------
function render(scene, now){
  g.clear();
  g.lineStyle(1, 0x172049, 0.75);
  for (let i=0;i<=800;i+=40) g.lineBetween(i,0,i,600);
  for (let j=0;j<=600;j+=40) g.lineBetween(0,j,800,j);

  for (const orb of energyOrbs){
    const age = (now - orb.createdAt) / 1000;
    const pulse = Math.sin(age * 8) * 0.3 + 0.7;
    const glow  = Math.sin(age * 4) * 2 + 3;

    let col, alpha;
    if (orb.type==='power'){ col=POWER_ORB_COLOR;  alpha=0.2; }
    else if (orb.type==='freeze'){ col=FREEZE_ORB_COLOR; alpha=0.2; }
    else if (orb.type==='slow'){ col=SLOW_ORB_COLOR; alpha=0.2; }
    else { col=0xffff00; alpha=0.15; }

    g.fillStyle(col, alpha);
    g.fillCircle(orb.x, orb.y, ORB_SIZE + glow);
    g.fillStyle(col, pulse);
    g.fillCircle(orb.x, orb.y, ORB_SIZE);
    g.lineStyle(2, col, pulse);
    const rayLen = 8 + Math.sin(age * 6) * 3;
    for (let a=0; a<Math.PI*2; a+=Math.PI/2){
      const x1 = orb.x + Math.cos(a) * ORB_SIZE;
      const y1 = orb.y + Math.sin(a) * ORB_SIZE;
      const x2 = orb.x + Math.cos(a) * rayLen;
      const y2 = orb.y + Math.sin(a) * rayLen;
      g.lineBetween(x1,y1,x2,y2);
    }
  }

  if (powerActive){
    const auraPhase = Math.sin(now * 0.008) * 0.3 + 0.7;
    const auraSize  = 25 + Math.sin(now * 0.012) * 8;
    g.fillStyle(0x66aaff, 0.15 * auraPhase);
    g.fillCircle(player.x, player.y, auraSize);
    g.fillStyle(0x88ddff, 0.25 * auraPhase);
    g.fillCircle(player.x, player.y, auraSize * 0.6);
    const rotSpeed = now * 0.006;
    for (let i=0;i<6;i++){
      const ang = rotSpeed + (i * Math.PI * 2 / 6);
      const r   = 18 + Math.sin(now * 0.01 + i) * 4;
      g.fillStyle(0xccffff, 0.8);
      g.fillCircle(player.x + Math.cos(ang)*r, player.y + Math.sin(ang)*r, 2.5);
    }
  }

  drawPlayerShip(g, player, now, powerActive);

  if (!powerActive){
    const eVis = Math.max(0, visualEnergy);
    if (eVis > 0){
      const visualRadius = PULSE_BASE_RADIUS + (eVis * PULSE_RADIUS_PER_ENERGY);
      drawElectricField(g, player.x, player.y, visualRadius, eVis, now, 0xffdd00, 0xfff299);
    }
  }

  for (const ev of pulses){
    const age = now - ev.t;
    if (age < 0 || age > PULSE_LIFE) continue;
    const radius = Math.min((age/1000) * PULSE_SPEED, ev.maxRadius);
    const alpha  = 1 - (age / PULSE_LIFE);
    g.lineStyle(PULSE_THICK, 0x60ffe4, alpha * 0.8);
    g.strokeCircle(ev.x, ev.y, radius);
  }

  if (powerActive){
    for (const ev of powerWaves){
      const age = now - ev.t;
      if (age < 0 || age > PULSE_LIFE) continue;
      const radius = Math.min((age/1000) * PULSE_SPEED, ev.maxRadius);
      const alpha  = 1 - (age / PULSE_LIFE);
      g.lineStyle(PULSE_THICK+1, 0x66aaff, alpha * 0.95);
      g.strokeCircle(ev.x, ev.y, radius);
    }
  }

  for (const eco of echoes){
    const lifeRatio = 1 - ((now - eco.createdAt) / ECHO_LIFETIME);
    const a = Math.max(0.3, lifeRatio);
    g.fillStyle(0xffe066, a);
    g.fillCircle(eco.x, eco.y, 3.5);

    const usesLeft = 3 - eco.usedCount;
    for (let u=0; u<usesLeft; u++) g.fillCircle(eco.x - 10 + u*10, eco.y - 12, 2);

    for (const ev of pulses){
      const age = now - (ev.t + ECHO_DELAY);
      if (age < 0 || age > PULSE_LIFE) continue;
      const radius = Math.min((age/1000) * PULSE_SPEED, ev.maxRadius);
      const pa = 1 - (age / PULSE_LIFE);
      g.lineStyle(PULSE_THICK, 0xffe066, pa * a * 0.7);
      g.strokeCircle(eco.x, eco.y, radius);
    }
  }

  for (const e of enemies){
    const mode = freezeActive ? 'freeze'
              : powerActive  ? 'panic'
              : slowActive   ? 'slow'
              : 'normal';
    drawEnemyShip(g, e, now, mode);
  }

  ui.clear();
  const difficulty = Math.floor(gameTime / 10);
  if (difficulty > 0){
    const barWidth = Math.min(400, difficulty * 20);
    ui.fillStyle(0xff3355, 0.2 + (difficulty * 0.05));
    ui.fillRect(200, 580, barWidth, 8);
  }

  if (powerActive){
    const remain = Math.max(0, powerEndAt - now);
    const w = Phaser.Math.Linear(0, 200, remain / POWER_DURATION);
    ui.fillStyle(0x66aaff, 0.7);
    ui.fillRect(580, 16, w, 6);
  }
  if (freezeActive){
    const remain = Math.max(0, freezeEndAt - now);
    const w = Phaser.Math.Linear(0, 200, remain / FREEZE_DURATION);
    ui.fillStyle(0x44ff88, 0.7);
    ui.fillRect(580, 26, w, 6);
  }

  txtScore.setText('Score: ' + score);
  txtEnergy.setText(`Energy: ${energy} ⚡`);
}

// ---------- Game Over ----------
function gameOver(scene){
  over = true;
  stopBgMusic();
  stopPowerMusic();

  if (scene.cameras && scene.cameras.main) {
    scene.cameras.main.flash(200, 255, 60, 90);
    scene.cameras.main.shake(220, 0.004);
  }

  const overlay = scene.add.graphics().setDepth(9);
  overlay.fillStyle(0x000813, 0.86);
  overlay.fillRect(0, 0, 800, 600);

  const vignette = scene.add.graphics().setDepth(9);
  for (let r = 380; r >= 80; r -= 40) {
    const a = Phaser.Math.Linear(0.02, 0.18, (380 - r) / 300);
    vignette.lineStyle(40, 0x000000, a);
    vignette.strokeCircle(400, 300, r);
  }

  const scan = scene.add.graphics().setDepth(9).setAlpha(0.12);
  scan.lineStyle(1, 0x00c2ff, 0.10);
  for (let y = 0; y <= 600; y += 4) scan.lineBetween(0, y, 800, y);
  scene.tweens.add({
    targets: scan, alpha: { from: 0.08, to: 0.18 },
    duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut'
  });

  const panel = scene.add.graphics().setDepth(10);
  const px = 140, py = 150, pw = 520, ph = 320;
  panel.fillStyle(0x0b1426, 0.94);
  panel.fillRoundedRect(px, py, pw, ph, 18);
  panel.lineStyle(2, 0x1d3b67, 1).strokeRoundedRect(px, py, pw, ph, 18);
  panel.lineStyle(1, 0x58c3ff, 0.8).strokeRoundedRect(px+6, py+6, pw-12, ph-12, 14);

  const neonText = (x, y, text, cfg = {}) => {
    const { size=68, color='#ff5a7a', stroke='#2a0f1f', thick=6 } = cfg;
    const glow1 = scene.add.text(x, y, text, {
      fontFamily: 'Arial Black, Arial', fontSize: size, color: '#ffffff',
      stroke, strokeThickness: thick + 6
    }).setOrigin(0.5).setDepth(11).setAlpha(0.25).setScale(1.06);
    const glow2 = scene.add.text(x, y, text, {
      fontFamily: 'Arial Black, Arial', fontSize: size, color: '#ffffff',
      stroke, strokeThickness: thick + 2
    }).setOrigin(0.5).setDepth(11).setAlpha(0.45).setScale(1.02);
    const main = scene.add.text(x, y, text, {
      fontFamily: 'Arial Black, Arial', fontSize: size, color,
      stroke, strokeThickness: thick
    }).setOrigin(0.5).setDepth(12);
    [glow1, glow2, main].forEach(t => t.setShadow(0, 6, '#000000', 8, true, true));
    scene.tweens.add({
      targets: [glow1, glow2, main],
      scale: { from: 1.0, to: 1.015 }, duration: 1200,
      yoyo: true, repeat: -1, ease: 'sine.inOut'
    });
  };

  neonText(400, 190, 'GAME OVER', { size: 68, color:'#ff5a7a', stroke:'#2a0f1f', thick:6 });

  const sub = scene.add.text(400, 230, 'NEBULA RUNNER', {
    fontFamily: 'Arial', fontSize: 18, color: '#9ccfff'
  }).setOrigin(0.5).setDepth(11);
  scene.tweens.add({ targets: sub, alpha: {from:0.7, to:1}, duration: 1200, yoyo:true, repeat:-1 });

  const baseX = 220, valueX = 580;
  const rows = [
    { icon: '🚀', label: 'TOTAL SCORE',   value: String(score),              color: '#ffe066' },
    { icon: '⏱️', label: 'SURVIVAL TIME', value: `${Math.floor(gameTime)}s`, color: '#ffe066' },
  ];
  let y = 280;
  const gap = 64;
  rows.forEach(row => {
    const l = scene.add.text(baseX, y, `${row.icon} ${row.label}`, {
      fontFamily: 'Arial', fontSize: 20, color: '#aee3ff'
    }).setOrigin(0,0.5).setDepth(11);
    const v = scene.add.text(valueX, y, row.value, {
      fontFamily: 'Arial Black, Arial', fontSize: 22, color: row.color
    }).setOrigin(1,0.5).setDepth(11);
    const sep = scene.add.graphics().setDepth(10);
    sep.lineStyle(1, 0x1d3b67, 0.7).lineBetween(baseX, y+22, valueX, y+22);
    y += gap;
  });

  const bx = 400, by = 460, bw = 360, bh = 42;
  const btn = scene.add.graphics().setDepth(11);
  btn.fillStyle(0x0f2036, 0.95).fillRoundedRect(bx - bw/2, by - bh/2, bw, bh, 14);
  btn.lineStyle(2, 0x3a83ff, 0.95).strokeRoundedRect(bx - bw/2, by - bh/2, bw, bh, 14);
  btn.lineStyle(1, 0x8ad0ff, 0.7).strokeRoundedRect(bx - bw/2 + 4, by - bh/2 + 4, bw - 8, bh - 8, 12);
  const btnTxt = scene.add.text(bx, by, 'Press SPACE / ENTER to RESTART', {
    fontFamily: 'Arial', fontSize: 20, color: '#cfeaff'
  }).setOrigin(0.5).setDepth(12);
  scene.tweens.add({
    targets: [btn, btnTxt],
    alpha: { from: 0.95, to: 0.4 },
    duration: 650, yoyo: true, repeat: -1, ease: 'sine.inOut'
  });

  tone(scene, 220, 0.22, 0.1);
  tone(scene, 155, 0.18, 0.08);
}
