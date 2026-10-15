/**
 * Audit fix: synchronous SHA-256 + salted local-password hashing.
 * Local-first app — passwords must never sit in plaintext in localStorage
 * or JSON backups. Legacy plaintext entries are upgraded on next login.
 */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export function sha256Hex(input: string): string {
  const bytes: number[] = [];
  const s = unescape(encodeURIComponent(input));
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Array<number>(64);
  for (let b = 0; b < bytes.length; b += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((bytes[b + i * 4] << 24) | (bytes[b + i * 4 + 1] << 16) | (bytes[b + i * 4 + 2] << 8) | bytes[b + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let va = h0, vb = h1, vc = h2, vd = h3, ve = h4, vf = h5, vg = h6, vh = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(ve, 6) ^ rotr(ve, 11) ^ rotr(ve, 25)) >>> 0;
      const ch = ((ve & vf) ^ (~ve & vg)) >>> 0;
      const t1 = (vh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(va, 2) ^ rotr(va, 13) ^ rotr(va, 22)) >>> 0;
      const maj = ((va & vb) ^ (va & vc) ^ (vb & vc)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      vh = vg; vg = vf; vf = ve; ve = (vd + t1) >>> 0; vd = vc; vc = vb; vb = va; va = (t1 + t2) >>> 0;
    }
    h0 = (h0 + va) >>> 0; h1 = (h1 + vb) >>> 0; h2 = (h2 + vc) >>> 0; h3 = (h3 + vd) >>> 0;
    h4 = (h4 + ve) >>> 0; h5 = (h5 + vf) >>> 0; h6 = (h6 + vg) >>> 0; h7 = (h7 + vh) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => x.toString(16).padStart(8, '0')).join('');
}

export const isPasswordHash = (v?: string): boolean => !!v && v.startsWith('sha256$');

export const hashPassword = (password: string, salt: string): string =>
  'sha256$' + sha256Hex(`${(salt || '').trim().toLowerCase()}::nsc::${password}`);

/** Accepts current hashes; legacy plaintext returns true so the caller can upgrade it. */
export const verifyPassword = (password: string, stored: string | undefined, salt: string): boolean => {
  if (!password || !stored) return false;
  if (!isPasswordHash(stored)) return stored === password;
  const h = hashPassword(password, salt);
  if (h.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
};
