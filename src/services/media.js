'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { config } = require('../config');

// ffmpeg yordamchisi — musiqa aniqlash uchun audio namuna tayyorlash.

function runFfmpeg(args, { timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(config.FFMPEG_PATH, args, { timeout }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = (stderr || '').toString();
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Kirish audiosining birinchi `seconds` soniyasini WAV'ga kesadi
 * (ACRCloud uchun: mono, 8kHz yetarli).
 * @returns {Promise<string>} WAV fayl yo'li
 */
async function toSampleWav(inputPath, seconds = 12) {
  const outPath = path.join(
    config.DOWNLOADS_DIR,
    `${path.basename(inputPath)}.sample.wav`
  );
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-t',
    String(seconds),
    '-ac',
    '1',
    '-ar',
    '44100',
    '-vn',
    outPath,
  ]);
  return outPath;
}

function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {
    /* ignore */
  }
}

module.exports = { toSampleWav, safeUnlink };
