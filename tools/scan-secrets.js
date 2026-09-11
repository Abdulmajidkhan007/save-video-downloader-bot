#!/usr/bin/env node
'use strict';

// Repo PUBLIC bo'lgani uchun: commit'dan oldin kalit/token qolib ketmaganini tekshiradi.
// Ishlatish: npm run scan   (CI da ham shu ishlaydi)
// Topilsa exit kodi 1 — xato jim yutilmaydi.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NUL = String.fromCharCode(0);

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build',
  'data', 'downloads', 'bin', 'coverage', '.next',
]);
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3', '.mp4', '.zip',
  '.ttf', '.otf', '.woff', '.woff2', '.pdf', '.db', '.sqlite',
]);

// Namuna qiymatlar — bular haqiqiy kalit emas.
const PLACEHOLDER =
  /(x{3,}|placeholder|your[_-]?|example|namuna|sizning|bu[_-]?yerga|changeme|token_here|<[^>]*>|\.\.\.|abc-def|123456789:aa|openssl|generate|random)/i;

// Fayl ichidagi kalit "shakli" — qayerda bo'lsa ham xavfli.
const SHAPE_RULES = [
  { name: 'Telegram bot token', re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g },
  { name: 'Google/Gemini API kaliti', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'OpenAI/Anthropic kaliti', re: /\bsk-(ant-)?[A-Za-z0-9_-]{24,}\b/g },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Private key bloki', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
];

// Fayl nomi bo'yicha taqiqlanganlar. Telethon/Pyrogram sessiya fayli kalitdan ham
// xavfliroq: u akkauntga to'liq kirish beradi (parol ham, 2FA ham so'ralmaydi).
const FORBIDDEN_NAME = /\.(session|session-journal)$|^id_(rsa|dsa|ecdsa|ed25519)$|\.pem$|\.p12$/;

// Faqat .env* fayllari uchun: sir nomli o'zgaruvchi TO'LDIRILGAN bo'lsa — xavfli.
const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|API_KEY|APIKEY|ACCESS_KEY|SESSION|API_HASH)/;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else if (entry.isFile()) {
      if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

/**
 * .env uslubidagi matnda to'ldirilgan sirlarni topadi (toza mantiq — test qilinadi).
 * @param {string} text
 * @returns {Array<{line: number, key: string}>}
 */
function findFilledEnvSecrets(text) {
  const hits = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq <= 0) return;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return;
    if (!SECRET_NAME.test(key)) return;
    if (value.length < 12) return; // bo'sh yoki qisqa namuna
    if (PLACEHOLDER.test(value)) return;
    hits.push({ line: i + 1, key });
  });
  return hits;
}

function scan() {
  const findings = [];
  const files = walk(ROOT);

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const base = path.basename(file);

    // 1) .env fayllari umuman bo'lmasligi kerak (faqat .env.example ruxsat)
    if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) {
      findings.push({ file: rel, line: 0, rule: '.env fayli', snippet: base });
    }

    // 2) Sessiya / kalit fayllari — mazmunidan qat'i nazar taqiqlanadi
    if (FORBIDDEN_NAME.test(base)) {
      findings.push({ file: rel, line: 0, rule: 'Sessiya/kalit fayli', snippet: base });
    }

    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      console.error(`⚠️  o'qib bo'lmadi: ${rel} — ${err.message}`);
      continue;
    }
    if (text.indexOf(NUL) !== -1) continue; // binar fayl

    // 3) Kalit shakllari — har qanday faylda
    for (const rule of SHAPE_RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text)) !== null) {
        const hit = m[0];
        if (PLACEHOLDER.test(hit)) continue;
        const line = text.slice(0, m.index).split('\n').length;
        findings.push({
          file: rel,
          line,
          rule: rule.name,
          snippet: hit.slice(0, 20) + (hit.length > 20 ? '…' : ''),
        });
      }
    }

    // 4) .env* fayllarida to'ldirilgan sirlar
    if (base.startsWith('.env')) {
      for (const hit of findFilledEnvSecrets(text)) {
        findings.push({ file: rel, line: hit.line, rule: "To'ldirilgan sir", snippet: hit.key });
      }
    }
  }

  return { findings, checked: files.length };
}

if (require.main === module) {
  const { findings, checked } = scan();
  if (findings.length === 0) {
    console.log(`✅ ${checked} fayl tekshirildi — sir topilmadi.`);
    process.exit(0);
  }
  console.error(`\n❌ ${findings.length} ta shubhali joy topildi:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}${f.line ? ':' + f.line : ''}  [${f.rule}]  ${f.snippet}`);
  }
  console.error('\nCommit qilishdan oldin tozalang.\n');
  process.exit(1);
}

module.exports = { findFilledEnvSecrets, scan, FORBIDDEN_NAME };
