// Trainly — Worker de fotos (gestores e alunos)
// Guarda as fotos no R2 e só aceita quem estiver logado no Firebase.
//
//   POST   /upload?kind=manager|student&id=<id do documento>   (corpo = JPEG)  -> { key, url }
//   GET    /f/<key>                                            (público, com cache)
//   DELETE /f/<key>                                            (só quem enviou a foto)

const MAX_BYTES = 200 * 1024; // o site já reduz a foto para ~30 KB; 200 KB é folga
const KEY_RE = /^(managers|students)\/[A-Za-z0-9_-]{1,128}\/[0-9a-f-]{36}\.jpg$/;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let _jwks = null, _jwksExp = 0;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'Vary': 'Origin' };
  if (allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getJwks() {
  if (_jwks && Date.now() < _jwksExp) return _jwks;
  const r = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('jwks');
  _jwks = (await r.json()).keys || [];
  _jwksExp = Date.now() + 60 * 60 * 1000;
  return _jwks;
}

// Confere o ID token do Firebase (assinatura RS256, projeto, validade). Devolve { uid }.
async function verifyFirebaseToken(token, projectId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('token');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('alg');
  const jwk = (await getJwks()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('assinatura');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('aud');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('iss');
  if (!payload.exp || payload.exp < now) throw new Error('exp');
  if (payload.iat && payload.iat > now + 300) throw new Error('iat');
  if (!payload.sub) throw new Error('sub');
  return { uid: payload.sub };
}

async function authenticate(request, env) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try { return await verifyFirebaseToken(m[1], env.FIREBASE_PROJECT_ID); } catch (e) { return null; }
}

function isJpeg(bytes) {
  return bytes.length > 4 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, servico: 'trainly-fotos' }, 200, cors);

    // ── Enviar foto ──────────────────────────────────────────────
    if (url.pathname === '/upload' && request.method === 'POST') {
      const user = await authenticate(request, env);
      if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401, cors);

      const kind = url.searchParams.get('kind');
      const id = url.searchParams.get('id') || '';
      if (kind !== 'manager' && kind !== 'student') return json({ error: 'Tipo inválido.' }, 400, cors);
      if (!ID_RE.test(id)) return json({ error: 'ID inválido.' }, 400, cors);

      const declared = Number(request.headers.get('Content-Length') || 0);
      if (declared > MAX_BYTES) return json({ error: 'Foto muito grande.' }, 413, cors);
      const buf = await request.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return json({ error: 'Foto muito grande.' }, 413, cors);
      if (!isJpeg(new Uint8Array(buf))) return json({ error: 'Envie uma imagem JPEG.' }, 415, cors);

      // Nome novo e imprevisível a cada envio: nunca sobrescreve a foto de outra pessoa
      // e o navegador pode guardar a imagem em cache para sempre.
      const key = kind + 's/' + id + '/' + crypto.randomUUID() + '.jpg';
      await env.FOTOS.put(key, buf, {
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { uid: user.uid, kind: kind, id: id, enviadaEm: String(Date.now()) },
      });
      return json({ key: key, url: url.origin + '/f/' + key }, 200, cors);
    }

    // ── Ver / apagar foto ────────────────────────────────────────
    if (url.pathname.startsWith('/f/')) {
      const key = decodeURIComponent(url.pathname.slice(3));
      if (!KEY_RE.test(key)) return json({ error: 'Não encontrada.' }, 404, cors);

      if (request.method === 'GET' || request.method === 'HEAD') {
        const cache = caches.default;
        const cacheKey = new Request(url.origin + '/f/' + key, { method: 'GET' });
        let res = await cache.match(cacheKey);
        if (!res) {
          const obj = await env.FOTOS.get(key);
          if (!obj) return json({ error: 'Não encontrada.' }, 404, cors);
          res = new Response(obj.body, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Content-Type-Options': 'nosniff',
              'Cross-Origin-Resource-Policy': 'cross-origin',
            },
          });
          ctx.waitUntil(cache.put(cacheKey, res.clone()));
        }
        const out = new Response(res.body, res);
        for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
        return out;
      }

      if (request.method === 'DELETE') {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Sessão inválida.' }, 401, cors);
        const head = await env.FOTOS.head(key);
        if (!head) return json({ ok: true }, 200, cors);
        if (!head.customMetadata || head.customMetadata.uid !== user.uid) {
          return json({ error: 'Sem permissão para apagar esta foto.' }, 403, cors);
        }
        await env.FOTOS.delete(key);
        return json({ ok: true }, 200, cors);
      }
    }

    return json({ error: 'Não encontrado.' }, 404, cors);
  },
};

export { verifyFirebaseToken };
