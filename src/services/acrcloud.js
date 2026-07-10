'use strict';

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { config, acrEnabled } = require('../config');

// ACRCloud "identify" API — Shazam kabi musiqa aniqlash.
// HMAC-SHA1 imzo ACRCloud hujjatidagi standart usulda tuziladi.

// multipart/form-data body'ni qo'lda quramiz (tashqi kutubxonasiz).
function buildMultipart(fields, fileField) {
  const boundary = '----ACRBoundary' + crypto.randomBytes(8).toString('hex');
  const chunks = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
    );
  }

  // Audio namuna fayli
  chunks.push(Buffer.from(`--${boundary}\r\n`));
  chunks.push(
    Buffer.from(
      `Content-Disposition: form-data; name="sample"; filename="sample.wav"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n'
    )
  );
  chunks.push(fileField);
  chunks.push(Buffer.from('\r\n'));
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return { body: Buffer.concat(chunks), boundary };
}

function httpsPost(host, path, body, boundary) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        host,
        path,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 30000,
      },
      (res) => {
        const data = [];
        res.on('data', (d) => data.push(d));
        res.on('end', () => resolve(Buffer.concat(data).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('ACR_TIMEOUT')));
    req.write(body);
    req.end();
  });
}

/**
 * WAV namunani ACRCloud'ga yuborib qo'shiqni aniqlaydi.
 * @param {string} wavPath — kesib olingan namuna (~12s) yo'li
 * @returns {Promise<{ title, artist } | null>}
 */
async function identify(wavPath) {
  if (!acrEnabled()) return null;

  const sampleBytes = fs.readFileSync(wavPath);
  const httpMethod = 'POST';
  const httpUri = '/v1/identify';
  const dataType = 'audio';
  const signatureVersion = '1';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const stringToSign = [
    httpMethod,
    httpUri,
    config.ACR_ACCESS_KEY,
    dataType,
    signatureVersion,
    timestamp,
  ].join('\n');

  const signature = crypto
    .createHmac('sha1', config.ACR_ACCESS_SECRET)
    .update(Buffer.from(stringToSign, 'utf8'))
    .digest('base64');

  const fields = {
    access_key: config.ACR_ACCESS_KEY,
    data_type: dataType,
    signature_version: signatureVersion,
    signature,
    sample_bytes: sampleBytes.length,
    timestamp,
  };

  const { body, boundary } = buildMultipart(fields, sampleBytes);
  const raw = await httpsPost(config.ACR_HOST, httpUri, body, boundary);

  let json;
  try {
    json = JSON.parse(raw);
  } catch (_) {
    throw new Error('ACR_BAD_RESPONSE');
  }

  // status.code === 0 → topildi
  if (!json.status || json.status.code !== 0) {
    return null;
  }
  const music =
    json.metadata && json.metadata.music && json.metadata.music[0]
      ? json.metadata.music[0]
      : null;
  if (!music) return null;

  const title = music.title || '';
  const artist =
    music.artists && music.artists.length
      ? music.artists.map((a) => a.name).join(', ')
      : '';
  if (!title) return null;
  return { title, artist };
}

module.exports = { identify };
