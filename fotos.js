// Trainly — envio de fotos para o Cloudflare R2.
// Usa o login do Firebase (ID token) para provar quem está enviando.
(function () {
  function api() { return String(window.TRAINLY_PHOTO_API || '').replace(/\/+$/, ''); }

  function ativo() { return !!api(); }
  function ehDataUrl(s) { return typeof s === 'string' && s.indexOf('data:image/') === 0; }

  function dataUrlParaBlob(d) {
    var i = d.indexOf(','), meta = d.slice(0, i), bin = atob(d.slice(i + 1));
    var mime = (/data:([^;]+)/.exec(meta) || [])[1] || 'image/jpeg';
    var arr = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type: mime });
  }

  // Token padrão: usuário atual do Firebase (SDK "compat" usado em app.html e cadastro.html).
  async function tokenPadrao() {
    if (!window.firebase || !firebase.auth) return null;
    var a = firebase.auth(), u = a.currentUser;
    if (!u) {
      u = await new Promise(function (resolve) {
        var feito = false, un = a.onAuthStateChanged(function (x) { if (feito) return; feito = true; try { un(); } catch (e) { } resolve(x); });
        setTimeout(function () { if (feito) return; feito = true; try { un(); } catch (e) { } resolve(null); }, 4000);
      });
    }
    return u ? u.getIdToken() : null;
  }

  // Envia a foto (data URL JPEG) e devolve { url, key }.
  // kind: 'manager' | 'student'   id: ID do documento no Firestore (managers/students)
  async function enviar(dataUrl, opts) {
    opts = opts || {};
    if (!ativo()) throw new Error('Servidor de fotos não configurado.');
    var token = await (opts.getToken || tokenPadrao)();
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
    var resp = await fetch(api() + '/upload?kind=' + encodeURIComponent(opts.kind) + '&id=' + encodeURIComponent(opts.id), {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'image/jpeg' },
      body: dataUrlParaBlob(dataUrl)
    });
    var data = {};
    try { data = await resp.json(); } catch (e) { }
    if (!resp.ok || !data.url) throw new Error(data.error || 'Não foi possível enviar a foto.');
    return { url: data.url, key: data.key };
  }

  // Apaga uma foto antiga (só quem enviou consegue). Nunca dá erro para quem chamou.
  async function apagar(key, getToken) {
    try {
      if (!ativo() || !key) return false;
      var token = await (getToken || tokenPadrao)();
      if (!token) return false;
      var r = await fetch(api() + '/f/' + key, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      return r.ok;
    } catch (e) { return false; }
  }

  window.TrainlyFotos = { ativo: ativo, ehDataUrl: ehDataUrl, enviar: enviar, apagar: apagar };
})();
