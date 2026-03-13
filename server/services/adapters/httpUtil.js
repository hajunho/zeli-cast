/**
 * Shared HTTPS GET utility — IPv4 forced (AWS EC2 compatible)
 */
import https from 'https';
import http from 'http';

/**
 * HTTPS/HTTP GET → JSON (IPv4 강제)
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
export function httpsGetJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (isHttps ? 443 : 80),
      family: 4,  // IPv4 강제 (AWS EC2 IPv6 이슈 방지)
      headers: { 'User-Agent': 'ZeliCast/1.0' },
    };

    const req = mod.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        // HTTP 에러 체크 (401, 403, 429, 5xx 등)
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from ${parsed.hostname}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
