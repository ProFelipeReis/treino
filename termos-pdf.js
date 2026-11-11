/* ============================================================================
 * TRAINLY — Relatório em PDF do Aceite dos Termos (A3)
 * ----------------------------------------------------------------------------
 *   TrainlyTermsPDF.build(data)  -> Promise<{ blob, filename, doc }>
 *
 * data = {
 *   kind: 'aluno' | 'gestor',
 *   generatedBy: { name, username },
 *   rows: [ { name, ref, manager, userId, status ('accepted'|'pending'|'legacy'),
 *             createdAt, acceptedAt, acceptedAtServer, version, hash, method,
 *             consents, ua, platform, language, timezone, screen,
 *             profType, cref } ],
 *   summary: { total, accepted, pending, legacy, exempt },
 *   termsText: { version, versionLabel, effectiveDate, hash, docs, consents }
 * }
 *
 * Usa jsPDF (vendor/) via TrainlyPDF.ensureLibs (pdf-export.js).
 * ========================================================================== */
(function (root) {
  'use strict';

  var PW = 210, PH = 297, M = 15, CW = PW - 2 * M, BOTTOM = PH - 18;
  var C = {
    ink: [17, 17, 16], mute: [120, 120, 112], body: [60, 60, 56], soft: [247, 247, 245], line: [228, 228, 224],
    yellow: [245, 200, 0], green: [46, 125, 82], greenBg: [240, 250, 244],
    red: [200, 50, 50], redBg: [254, 242, 242], amber: [176, 120, 0], amberBg: [255, 249, 230], white: [255, 255, 255]
  };

  function clean(s) { return root.TrainlyPDF ? root.TrainlyPDF.clean(s) : String(s == null ? '' : s); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDT(ms) {
    if (!ms) return '-';
    var d = new Date(ms); if (isNaN(d.getTime())) return '-';
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }
  function fmtD(ms) {
    if (!ms) return '-';
    var d = new Date(ms); if (isNaN(d.getTime())) return '-';
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function tzLabel() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }
  function deviceOf(ua) {
    ua = String(ua || '');
    if (!ua) return '-';
    var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Outro';
    var br = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : /Firefox\//i.test(ua) ? 'Firefox' : 'Outro';
    return br + ' / ' + os;
  }

  function Ctx(doc) { this.doc = doc; this.y = M; this.page = 1; this.title = ''; }
  Ctx.prototype.need = function (h) { if (this.y + h > BOTTOM) this.newPage(); };
  Ctx.prototype.newPage = function () {
    this.doc.addPage(); this.page++; this.y = M + 8;
    var d = this.doc;
    d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor.apply(d, C.mute);
    d.text('Trainly - ' + clean(this.title), M, 10);
    d.setDrawColor.apply(d, C.line); d.setLineWidth(0.2); d.line(M, 12, PW - M, 12);
  };
  Ctx.prototype.text = function (str, x, size, style, color, maxW, lh) {
    var d = this.doc;
    d.setFont('helvetica', style || 'normal'); d.setFontSize(size); d.setTextColor.apply(d, color || C.ink);
    var lines = d.splitTextToSize(clean(str), maxW || CW);
    var step = lh || size * 0.42;
    for (var i = 0; i < lines.length; i++) { this.need(step + 1); d.text(lines[i], x, this.y + size * 0.3); this.y += step; }
    return lines.length;
  };
  Ctx.prototype.gap = function (h) { this.y += h; };
  Ctx.prototype.h1 = function (t) {
    this.need(16); this.gap(3);
    var d = this.doc;
    d.setFillColor.apply(d, C.yellow); d.rect(M, this.y, 2.2, 6.4, 'F');
    this.text(t, M + 5, 13, 'bold', C.ink, CW - 5, 6.6); this.gap(2.5);
  };
  Ctx.prototype.h2 = function (t) { this.need(12); this.gap(2); this.text(t, M, 10, 'bold', C.ink, CW, 5); this.gap(1); };
  Ctx.prototype.kv = function (k, v, opts) {
    opts = opts || {}; var d = this.doc;
    var kw = opts.kw || 46;
    d.setFont(opts.mono ? 'courier' : 'helvetica', 'normal'); d.setFontSize(opts.mono ? 7.6 : 9);
    var lines = d.splitTextToSize(clean(v == null || v === '' ? '-' : v), CW - kw - 2);
    this.need(lines.length * 4.4 + 1.5);
    d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.setTextColor.apply(d, C.mute); d.text(clean(k), M, this.y + 2.6);
    d.setFont(opts.mono ? 'courier' : 'helvetica', 'normal'); d.setFontSize(opts.mono ? 7.6 : 9); d.setTextColor.apply(d, C.ink);
    for (var i = 0; i < lines.length; i++) { d.text(lines[i], M + kw, this.y + 2.6); this.y += 4.4; }
    this.y += 1.2;
  };

  function statusStyle(r) {
    if (r.status === 'accepted') return { label: 'ACEITO', fg: C.green, bg: C.greenBg };
    if (r.status === 'legacy') return { label: 'SEM REGISTRO', fg: C.amber, bg: C.amberBg };
    return { label: 'PENDENTE', fg: C.red, bg: C.redBg };
  }

  function coverPage(ctx, data, who) {
    var d = ctx.doc;
    d.setFillColor.apply(d, C.ink); d.rect(0, 0, PW, 62, 'F');
    d.setFillColor.apply(d, C.yellow); d.rect(0, 62, PW, 2.4, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(10); d.setTextColor.apply(d, C.yellow); d.text('TRAINLY', M, 20);
    d.setFont('helvetica', 'bold'); d.setFontSize(21); d.setTextColor.apply(d, C.white);
    d.text(clean('Relatório de Aceite dos Termos'), M, 34);
    d.setFontSize(13); d.setFont('helvetica', 'normal'); d.setTextColor(220, 220, 214);
    d.text(clean('Termos de Uso e Política de Privacidade - ' + who.plural), M, 43);
    d.setFontSize(9); d.setTextColor(170, 170, 162);
    d.text(clean('Documento gerado em ' + fmtDT(Date.now()) + ' (' + tzLabel() + ')'), M, 54);
    ctx.y = 76;
  }

  function summaryBlock(ctx, data, who) {
    var s = data.summary || {}, d = ctx.doc;
    ctx.h1('1. Resumo geral');
    var isAl = data.kind === 'aluno';
    var cards = [
      ['Total de ' + who.plural.toLowerCase(), s.total || 0, C.ink],
      ['Aceites registrados', s.accepted || 0, C.green],
      [isAl ? 'Aguardando 1º acesso' : 'Sem registro de aceite', isAl ? (s.pending || 0) : (s.legacy || 0), isAl ? C.red : C.amber]
    ];
    var w = (CW - 8) / 3;
    ctx.need(26);
    for (var i = 0; i < cards.length; i++) {
      var x = M + i * (w + 4);
      d.setFillColor.apply(d, C.soft); d.setDrawColor.apply(d, C.line); d.setLineWidth(0.25); d.roundedRect(x, ctx.y, w, 20, 2, 2, 'FD');
      d.setFont('helvetica', 'bold'); d.setFontSize(18); d.setTextColor.apply(d, cards[i][2]); d.text(String(cards[i][1]), x + 4, ctx.y + 10);
      d.setFont('helvetica', 'normal'); d.setFontSize(7.6); d.setTextColor.apply(d, C.mute); d.text(clean(cards[i][0]), x + 4, ctx.y + 16);
    }
    ctx.y += 25;
    var pct = s.total ? Math.round(((s.accepted || 0) / s.total) * 100) : 0;
    ctx.kv('Taxa de aceite', pct + '% (' + (s.accepted || 0) + ' de ' + (s.total || 0) + ')');
    if (isAl) {
      ctx.kv('Alunos anteriores (isentos)', (s.exempt || 0) + ' aluno(s) cadastrado(s) antes da exigência do aceite. Não veem a tela de termos e não constam neste relatório.');
    } else if (s.legacy) {
      ctx.kv('Cadastros antigos', s.legacy + ' gestor(es) cadastrado(s) antes do registro de data e hora do aceite. O formulário de cadastro já exigia a marcação dos termos, mas o momento exato não foi guardado.');
    }
    var all = (data.rows || []).filter(function (r) { return r.acceptedAt; }).map(function (r) { return r.acceptedAt; });
    if (all.length) {
      ctx.kv('Primeiro aceite registrado', fmtDT(Math.min.apply(null, all)));
      ctx.kv('Último aceite registrado', fmtDT(Math.max.apply(null, all)));
    }
    var vers = {}; (data.rows || []).forEach(function (r) { if (r.version) vers[r.version] = (vers[r.version] || 0) + 1; });
    var vk = Object.keys(vers);
    if (vk.length) ctx.kv('Versões aceitas', vk.map(function (k) { return k + ' (' + vers[k] + ')'; }).join(', '));
  }

  function methodBlock(ctx, data) {
    ctx.h1('2. Como o aceite é registrado');
    var t = data.termsText;
    var lines = data.kind === 'aluno' ? [
      'No primeiro acesso ao painel do aluno, depois de informar o código gerado pelo gestor, o sistema exibe os Termos de Uso e a Política de Privacidade. O aluno só entra no painel depois de marcar as duas confirmações e tocar em "Aceitar e continuar".',
      'Confirmação 1: leitura e concordância com os Termos de Uso e com a Política de Privacidade.',
      'Confirmação 2: consentimento para tratamento de dados de saúde e declaração de veracidade das informações (e de autorização do responsável, quando menor de 18 anos).',
      'Cada aceite gera um registro próprio e imutável (não pode ser alterado nem apagado pelo sistema), com data e hora do aparelho e do servidor, versão do texto, código de verificação (SHA-256) do conteúdo aceito, nome, código de acesso e gestor vinculado, além de dados técnicos do aparelho (navegador, sistema, idioma, fuso e tela).',
      'Alunos cadastrados antes da exigência não passam pela tela de aceite e, por isso, não aparecem na lista.'
    ] : [
      'O gestor aceita os Termos de Uso e a Política de Privacidade no formulário de cadastro (marcação obrigatória) e declara possuir registro ativo no CREF. Cadastros novos gravam a data e hora do aceite e a versão dos termos diretamente na conta do gestor.',
      'Cadastros feitos antes dessa gravação aparecem como "Sem registro": o formulário já exigia o aceite, mas o momento exato não foi guardado. Nesses casos o relatório mostra apenas a data de criação da conta, como referência, sem afirmar o horário do aceite.',
      'Contas criadas diretamente por um administrador também não possuem aceite registrado pelo próprio gestor.'
    ];
    lines.forEach(function (l) { ctx.text(l, M, 9, 'normal', C.ink, CW, 4.6); ctx.gap(1.6); });
    if (t) {
      ctx.gap(1);
      ctx.kv('Versão dos termos vigente', t.version + (t.versionLabel ? ' (v' + t.versionLabel + ')' : ''));
      if (t.effectiveDate) ctx.kv('Vigência a partir de', t.effectiveDate);
      if (t.hash) ctx.kv('Código de verificação', t.hash, { mono: true });
    }
  }

  function listTable(ctx, data, who) {
    var rows = data.rows || [], d = ctx.doc;
    ctx.h1('3. Lista de ' + who.plural.toLowerCase());
    if (!rows.length) { ctx.text('Nenhum registro para exibir.', M, 9, 'normal', C.mute); return; }
    var isAl = data.kind === 'aluno';
    var cols = [['Nome', 52], [isAl ? 'Gestor' : 'Usuário', isAl ? 38 : 30], ['Situação', 26], ['Data e hora do aceite', 34], ['Versão', 30]];
    function head() {
      ctx.need(14);
      d.setFillColor.apply(d, C.ink); d.rect(M, ctx.y, CW, 6.4, 'F');
      d.setFont('helvetica', 'bold'); d.setFontSize(7.6); d.setTextColor.apply(d, C.white);
      var x = M + 2; cols.forEach(function (c) { d.text(clean(c[0]), x, ctx.y + 4.4); x += c[1]; });
      ctx.y += 6.4;
    }
    head();
    rows.forEach(function (r, i) {
      var st = statusStyle(r);
      var when = r.status === 'accepted' ? fmtDT(r.acceptedAt)
        : r.status === 'legacy' ? 'Conta criada em ' + fmtD(r.createdAt) : '-';
      var cells = [r.name, isAl ? r.manager : r.ref, st.label, when, r.version || '-'];
      d.setFont('helvetica', 'normal'); d.setFontSize(7.8);
      var wrapped = cells.map(function (c, k) { return d.splitTextToSize(clean(c == null || c === '' ? '-' : c), cols[k][1] - 3).slice(0, 2); });
      var lc = Math.max.apply(null, wrapped.map(function (w) { return w.length; }));
      var h = lc * 3.7 + 2.8;
      if (ctx.y + h > BOTTOM) { ctx.newPage(); head(); }
      if (i % 2 === 0) { d.setFillColor.apply(d, C.soft); d.rect(M, ctx.y, CW, h, 'F'); }
      var x = M + 2;
      wrapped.forEach(function (w, k) {
        if (k === 2) { d.setFont('helvetica', 'bold'); d.setTextColor.apply(d, st.fg); } else { d.setFont('helvetica', 'normal'); d.setTextColor.apply(d, C.ink); }
        d.setFontSize(7.8);
        for (var j = 0; j < w.length; j++) d.text(w[j], x, ctx.y + 4 + j * 3.7);
        x += cols[k][1];
      });
      ctx.y += h;
    });
    d.setDrawColor.apply(d, C.line); d.setLineWidth(0.2); d.line(M, ctx.y, M + CW, ctx.y);
    ctx.gap(2);
  }

  function detailBlock(ctx, data) {
    var rows = data.rows || [];
    if (!rows.length) return;
    var d = ctx.doc, isAl = data.kind === 'aluno';
    ctx.newPage();
    ctx.h1('4. Comprovante individual de cada aceite');
    ctx.text('Dados completos de cada registro, para fins de auditoria e comprovação.', M, 8.6, 'normal', C.mute, CW, 4.2);
    ctx.gap(2);
    rows.forEach(function (r, i) {
      var st = statusStyle(r);
      ctx.need(r.status === 'accepted' ? 70 : 34);
      d.setFillColor.apply(d, st.bg); d.setDrawColor.apply(d, C.line); d.setLineWidth(0.25); d.roundedRect(M, ctx.y, CW, 8, 1.6, 1.6, 'FD');
      d.setFont('helvetica', 'bold'); d.setFontSize(9.4); d.setTextColor.apply(d, C.ink); d.text(clean((i + 1) + '. ' + (r.name || '-')).slice(0, 62), M + 3, ctx.y + 5.4);
      d.setFontSize(8); d.setTextColor.apply(d, st.fg); d.text(st.label, M + CW - 3, ctx.y + 5.4, { align: 'right' });
      ctx.y += 11;
      if (isAl) {
        ctx.kv('Código de acesso', r.ref);
        ctx.kv('Gestor vinculado', r.manager);
        ctx.kv('ID do aluno', r.userId, { mono: true });
      } else {
        ctx.kv('Usuário', r.ref);
        if (r.profType) ctx.kv('Tipo de profissional', r.profType === 'nutri' ? 'Nutricionista' : 'Personal / Educador físico');
        if (r.cref) ctx.kv('Registro profissional', r.cref);
        ctx.kv('ID do gestor', r.userId, { mono: true });
      }
      if (r.status === 'accepted') {
        ctx.kv('Data e hora do aceite', fmtDT(r.acceptedAt) + ' (horário do aparelho)');
        if (r.acceptedAtServer) ctx.kv('Horário do servidor', fmtDT(r.acceptedAtServer) + ' (registro oficial)');
        ctx.kv('Versão aceita', r.version);
        if (r.hash) ctx.kv('Verificação SHA-256', r.hash, { mono: true });
        if (r.method) ctx.kv('Forma de aceite', r.method === 'primeiro-acesso-codigo' ? 'Primeiro acesso com código do gestor' : r.method === 'cadastro' ? 'Formulário de cadastro' : r.method);
        if (r.consents) {
          var cs = [];
          if (r.consents.termsAndPrivacy) cs.push('Termos de Uso e Política de Privacidade: SIM');
          if (r.consents.healthData) cs.push('Consentimento de dados de saúde e declaração de veracidade: SIM');
          if (cs.length) ctx.kv('Confirmações marcadas', cs.join('\n'));
        }
        ctx.kv('Aparelho', deviceOf(r.ua) + (r.platform ? ' (' + r.platform + ')' : ''));
        ctx.kv('Idioma / fuso / tela', [r.language, r.timezone, r.screen].filter(Boolean).join('  |  ') || '-');
        if (r.ua) ctx.kv('User-Agent', r.ua, { mono: true });
      } else if (r.status === 'legacy') {
        ctx.kv('Aceite registrado', 'Não. Conta criada antes do registro de data e hora do aceite.');
        ctx.kv('Conta criada em', fmtDT(r.createdAt) + ' (referência, não é o horário do aceite)');
      } else {
        ctx.kv('Aceite registrado', 'Não. O aluno ainda não fez o primeiro acesso.');
        ctx.kv('Cadastro criado em', fmtDT(r.createdAt));
      }
      ctx.gap(3);
    });
  }

  function legalNote(ctx) {
    ctx.h1('Observações');
    ctx.text('Este relatório reúne os registros de aceite armazenados na plataforma Trainly na data de geração. Os horários do aparelho dependem do relógio do dispositivo do usuário; o horário do servidor é o registro oficial, quando disponível. Dados de aparelho (User-Agent, idioma, fuso e tela) são informados pelo navegador e servem como indício complementar. Não é coletado o endereço IP. O documento contém dados pessoais e deve ser tratado com confidencialidade, conforme a LGPD.', M, 8.6, 'normal', C.body, CW, 4.2);
  }

  function annexTerms(ctx, data) {
    var t = data.termsText; if (!t || !t.docs) return;
    ctx.newPage();
    ctx.h1('5. Anexo - texto integral dos termos');
    ctx.text('Versão ' + t.version + (t.effectiveDate ? ' - vigente desde ' + t.effectiveDate : '') + '. Este é o conteúdo exibido para aceite nesta versão.', M, 8.6, 'normal', C.mute, CW, 4.2);
    ctx.gap(2);
    t.docs.forEach(function (doc) {
      ctx.h2(String(doc.title).toUpperCase());
      doc.sections.forEach(function (s) {
        ctx.need(14);
        ctx.text(s.h, M, 9.2, 'bold', C.ink, CW, 4.6);
        s.p.forEach(function (p) { ctx.text(String(p).replace(/\*\*(.+?)\*\*/g, '$1'), M, 8.6, 'normal', C.body, CW, 4.1); ctx.gap(0.8); });
        ctx.gap(1.4);
      });
      ctx.gap(3);
    });
    if (t.consents) {
      ctx.h2('CONFIRMAÇÕES EXIBIDAS NA TELA DE ACEITE');
      t.consents.forEach(function (c, i) { ctx.text((i + 1) + '. ' + c.label, M, 8.6, 'normal', C.body, CW, 4.1); ctx.gap(1.2); });
    }
  }

  function footers(doc, who) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor.apply(doc, C.mute);
      doc.text(clean('Trainly - Relatório de Aceite dos Termos (' + who.plural + ') - Confidencial'), M, PH - 8);
      doc.text('Página ' + i + ' de ' + n, PW - M, PH - 8, { align: 'right' });
    }
  }

  function build(data) {
    var TP = root.TrainlyPDF;
    if (!TP || !TP.ensureLibs) return Promise.reject(new Error('Gerador de PDF indisponível.'));
    return TP.ensureLibs(false).then(function () {
      var jsPDF = root.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'mm', format: 'a4' });
      var who = data.kind === 'aluno' ? { plural: 'Alunos' } : { plural: 'Gestores' };
      var ctx = new Ctx(doc);
      ctx.title = 'Aceite dos Termos - ' + who.plural;
      coverPage(ctx, data, who);
      var gb = data.generatedBy || {};
      ctx.kv('Gerado por', (gb.name || gb.username || '-') + (gb.username && gb.name ? ' (' + gb.username + ')' : '') + ' - Administrador grau 3 (A3)');
      ctx.kv('Escopo', 'Somente ' + who.plural.toLowerCase() + ' (alunos e gestores são relatados separadamente)');
      ctx.gap(2);
      summaryBlock(ctx, data, who);
      methodBlock(ctx, data);
      listTable(ctx, data, who);
      detailBlock(ctx, data);
      legalNote(ctx);
      annexTerms(ctx, data);
      footers(doc, who);
      var d = new Date();
      var fname = 'aceite-termos-' + (data.kind === 'aluno' ? 'alunos' : 'gestores') + '-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.pdf';
      return { blob: doc.output('blob'), filename: fname, doc: doc };
    });
  }

  root.TrainlyTermsPDF = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
