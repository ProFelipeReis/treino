/* ============================================================================
 * TRAINLY — Relatório em PDF do Aceite dos Termos (A3)
 * ----------------------------------------------------------------------------
 *   TrainlyTermsPDF.build(data)  -> Promise<{ blob, filename, doc }>
 *
 * data = {
 *   kind: 'aluno' | 'gestor',
 *   individual: false | true,   // true = comprovante de UMA pessoa (rows tem 1 item)
 *   generatedBy: { name, username },
 *   rows: [ { name, ref, manager, userId, status ('accepted'|'pending'|'legacy'),
 *             createdAt, acceptedAt, acceptedAtServer, version, hash, method,
 *             consents, ua, platform, language, timezone, screen,
 *             profType, cref } ],
 *   summary: { total, accepted, pending, legacy, exempt },     // só no coletivo
 *   termsText: { version, versionLabel, effectiveDate, hash, docs, consents }
 * }
 *
 * Layout documental, no padrão ABNT (NBR 14724 / 6024 / IBGE para tabelas):
 *   A4, margens 3 cm (esq./sup.) e 2 cm (dir./inf.), Times 12, entrelinha 1,5,
 *   texto justificado, seções numeradas, tabelas abertas, numeração no canto
 *   superior direito e, no cabeçalho, a logo do Trainly em tamanho reduzido.
 *   Sem cores: apenas preto sobre branco.
 *
 * Usa jsPDF (vendor/) via TrainlyPDF.ensureLibs (pdf-export.js).
 * ========================================================================== */
(function (root) {
  'use strict';

  // ---- página e margens (mm) ----
  var PW = 210, PH = 297, ML = 30, MR = 20, MT = 30, MB = 20;
  var CW = PW - ML - MR, BOTTOM = PH - MB, PT = 0.3528; // 1 pt em mm

  // logo do Trainly (versão para papel: texto grafite, seta verde), pequena no cabeçalho
  var LOGO = 'data:image/png;base64,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';
  var LOGO_W = 22, LOGO_H = LOGO_W * 72 / 240;

  var MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function clean(s) { return root.TrainlyPDF ? root.TrainlyPDF.clean(s) : String(s == null ? '' : s); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function validDate(ms) { if (!ms) return null; var d = new Date(ms); return isNaN(d.getTime()) ? null : d; }
  function fmtDT(ms) {
    var d = validDate(ms); if (!d) return '-';
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }
  function fmtD(ms) {
    var d = validDate(ms); if (!d) return '-';
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function fmtLong(ms) {
    var d = validDate(ms); if (!d) return '-';
    return d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function fmtHM(ms) { var d = validDate(ms); return d ? p2(d.getHours()) + ':' + p2(d.getMinutes()) : '-'; }
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
  function statusLabel(r) {
    return r.status === 'accepted' ? 'Aceito' : r.status === 'legacy' ? 'Sem registro' : 'Pendente';
  }
  function methodLabel(m) {
    return m === 'primeiro-acesso-codigo' ? 'Primeiro acesso com código do gestor' : m === 'cadastro' ? 'Formulário de cadastro' : (m || '-');
  }

  // ======================================================================
  //  Contexto de escrita (cursor vertical, quebra de página, texto justificado)
  // ======================================================================
  function Ctx(doc) { this.doc = doc; this.y = MT; this.sec = 0; this.sub = 0; this.tab = 0; this.toc = []; }

  Ctx.prototype.pageNo = function () { return this.doc.internal.getCurrentPageInfo().pageNumber; };
  Ctx.prototype.newPage = function () { this.doc.addPage(); this.y = MT; };
  Ctx.prototype.need = function (h) { if (this.y + h > BOTTOM) this.newPage(); };
  Ctx.prototype.font = function (style, size, family) {
    var d = this.doc;
    d.setFont(family || 'times', style || 'normal'); d.setFontSize(size || 12); d.setTextColor(0, 0, 0);
  };
  Ctx.prototype.rule = function (y, w, x1, x2) {
    var d = this.doc; d.setDrawColor(0, 0, 0); d.setLineWidth(w || 0.25); d.line(x1 == null ? ML : x1, y, x2 == null ? ML + CW : x2, y);
  };

  // quebra em linhas (guardando as palavras, para justificar). Palavras maiores que a
  // linha (hash, user-agent) são partidas por caractere.
  Ctx.prototype.wrap = function (str, firstW, maxW) {
    var d = this.doc, out = [];
    clean(str).split('\n').forEach(function (p) {
      var words = p.split(/ +/).filter(Boolean);
      if (!words.length) { out.push({ words: [], last: true }); return; }
      var sp = d.getTextWidth(' '), cur = [], w = 0, lim = firstW;
      function push(last) { out.push({ words: cur, last: last }); cur = []; w = 0; lim = maxW; }
      words.forEach(function (wd) {
        var ww = d.getTextWidth(wd);
        while (ww > maxW && wd.length > 1) {
          if (cur.length) push(false);
          var k = wd.length; while (k > 1 && d.getTextWidth(wd.slice(0, k)) > lim) k--;
          cur = [wd.slice(0, k)]; push(false);
          wd = wd.slice(k); ww = d.getTextWidth(wd);
        }
        if (!wd) return;
        var add = cur.length ? sp + ww : ww;
        if (cur.length && w + add > lim) { push(false); add = ww; }
        cur.push(wd); w += add;
      });
      if (cur.length) push(true);
    });
    return out;
  };

  Ctx.prototype.drawLine = function (words, x, base, width, justify) {
    var d = this.doc;
    if (!justify || words.length < 2) { d.text(words.join(' '), x, base); return; }
    var tw = 0; words.forEach(function (w) { tw += d.getTextWidth(w); });
    var gap = (width - tw) / (words.length - 1);
    if (gap > d.getTextWidth(' ') * 3.2) { d.text(words.join(' '), x, base); return; } // linha curta demais: não estica
    var cx = x; words.forEach(function (w) { d.text(w, cx, base); cx += d.getTextWidth(w) + gap; });
  };

  // parágrafo ABNT: justificado, recuo de 1,25 cm na primeira linha, entrelinha 1,5
  Ctx.prototype.para = function (str, o) {
    o = o || {};
    var size = o.size || 12, ls = o.ls || 1.5, lh = size * ls * PT;
    var x = o.x == null ? ML : o.x, w = o.w || (CW - (x - ML));
    var ind = o.indent == null ? 12.5 : o.indent, justify = o.justify !== false;
    this.font(o.style || 'normal', size, o.family);
    var lines = this.wrap(str, w - ind, w);
    for (var i = 0; i < lines.length; i++) {
      this.need(lh);
      this.font(o.style || 'normal', size, o.family);
      var L = lines[i], lead = i === 0 ? ind : 0;
      this.drawLine(L.words, x + lead, this.y + lh / 2 + size * PT * 0.35, w - lead, justify && !L.last);
      this.y += lh;
    }
    if (o.after) this.y += o.after;
  };

  Ctx.prototype.h1 = function (title, o) {
    o = o || {};
    var lh = 12 * 1.5 * PT;
    this.need(lh * 5);
    var label = o.full ? title : (++this.sec + ' ' + title); this.sub = 0;
    label = label.toUpperCase();
    this.y += lh * 0.5;
    this.font('bold', 12);
    this.doc.text(clean(label), ML, this.y + lh / 2 + 12 * PT * 0.35);
    this.toc.push({ label: clean(label), page: this.pageNo() });
    this.y += lh * 1.5;
  };
  Ctx.prototype.h2 = function (title, o) {
    o = o || {};
    var lh = 12 * 1.5 * PT;
    this.need(o.keep || lh * 3);
    var label = o.noNum ? title : (this.sec + '.' + (++this.sub) + ' ' + title);
    this.para(label, { style: 'bold', indent: 0, justify: false, ls: 1.5 });
  };

  // título de tabela (acima) e fonte (abaixo), conforme IBGE/ABNT
  Ctx.prototype.tabTitle = function (t) {
    this.need(30);
    this.para('Tabela ' + (++this.tab) + ' – ' + t, { size: 10, ls: 1.2, indent: 0, justify: false, style: 'bold', after: 1.5 });
  };
  Ctx.prototype.fonte = function (t) {
    this.y += 1.2;
    this.para(t || 'Fonte: Plataforma Trainly (registros armazenados na data de geração deste documento).', { size: 10, ls: 1.2, indent: 0, justify: false, after: 4 });
  };

  // tabela aberta (sem bordas laterais): filetes no topo, sob o cabeçalho e no rodapé
  Ctx.prototype.table = function (cols, rows) {
    var self = this, size = 10, lh = size * 1.2 * PT, pad = 1.3, d = this.doc;
    function cellLines(c, txt, bold) {
      self.font(bold ? 'bold' : 'normal', size, c.mono ? 'courier' : 'times');
      return self.wrap(txt == null || txt === '' ? '-' : txt, c.w - 3, c.w - 3);
    }
    function drawCells(lines, bold) {
      var x = ML;
      cols.forEach(function (c, k) {
        self.font(bold ? 'bold' : 'normal', size, c.mono ? 'courier' : 'times');
        lines[k].forEach(function (L, j) { d.text(L.words.join(' '), x + 1.5, self.y + pad + lh * (j + 0.5) + size * PT * 0.35); });
        x += c.w;
      });
    }
    function height(lines) { return Math.max.apply(null, lines.map(function (a) { return a.length; })) * lh + 2 * pad; }
    function head() {
      var hl = cols.map(function (c) { return cellLines(c, c.h, true); }), h = height(hl);
      self.rule(self.y, 0.5); drawCells(hl, true); self.y += h; self.rule(self.y, 0.3);
    }
    var first = rows.length ? height(rows[0].map(function (t, k) { return cellLines(cols[k], t); })) : 0;
    this.need(10 + first + 2 * lh); head();
    rows.forEach(function (r, i) {
      var lines = r.map(function (t, k) { return cellLines(cols[k], t); }), h = height(lines);
      if (self.y + h > BOTTOM) { self.rule(self.y, 0.5); self.newPage(); head(); }
      drawCells(lines, false); self.y += h;
      if (i < rows.length - 1) self.rule(self.y, 0.1);
    });
    this.rule(this.y, 0.5);
  };

  // quadro "campo | valor" (mesmo estilo de tabela aberta)
  Ctx.prototype.kvTable = function (items, kw) {
    var self = this, size = 10, lh = size * 1.2 * PT, pad = 1.3, d = this.doc;
    kw = kw || 46; var vw = CW - kw;
    items = items.filter(function (it) { return it && it.v !== undefined; });
    function lns(it) {
      self.font('normal', size, it.mono ? 'courier' : 'times');
      var v = it.v == null || it.v === '' ? '-' : it.v;
      var vl = self.wrap(v, vw - 3, vw - 3);
      self.font('bold', size);
      var kl = self.wrap(it.k, kw - 3, kw - 3);
      return { k: kl, v: vl, h: Math.max(kl.length, vl.length) * lh + 2 * pad };
    }
    if (!items.length) return;
    this.need(lns(items[0]).h + 4); this.rule(this.y, 0.5);
    items.forEach(function (it, i) {
      var L = lns(it);
      if (self.y + L.h > BOTTOM) { self.rule(self.y, 0.5); self.newPage(); self.rule(self.y, 0.5); }
      self.font('bold', size);
      L.k.forEach(function (l, j) { d.text(l.words.join(' '), ML + 1.5, self.y + pad + lh * (j + 0.5) + size * PT * 0.35); });
      self.font('normal', size, it.mono ? 'courier' : 'times');
      L.v.forEach(function (l, j) { d.text(l.words.join(' '), ML + kw + 1.5, self.y + pad + lh * (j + 0.5) + size * PT * 0.35); });
      self.y += L.h;
      if (i < items.length - 1) self.rule(self.y, 0.1);
    });
    this.rule(this.y, 0.5);
  };

  // ======================================================================
  //  Conteúdos
  // ======================================================================
  function whoOf(kind) { return kind === 'aluno' ? { sing: 'aluno', plural: 'alunos', Plural: 'Alunos' } : { sing: 'gestor', plural: 'gestores', Plural: 'Gestores' }; }

  function methodParas(kind) {
    return kind === 'aluno' ? [
      'No primeiro acesso ao painel do aluno, depois de informar o código gerado pelo gestor, o sistema exibe os Termos de Uso e a Política de Privacidade. O aluno só entra no painel depois de marcar as duas confirmações exigidas e acionar o botão “Aceitar e continuar”.',
      'A primeira confirmação corresponde à leitura e à concordância com os Termos de Uso e com a Política de Privacidade. A segunda corresponde ao consentimento para o tratamento de dados de saúde e à declaração de veracidade das informações prestadas (e de autorização do responsável, quando o aluno for menor de 18 anos).',
      'Cada aceite gera um registro próprio e imutável, que não pode ser alterado nem apagado pelo sistema, contendo data e hora do aparelho e do servidor, versão do texto, código de verificação (SHA-256) do conteúdo aceito, nome, código de acesso e gestor vinculado, além de dados técnicos do aparelho (navegador, sistema, idioma, fuso horário e tela).',
      'Alunos cadastrados antes da exigência do aceite não passam pela tela de termos e, por esse motivo, não constam neste documento.'
    ] : [
      'O gestor aceita os Termos de Uso e a Política de Privacidade no formulário de cadastro, por meio de marcação obrigatória, e declara possuir registro ativo no conselho profissional (CREF). Os cadastros novos gravam a data, a hora e a versão dos termos diretamente na conta do gestor.',
      'Os cadastros realizados antes dessa gravação aparecem como “Sem registro”: o formulário já exigia o aceite, mas o momento exato não foi guardado. Nesses casos o documento informa somente a data de criação da conta, como referência, sem afirmar o horário do aceite.',
      'Contas criadas diretamente por um administrador também não possuem aceite registrado pelo próprio gestor.'
    ];
  }

  var NOTE_FINAL = 'Este documento reúne os registros de aceite armazenados na plataforma Trainly na data de sua geração. Os horários do aparelho dependem do relógio do dispositivo do usuário; o horário do servidor é o registro oficial, quando disponível. Os dados do aparelho (user-agent, idioma, fuso horário e tela) são informados pelo navegador e servem como indício complementar. O endereço IP não é coletado. O documento contém dados pessoais e deve ser tratado com confidencialidade, nos termos da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).';

  function personItems(r, kind) {
    var it = [{ k: 'Nome', v: r.name }];
    if (kind === 'aluno') {
      it.push({ k: 'Código de acesso', v: r.ref }, { k: 'Gestor vinculado', v: r.manager }, { k: 'ID do aluno', v: r.userId, mono: true });
    } else {
      it.push({ k: 'Usuário', v: r.ref });
      if (r.profType) it.push({ k: 'Tipo de profissional', v: r.profType === 'nutri' ? 'Nutricionista' : 'Personal / Educador físico' });
      if (r.cref) it.push({ k: 'Registro profissional', v: r.cref });
      it.push({ k: 'ID do gestor', v: r.userId, mono: true });
    }
    return it;
  }
  function acceptItems(r, kind) {
    var it = [{ k: 'Situação', v: statusLabel(r) }];
    if (r.status === 'accepted') {
      it.push({ k: 'Data e hora do aceite', v: fmtDT(r.acceptedAt) + ' (horário do aparelho)' });
      if (r.acceptedAtServer) it.push({ k: 'Horário do servidor', v: fmtDT(r.acceptedAtServer) + ' (registro oficial)' });
      it.push({ k: 'Versão aceita', v: r.version });
      if (r.hash) it.push({ k: 'Verificação SHA-256', v: r.hash, mono: true });
      if (r.method) it.push({ k: 'Forma de aceite', v: methodLabel(r.method) });
      if (r.consents) {
        var cs = [];
        if (r.consents.termsAndPrivacy) cs.push('Termos de Uso e Política de Privacidade: sim');
        if (r.consents.healthData) cs.push('Consentimento de dados de saúde e declaração de veracidade: sim');
        if (cs.length) it.push({ k: 'Confirmações marcadas', v: cs.join('\n') });
      }
    } else if (r.status === 'legacy') {
      it.push({ k: 'Aceite registrado', v: 'Não. Conta criada antes do registro de data e hora do aceite.' });
      it.push({ k: 'Conta criada em', v: fmtDT(r.createdAt) + ' (referência; não é o horário do aceite)' });
    } else {
      it.push({ k: 'Aceite registrado', v: 'Não. O aluno ainda não realizou o primeiro acesso.' });
      it.push({ k: 'Cadastro criado em', v: fmtDT(r.createdAt) });
    }
    return it;
  }
  function techItems(r) {
    if (r.status !== 'accepted') return [];
    var it = [{ k: 'Aparelho', v: deviceOf(r.ua) + (r.platform ? ' (' + r.platform + ')' : '') },
      { k: 'Idioma / fuso / tela', v: [r.language, r.timezone, r.screen].filter(Boolean).join('  |  ') || '-' }];
    if (r.ua) it.push({ k: 'User-agent', v: r.ua, mono: true });
    return it;
  }

  function termsVersionItems(t) {
    var it = [{ k: 'Versão vigente', v: t.version + (t.versionLabel ? ' (v' + t.versionLabel + ')' : '') }];
    if (t.effectiveDate) it.push({ k: 'Vigência a partir de', v: t.effectiveDate });
    if (t.hash) it.push({ k: 'Código de verificação (SHA-256)', v: t.hash, mono: true });
    return it;
  }

  function annexTerms(ctx, data) {
    var t = data.termsText; if (!t || !t.docs) return;
    ctx.newPage();
    ctx.h1('Anexo A – Texto integral dos termos', { full: true });
    ctx.para('Versão ' + t.version + (t.effectiveDate ? ', vigente desde ' + t.effectiveDate : '') + '. Conteúdo exibido para aceite nesta versão.', { after: 1 });
    t.docs.forEach(function (doc) {
      ctx.need(24);
      ctx.y += 2;
      ctx.para(String(doc.title).toUpperCase(), { style: 'bold', indent: 0, justify: false, after: 1 });
      doc.sections.forEach(function (s) {
        ctx.need(18);
        ctx.para(s.h, { size: 11, ls: 1.2, style: 'bold', indent: 0, justify: false, after: 0.8 });
        s.p.forEach(function (p) { ctx.para(String(p).replace(/\*\*(.+?)\*\*/g, '$1'), { size: 10.5, ls: 1.25, indent: 0, after: 1.4 }); });
        ctx.y += 1.2;
      });
    });
    if (t.consents) {
      ctx.need(20);
      ctx.y += 2;
      ctx.para('CONFIRMAÇÕES EXIBIDAS NA TELA DE ACEITE', { style: 'bold', indent: 0, justify: false, after: 1 });
      t.consents.forEach(function (c, i) { ctx.para((i + 1) + ') ' + c.label, { size: 10.5, ls: 1.25, indent: 0, after: 1.4 }); });
    }
  }

  // ======================================================================
  //  Documento coletivo
  // ======================================================================
  function coverCollective(ctx, data, who, now) {
    var d = ctx.doc, cx = ML + CW / 2, gb = data.generatedBy || {};
    ctx.font('bold', 14); d.text('TRAINLY', cx, 52, { align: 'center' });
    ctx.font('normal', 12); d.text('Plataforma de gestão de treinos', cx, 59, { align: 'center' });

    ctx.font('bold', 16);
    var tl = d.splitTextToSize('RELATÓRIO DE ACEITE DOS TERMOS DE USO E DA POLÍTICA DE PRIVACIDADE', CW), y = 118;
    tl.forEach(function (l) { d.text(clean(l), cx, y, { align: 'center' }); y += 8; });
    ctx.font('normal', 14); d.text('Relação de ' + who.plural, cx, y + 6, { align: 'center' });

    ctx.font('normal', 12);
    d.text('Gerado por: ' + clean((gb.name || gb.username || '-') + (gb.username && gb.name ? ' (' + gb.username + ')' : '')), cx, 232, { align: 'center' });
    d.text('Administrador grau 3 (A3)', cx, 239, { align: 'center' });
    d.text(clean(fmtLong(now) + ', às ' + fmtHM(now)), cx, 262, { align: 'center' });
  }

  function summaryRows(data) {
    var s = data.summary || {}, isAl = data.kind === 'aluno', rows = [];
    var pct = s.total ? Math.round(((s.accepted || 0) / s.total) * 100) : 0;
    rows.push(['Total de ' + whoOf(data.kind).plural, String(s.total || 0)]);
    rows.push(['Aceites registrados', String(s.accepted || 0)]);
    rows.push([isAl ? 'Aguardando o primeiro acesso' : 'Sem registro de aceite', String(isAl ? (s.pending || 0) : (s.legacy || 0))]);
    rows.push(['Taxa de aceite', pct + '% (' + (s.accepted || 0) + ' de ' + (s.total || 0) + ')']);
    var all = (data.rows || []).filter(function (r) { return r.acceptedAt; }).map(function (r) { return r.acceptedAt; });
    if (all.length) {
      rows.push(['Primeiro aceite registrado', fmtDT(Math.min.apply(null, all))]);
      rows.push(['Último aceite registrado', fmtDT(Math.max.apply(null, all))]);
    }
    var vers = {}; (data.rows || []).forEach(function (r) { if (r.version) vers[r.version] = (vers[r.version] || 0) + 1; });
    var vk = Object.keys(vers);
    if (vk.length) rows.push(['Versões aceitas', vk.map(function (k) { return k + ' (' + vers[k] + ')'; }).join('; ')]);
    return rows;
  }

  function bodyCollective(ctx, data, who, now) {
    var gb = data.generatedBy || {}, s = data.summary || {}, isAl = data.kind === 'aluno', rows = data.rows || [];

    ctx.h1('Introdução');
    ctx.para('Este documento registra o aceite dos Termos de Uso e da Política de Privacidade da plataforma Trainly pelos ' + who.plural + ' cadastrados, reunindo a situação, a data e a hora de cada aceite e a versão do texto aceito.');
    ctx.para('O relatório foi gerado em ' + fmtLong(now) + ', às ' + fmtHM(now) + (tzLabel() ? ' (' + tzLabel() + ')' : '') + ', por ' + (gb.name || gb.username || '-') + (gb.username && gb.name ? ' (' + gb.username + ')' : '') + ', Administrador grau 3 (A3). O escopo é restrito a ' + who.plural + '; alunos e gestores são relatados em documentos separados.');

    ctx.h1('Resumo geral');
    ctx.para('A Tabela 1 apresenta os indicadores consolidados do aceite dos termos na data de geração.', { after: 2 });
    ctx.tabTitle('Indicadores gerais do aceite dos termos – ' + who.plural);
    ctx.table([{ h: 'Indicador', w: 80 }, { h: 'Valor', w: CW - 80 }], summaryRows(data));
    ctx.fonte();
    if (isAl) ctx.para('Alunos anteriores (isentos): ' + (s.exempt == null ? 'não apurado' : s.exempt) + ' aluno(s) cadastrado(s) antes da exigência do aceite. Eles não visualizam a tela de termos e não constam neste relatório.');
    else if (s.legacy) ctx.para('Cadastros antigos: ' + s.legacy + ' gestor(es) cadastrado(s) antes do registro de data e hora do aceite. O formulário de cadastro já exigia a marcação dos termos, mas o momento exato não foi guardado.');

    ctx.h1('Forma de registro do aceite');
    methodParas(data.kind).forEach(function (t) { ctx.para(t); });
    if (data.termsText) {
      ctx.para('A Tabela 2 identifica a versão dos termos vigente na data de geração.', { after: 2 });
      ctx.tabTitle('Versão vigente dos termos');
      ctx.kvTable(termsVersionItems(data.termsText));
      ctx.fonte();
    }

    ctx.h1('Relação de ' + who.plural);
    if (!rows.length) { ctx.para('Nenhum registro para exibir.'); }
    else {
      ctx.para('A Tabela ' + (ctx.tab + 1) + ' lista os ' + who.plural + ' com a respectiva situação do aceite.', { after: 2 });
      ctx.tabTitle('Situação do aceite por ' + who.sing);
      var cols = isAl
        ? [{ h: 'Nome', w: 44 }, { h: 'Gestor', w: 32 }, { h: 'Situação', w: 22 }, { h: 'Data e hora do aceite', w: 36 }, { h: 'Versão', w: CW - 134 }]
        : [{ h: 'Nome', w: 44 }, { h: 'Usuário', w: 30 }, { h: 'Situação', w: 24 }, { h: 'Data e hora do aceite', w: 36 }, { h: 'Versão', w: CW - 134 }];
      ctx.table(cols, rows.map(function (r) {
        var when = r.status === 'accepted' ? fmtDT(r.acceptedAt) : r.status === 'legacy' ? 'Conta criada em ' + fmtD(r.createdAt) : '-';
        return [r.name, isAl ? r.manager : r.ref, statusLabel(r), when, r.version || '-'];
      }));
      ctx.fonte();

      ctx.h1('Comprovantes individuais');
      ctx.para('Os quadros a seguir apresentam os dados completos de cada registro, para fins de auditoria e de comprovação.', { after: 1 });
      rows.forEach(function (r, i) {
        ctx.h2(r.name || '-', { keep: 60, noNum: false });
        ctx.kvTable(personItems(r, data.kind).slice(1).concat(acceptItems(r, data.kind), techItems(r)));
        ctx.y += 4;
      });
    }

    ctx.h1('Observações');
    ctx.para(NOTE_FINAL);
  }

  function drawToc(ctx) {
    var d = ctx.doc, lh = 12 * 1.5 * PT, y = MT;
    d.setPage(2);
    ctx.font('bold', 12); d.text('SUMÁRIO', ML + CW / 2, y + lh / 2 + 12 * PT * 0.35, { align: 'center' });
    y += lh * 2;
    ctx.toc.forEach(function (e) {
      ctx.font('bold', 12);
      var pg = String(e.page), pw = d.getTextWidth(pg), lw = d.getTextWidth(e.label);
      var label = e.label;
      d.text(label, ML, y + lh / 2 + 12 * PT * 0.35);
      ctx.font('normal', 12);
      var dw = d.getTextWidth('.'), n = Math.max(0, Math.floor((CW - pw - lw - 6) / dw));
      if (n > 0) d.text(new Array(n + 1).join('.'), ML + CW - pw - 2 - n * dw, y + lh / 2 + 12 * PT * 0.35);
      ctx.font('bold', 12);
      d.text(pg, ML + CW, y + lh / 2 + 12 * PT * 0.35, { align: 'right' });
      y += lh;
    });
  }

  // ======================================================================
  //  Comprovante individual
  // ======================================================================
  function bodyIndividual(ctx, data, who, now) {
    var d = ctx.doc, gb = data.generatedBy || {}, r = data.rows[0], cx = ML + CW / 2;
    ctx.y = MT + 4;
    ctx.font('bold', 14);
    d.splitTextToSize('RELATÓRIO INDIVIDUAL DE ACEITE DOS TERMOS DE USO E DA POLÍTICA DE PRIVACIDADE', CW).forEach(function (l) { d.text(clean(l), cx, ctx.y + 5, { align: 'center' }); ctx.y += 6.6; });
    ctx.y += 3;
    ctx.font('normal', 12); d.text(clean(who.Plural.slice(0, -1) + ': ' + (r.name || '-')).slice(0, 80), cx, ctx.y + 4, { align: 'center' });
    ctx.y += 14;

    ctx.h1('Introdução');
    ctx.para('Este documento comprova a situação do aceite dos Termos de Uso e da Política de Privacidade da plataforma Trainly pelo ' + who.sing + ' identificado a seguir, na data de sua geração.');
    ctx.para('Foi gerado em ' + fmtLong(now) + ', às ' + fmtHM(now) + (tzLabel() ? ' (' + tzLabel() + ')' : '') + ', por ' + (gb.name || gb.username || '-') + (gb.username && gb.name ? ' (' + gb.username + ')' : '') + ', Administrador grau 3 (A3).');

    ctx.h1('Identificação');
    ctx.kvTable(personItems(r, data.kind));
    ctx.y += 4;

    ctx.h1('Registro do aceite');
    ctx.kvTable(acceptItems(r, data.kind));
    ctx.y += 4;

    var tech = techItems(r);
    if (tech.length) {
      ctx.h1('Dados técnicos do aparelho');
      ctx.kvTable(tech);
      ctx.y += 4;
    }

    if (data.termsText) {
      ctx.h1('Versão dos termos');
      ctx.kvTable(termsVersionItems(data.termsText));
      ctx.y += 4;
    }

    ctx.h1('Forma de registro do aceite');
    methodParas(data.kind).forEach(function (t) { ctx.para(t); });

    ctx.h1('Observações');
    ctx.para(NOTE_FINAL);
  }

  // ======================================================================
  //  Cabeçalho (logo + numeração) e rodapé, aplicados ao final em todas as páginas
  // ======================================================================
  function decorate(doc) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      try { doc.addImage(LOGO, 'PNG', ML, 9, LOGO_W, LOGO_H, undefined, 'FAST'); } catch (e) { /* sem logo, o documento segue válido */ }
      doc.setFont('times', 'normal'); doc.setTextColor(0, 0, 0);
      if (i > 1) { doc.setFontSize(10); doc.text(String(i), PW - MR, 16, { align: 'right' }); }
      doc.setFontSize(8);
      doc.text(clean('Documento confidencial. Contém dados pessoais (Lei nº 13.709/2018).'), ML + CW / 2, PH - 10, { align: 'center' });
    }
  }

  function build(data) {
    var TP = root.TrainlyPDF;
    if (!TP || !TP.ensureLibs) return Promise.reject(new Error('Gerador de PDF indisponível.'));
    return TP.ensureLibs(false).then(function () {
      var jsPDF = root.jspdf.jsPDF;
      var doc = new jsPDF({ unit: 'mm', format: 'a4' });
      var who = whoOf(data.kind), ctx = new Ctx(doc), now = Date.now(), indiv = !!data.individual;
      doc.setProperties({
        title: indiv ? 'Relatório individual de aceite dos termos – ' + clean((data.rows[0] || {}).name) : 'Relatório de aceite dos termos – ' + who.Plural,
        subject: 'Termos de Uso e Política de Privacidade', author: 'Trainly', creator: 'Trainly'
      });

      if (indiv) {
        bodyIndividual(ctx, data, who, now);
        annexTerms(ctx, data);
      } else {
        coverCollective(ctx, data, who, now);
        doc.addPage();                // página 2: sumário (preenchido ao final, com as páginas reais)
        doc.addPage(); ctx.y = MT;    // conteúdo começa na página 3
        bodyCollective(ctx, data, who, now);
        annexTerms(ctx, data);
        drawToc(ctx);
      }
      decorate(doc);

      var d = new Date(), stamp = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
      var fname;
      if (indiv) {
        var nm = TP.safeFileName ? TP.safeFileName((data.rows[0] || {}).name, 'registro') : 'registro';
        fname = 'aceite-termos-' + who.sing + '-' + String(nm).toLowerCase().replace(/\s+/g, '-') + '-' + stamp + '.pdf';
      } else {
        fname = 'aceite-termos-' + who.plural + '-' + stamp + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.pdf';
      }
      return { blob: doc.output('blob'), filename: fname, doc: doc };
    });
  }

  root.TrainlyTermsPDF = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
