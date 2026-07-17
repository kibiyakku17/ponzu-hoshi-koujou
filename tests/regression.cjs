const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, 'index.html の埋め込みスクリプトが見つからない');
const source = scriptMatch[1].replace(/\nboot\(\);\s*$/, '\n');

const elements = new Map();
const canvasContext = new Proxy({
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
}, {
  get(target, key) { return key in target ? target[key] : () => {}; },
  set(target, key, value) { target[key] = value; return true; },
});

function makeElement(id = '') {
  const element = {
    id,
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    width: 1280,
    height: 720,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    focus() {},
    select() {},
    setSelectionRange() {},
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; },
    getContext() { return canvasContext; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
  };
  return new Proxy(element, {
    get(target, key) { return key in target ? target[key] : undefined; },
    set(target, key, value) { target[key] = value; return true; },
  });
}

const storage = new Map();
let failStorageWrites = false;
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) {
    if (failStorageWrites) throw new Error('QuotaExceededError');
    storage.set(key, String(value));
  },
  removeItem(key) {
    if (failStorageWrites) throw new Error('StorageDisabled');
    storage.delete(key);
  },
};

const documentStub = {
  hidden: false,
  body: makeElement('body'),
  fonts: { ready: Promise.resolve() },
  addEventListener() {},
  removeEventListener() {},
  execCommand() { return false; },
  createElement(tag) { return makeElement(tag); },
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  },
  querySelector() { return makeElement(); },
  querySelectorAll() { return []; },
};

const sandbox = {
  console,
  document: documentStub,
  localStorage,
  navigator: { userAgent: 'node-regression', clipboard: null },
  location: { pathname: '/index.html', href: '' },
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  performance,
  addEventListener() {},
  removeEventListener() {},
  confirm: () => false,
  fetch: async () => ({ ok: false, text: async () => '' }),
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  setInterval: () => 1,
  clearInterval() {},
  setTimeout: (fn) => { queueMicrotask(fn); return 1; },
  clearTimeout() {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'index.html' });

const run = code => vm.runInContext(code, sandbox);
const runAsync = code => vm.runInContext(`(async () => { ${code} })()`, sandbox);

(async () => {
assert.equal(run('GAME_VERSION'), '4.18.0');
assert.equal(run('SAVE_VERSION'), 9);

const mapResult = run(`(() => {
  let minimumArea1 = Infinity;
  let minimumArea2 = Infinity;
  for (let seed = 0; seed < 1000; seed++) {
    G.buildings = {};
    genMap(seed);
    let area1 = 0, area2 = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < AREA_W; x++) if (G.tiles[idx(x, y)] === T_CRYSTAL) area1++;
      for (let x = AREA_W + BORDER_W; x < AREA_W * 2 + BORDER_W; x++) {
        if (G.tiles[idx(x, y)] === T_CRYSTAL) area2++;
      }
    }
    minimumArea1 = Math.min(minimumArea1, area1);
    minimumArea2 = Math.min(minimumArea2, area2);
    for (let edge = 0; edge < BORDER_W; edge++) for (let x = 0; x < W; x++) for (const y of [edge, H - 1 - edge]) {
      if (G.tiles[idx(x, y)] !== T_ROCK || G.ore[idx(x, y)] !== 0) return { error: 'outer-y', seed, x, y };
    }
    for (let edge = 0; edge < BORDER_W; edge++) for (let y = 0; y < H; y++) for (const x of [edge, W - 1 - edge]) {
      if (G.tiles[idx(x, y)] !== T_ROCK || G.ore[idx(x, y)] !== 0) return { error: 'outer-x', seed, x, y };
    }
    for (const bd of BORDERS) for (let x = bd.x0 - 1; x <= bd.x0 + BORDER_W; x++) {
      if (G.tiles[idx(x, GATE_Y)] !== T_PLAIN || G.ore[idx(x, GATE_Y)] !== 0) return { error: 'gate', seed, x };
    }
  }
  G.buildings = {};
  genMap(20260702);
  const first = Array.from(G.tiles).join(',') + '|' + Array.from(G.ore).join(',');
  G.buildings = {};
  genMap(20260702);
  const second = Array.from(G.tiles).join(',') + '|' + Array.from(G.ore).join(',');
  let fixedArea1 = 0, fixedArea2 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < AREA_W; x++) if (G.tiles[idx(x, y)] === T_CRYSTAL) fixedArea1++;
    for (let x = AREA_W + BORDER_W; x < AREA_W * 2 + BORDER_W; x++) if (G.tiles[idx(x, y)] === T_CRYSTAL) fixedArea2++;
  }
  return { minimumArea1, minimumArea2, fixedArea1, fixedArea2, deterministic: first === second };
})()`);
assert(!mapResult.error, JSON.stringify(mapResult));
assert(mapResult.minimumArea1 >= 15);
assert(mapResult.minimumArea2 >= 15);
assert(mapResult.fixedArea1 >= 15);
assert(mapResult.fixedArea2 >= 15);
assert.equal(mapResult.deterministic, true);

const saveResult = run(`(() => {
  G.buildings = {};
  genMap(20260702);
  const current = makeSave();
  const validCurrent = validateSaveVersion(current) && !!migrateToLatest(current);
  const malformed = { ...current, tiles: current.tiles.slice(1) };
  const before = JSON.stringify(makeSave());
  const rejectedMalformed = migrateToLatest(malformed) === null;
  const unchangedAfterReject = JSON.stringify(makeSave()) === before;
  const unknown = cloneSaveData(current);
  unknown.buildings.push({ type: 'mystery', x: 10, y: 10 });
  const rejectedUnknown = migrateToLatest(unknown) === null;
  const badDirection = cloneSaveData(current);
  badDirection.buildings.push({ type: 'belt', x: 10, y: 10, dir: 99, item: 'ironOre', progress: 0 });
  const rejectedBadDirection = migrateToLatest(badDirection) === null;
  const badItem = cloneSaveData(current);
  badItem.player.inv.bogus = 1;
  const rejectedBadItem = migrateToLatest(badItem) === null;
  const badFlags = cloneSaveData(current);
  badFlags.flags = 1;
  const rejectedBadFlags = migrateToLatest(badFlags) === null;
  const missingArmState = cloneSaveData(current);
  missingArmState.buildings.push({ type: 'arm', x: 10, y: 10 });
  const rejectedMissingArmState = migrateToLatest(missingArmState) === null;
  const missingFurnaceState = cloneSaveData(current);
  missingFurnaceState.buildings.push({ type: 'furnace', x: 10, y: 10, job: null, progress: 0 });
  const rejectedMissingFurnaceState = migrateToLatest(missingFurnaceState) === null;

  const v2w = AREA_W * 2 + BORDER_W;
  const cells = v2w * MAP_H;
  const tiles = new Array(cells).fill('0');
  const ore = new Array(cells).fill(0);
  const explored = new Array(cells).fill('0');
  const mark = (x, y, tile, amount) => {
    const i = y * v2w + x;
    tiles[i] = String(tile); ore[i] = amount; explored[i] = '1';
  };
  mark(10, 10, T_IRON, 123);
  mark(60, 10, T_STONE, 234);
  const old = {
    v: 2, seed: 42, tiles: tiles.join(''), ore, explored: explored.join(''),
    buildings: [
      { type: 'base', x: 24, y: 24 },
      { type: 'gate', x: GATE_X, y: GATE_Y, repaired: false },
    ],
    player: { x: 24, y: 24, battery: 100, inv: {} },
    flags: {}, cleared: false, beaconCleared: false, time: 0, lastSeen: 1,
  };
  const oldBefore = JSON.stringify(old);
  const migrated = migrateToLatest(old);
  return {
    validCurrent,
    rejectedMalformed,
    unchangedAfterReject,
    rejectedUnknown,
    rejectedBadDirection,
    rejectedBadItem,
    rejectedBadFlags,
    rejectedMissingArmState,
    rejectedMissingFurnaceState,
    oldInputUnchanged: JSON.stringify(old) === oldBefore,
    oldMigrated: !!migrated,
    migratedLength: migrated && migrated.data.tiles.length,
    sentinel1: migrated && migrated.data.tiles[idx(10, 10)],
    sentinel2: migrated && migrated.data.tiles[idx(60, 10)],
    explored1: migrated && migrated.data.explored[idx(10, 10)],
    explored2: migrated && migrated.data.explored[idx(60, 10)],
  };
})()`);
assert.deepEqual(JSON.parse(JSON.stringify(saveResult)), {
  validCurrent: true,
  rejectedMalformed: true,
  unchangedAfterReject: true,
  rejectedUnknown: true,
  rejectedBadDirection: true,
  rejectedBadItem: true,
  rejectedBadFlags: true,
  rejectedMissingArmState: true,
  rejectedMissingFurnaceState: true,
  oldInputUnchanged: true,
  oldMigrated: true,
  migratedLength: 9648,
  sentinel1: '2',
  sentinel2: '3',
  explored1: '1',
  explored2: '1',
});

const saveFailure = run(`(() => {
  G.buildings = {};
  genMap(7);
  G.lastSeen = 123456;
  return { before: G.lastSeen };
})()`);
failStorageWrites = true;
saveFailure.saved = run('saveGame(true)');
saveFailure.after = run('G.lastSeen');
failStorageWrites = false;
assert.deepEqual(JSON.parse(JSON.stringify(saveFailure)), { before: 123456, saved: false, after: 123456 });

const invalidRaw = run(`(() => {
  const bad = makeSave();
  bad.ore = bad.ore.slice(1);
  return JSON.stringify(bad);
})()`);
storage.set('ponzu_hoshi_koujou_v1', invalidRaw);
run('suppressSave = false');
const invalidStatus = run('loadGame()');
const blockedSave = run('saveGame()');
assert.deepEqual({
  invalidStatus,
  blockedSave,
  rawPreserved: storage.get('ponzu_hoshi_koujou_v1') === invalidRaw,
}, { invalidStatus: 'invalid', blockedSave: false, rawPreserved: true });
run('suppressSave = false');

const offlineResult = await runAsync(`
  function setupLab() {
    G.buildings = {};
    const base = { type: 'base', x: 24, y: 24 };
    const lab = { type: 'lab', x: 25, y: 24, input: { researchPack1: 200 }, currentTech: 'gate3Blueprint', job: null, progress: 0 };
    G.buildings[bkey(base.x, base.y)] = base;
    G.buildings[bkey(lab.x, lab.y)] = lab;
    G.flags = {}; G.research = {}; G.researchProgress = {};
    markPowerTopologyDirty();
    return lab;
  }
  let lab = setupLab();
  for (let i = 0; i < 120; i++) tickMachines(0.5);
  const normal = getResearchProgress('gate3Blueprint').researchPack1 || 0;
  const normalLeft = lab.input.researchPack1;
  lab = setupLab();
  await simulateOffline(60);
  const offline = getResearchProgress('gate3Blueprint').researchPack1 || 0;
  const offlineLeft = lab.input.researchPack1;

  function setupMiner() {
    G.tiles.fill(T_PLAIN); G.ore.fill(0);
    G.flags = {}; G.research = {}; G.researchProgress = {};
    const base = { type: 'base', x: 24, y: 24 };
    const miner = { type: 'minerMk2', x: 25, y: 24, timer: 0, buffer: {}, powered: true };
    const chest = { type: 'chest', x: 26, y: 24, inv: {} };
    G.tiles[idx(25, 24)] = T_IRON; G.ore[idx(25, 24)] = 10000;
    G.buildings = { [bkey(base.x, base.y)]: base, [bkey(miner.x, miner.y)]: miner, [bkey(chest.x, chest.y)]: chest };
    markPowerTopologyDirty();
    return { miner, chest };
  }
  let minerSetup = setupMiner();
  for (let i = 0; i < 120; i++) tickMachines(0.5);
  const minerNormal = (minerSetup.miner.buffer.ironOre || 0) + (minerSetup.chest.inv.ironOre || 0);
  minerSetup = setupMiner();
  await simulateOffline(60);
  const minerOffline = (minerSetup.miner.buffer.ironOre || 0) + (minerSetup.chest.inv.ironOre || 0);
  return { normal, normalLeft, offline, offlineLeft, minerNormal, minerOffline };
`);
assert.deepEqual(JSON.parse(JSON.stringify(offlineResult)), {
  normal: 120,
  normalLeft: 80,
  offline: 120,
  offlineLeft: 80,
  minerNormal: 22,
  minerOffline: 22,
});

assert(!html.includes('建設メニューの「基本」から小型発電機'));
console.log('regression ok: map, offline production, save validation/migration, save failure UI');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
