#!/usr/bin/env node
'use strict';

// Monorepo boshqaruvchisi: botlarni ro'yxatlash, o'rnatish, sozlash va ishga tushirish.
// Tashqi kutubxonaga bog'liq emas — `node tools/run.js` toza Node bilan ishlaydi.
//
// Buyruqlar:
//   node tools/run.js list
//   node tools/run.js setup   <bot-id|all>     .env.example -> .env (mavjudini o'zgartirmaydi)
//   node tools/run.js install <bot-id|all>
//   node tools/run.js start   <bot-id|all> [--all]
//   node tools/run.js doctor

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { validateRegistry, resolveTargets, padWidth } = require('./registry');

const ROOT = path.resolve(__dirname, '..');
const BOTS_DIR = path.join(ROOT, 'bots');

const COLORS = ['\x1b[36m', '\x1b[32m', '\x1b[33m', '\x1b[35m', '\x1b[34m', '\x1b[91m', '\x1b[92m', '\x1b[93m', '\x1b[95m', '\x1b[94m'];
const RESET = '\x1b[0m';
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function color(i, text) {
  return useColor ? `${COLORS[i % COLORS.length]}${text}${RESET}` : text;
}

function loadBots() {
  const file = path.join(ROOT, 'bots.json');
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`bots.json o'qilmadi (${file}): ${err.message}`);
  }
  const bots = validateRegistry(raw);
  for (const bot of bots) {
    bot.dir = path.join(BOTS_DIR, bot.id);
    if (!fs.existsSync(bot.dir)) {
      throw new Error(`bots.json da "${bot.id}" bor, lekin bots/${bot.id} papkasi yo'q`);
    }
  }
  return bots;
}

// --- buyruqlar -------------------------------------------------------------

function cmdList(bots) {
  const w = padWidth(bots);
  console.log(`\n${bots.length} ta bot (bots/ ichida):\n`);
  bots.forEach((bot, i) => {
    const auto = bot.autoStart === false ? '  [qo\'lda]' : '';
    console.log(`  ${color(i, bot.id.padEnd(w))}  ${bot.runtime.padEnd(6)} ${bot.name}${auto}`);
    console.log(`  ${' '.repeat(w)}  ${bot.desc}`);
    if (bot.requires && bot.requires.length) {
      console.log(`  ${' '.repeat(w)}  kerak: ${bot.requires.join(', ')}`);
    }
    if (bot.note) console.log(`  ${' '.repeat(w)}  eslatma: ${bot.note}`);
    console.log('');
  });
  console.log('Ishga tushirish:  npm run bot <id>   |   hammasi: npm start\n');
}

function cmdSetup(targets) {
  for (const bot of targets) {
    const example = path.join(bot.dir, '.env.example');
    const env = path.join(bot.dir, '.env');
    if (!fs.existsSync(example)) {
      console.log(`⚠️  ${bot.id}: .env.example yo'q — o'tkazib yuborildi`);
      continue;
    }
    if (fs.existsSync(env)) {
      console.log(`•  ${bot.id}: .env allaqachon bor — tegilmadi`);
      continue;
    }
    fs.copyFileSync(example, env);
    console.log(`✅ ${bot.id}: .env yaratildi — endi kalitlarni to'ldiring (${path.relative(ROOT, env)})`);
  }
  console.log('\n⚠️  .env fayllari hech qachon git ga tushmaydi (.gitignore).');
}

function cmdInstall(targets) {
  let failed = 0;
  for (const bot of targets) {
    for (const step of bot.install) {
      console.log(`\n▶ ${bot.id}: ${step.join(' ')}`);
      const res = spawnSync(step[0], step.slice(1), { cwd: bot.dir, stdio: 'inherit', shell: false });
      if (res.error || res.status !== 0) {
        failed++;
        console.error(`❌ ${bot.id}: "${step.join(' ')}" muvaffaqiyatsiz` + (res.error ? ` (${res.error.message})` : ` (kod ${res.status})`));
        break;
      }
    }
  }
  if (failed) {
    console.error(`\n${failed} ta botda o'rnatish muvaffaqiyatsiz.`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ O\'rnatish tugadi.');
  }
}

// Har bot uchun: tayyorlov qadamlari (oxirgisidan oldingilari) tugaguncha kutiladi,
// oxirgi qadam — uzoq ishlaydigan jarayon.
function startOne(bot, index, width, running) {
  const prefix = color(index, `[${bot.id.padEnd(width)}]`);
  const env = { ...process.env };

  for (const step of bot.start.slice(0, -1)) {
    console.log(`${prefix} tayyorlov: ${step.join(' ')}`);
    const res = spawnSync(step[0], step.slice(1), { cwd: bot.dir, stdio: 'inherit', shell: false, env });
    if (res.error || res.status !== 0) {
      console.error(`${prefix} ❌ tayyorlov muvaffaqiyatsiz — bot ishga tushmadi`);
      return null;
    }
  }

  const step = bot.start[bot.start.length - 1];
  console.log(`${prefix} ishga tushmoqda: ${step.join(' ')}`);
  const child = spawn(step[0], step.slice(1), { cwd: bot.dir, stdio: ['ignore', 'pipe', 'pipe'], shell: false, env });

  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) out.write(`${prefix} ${line}\n`);
    });
    stream.on('end', () => {
      if (buf) out.write(`${prefix} ${buf}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('error', (err) => {
    // Xato JIM YUTILMAYDI — sabab aniq ko'rinsin (masalan: python yo'q).
    console.error(`${prefix} ❌ ishga tushmadi: ${err.message}`);
    running.delete(child);
  });
  child.on('exit', (code, signal) => {
    console.error(`${prefix} ⏹ to'xtadi (${signal ? `signal ${signal}` : `kod ${code}`})`);
    running.delete(child);
    if (code && !process.exitCode) process.exitCode = code;
  });

  running.add(child);
  return child;
}

function cmdStart(targets) {
  const missing = targets.filter((b) => !fs.existsSync(path.join(b.dir, '.env')));
  if (missing.length) {
    console.error(`\n❌ .env yo'q: ${missing.map((b) => b.id).join(', ')}`);
    console.error('   Avval sozlang:  npm run setup   (keyin .env ichiga kalitlarni yozing)\n');
    process.exitCode = 1;
    return;
  }

  const width = padWidth(targets);
  const running = new Set();
  targets.forEach((bot, i) => startOne(bot, i, width, running));

  const shutdown = (signal) => {
    console.log(`\n${signal} — botlar to'xtatilmoqda...`);
    for (const child of running) child.kill(signal);
    setTimeout(() => {
      for (const child of running) child.kill('SIGKILL');
      process.exit(process.exitCode || 0);
    }, 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function cmdDoctor(bots) {
  const runtimes = new Map([
    ['node', ['node', '--version']],
    ['python', ['python3', '--version']],
  ]);
  console.log('\n🩺 Tekshiruv\n');
  for (const [name, cmd] of runtimes) {
    const res = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', shell: false });
    const ok = !res.error && res.status === 0;
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${ok ? res.stdout.trim() : 'topilmadi'}`);
  }
  console.log('');
  const w = padWidth(bots);
  for (const bot of bots) {
    const hasEnvExample = fs.existsSync(path.join(bot.dir, '.env.example'));
    const hasEnv = fs.existsSync(path.join(bot.dir, '.env'));
    const deps =
      bot.runtime === 'node'
        ? fs.existsSync(path.join(bot.dir, 'node_modules'))
        : null;
    const parts = [
      hasEnvExample ? '.env.example ✅' : '.env.example ❌',
      hasEnv ? '.env ✅' : '.env ❌ (npm run setup)',
    ];
    if (deps !== null) parts.push(deps ? 'deps ✅' : 'deps ❌ (npm run install:all)');
    console.log(`  ${bot.id.padEnd(w)}  ${parts.join('  ')}`);
  }
  console.log('');
}

// --- CLI -------------------------------------------------------------------

function main(argv) {
  const args = argv.filter((a) => a !== '--all');
  const includeManual = argv.includes('--all');
  const [command, target] = args;
  const bots = loadBots();

  switch (command) {
    case 'list':
    case undefined:
      return cmdList(bots);
    case 'doctor':
      return cmdDoctor(bots);
    case 'setup':
      return cmdSetup(resolveTargets(target || 'all', bots, { includeManual: true }));
    case 'install':
      return cmdInstall(resolveTargets(target || 'all', bots, { includeManual: true }));
    case 'start':
      return cmdStart(resolveTargets(target || 'all', bots, { includeManual }));
    default:
      throw new Error(`Noma'lum buyruq: "${command}". Mavjud: list, setup, install, start, doctor`);
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exitCode = 1;
}
