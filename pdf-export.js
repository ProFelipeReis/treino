/* ============================================================================
 * TRAINLY — Geração de PDF das fichas, ZIP em lote e utilidades de WhatsApp
 * ----------------------------------------------------------------------------
 * Gera PDF de verdade (arquivo), sem depender de janela de impressão nem de
 * pop-up. Usa jsPDF e JSZip, carregados sob demanda da pasta vendor/.
 *
 *   TrainlyPDF.createPdf(nome, planos, opts)     -> documento jsPDF
 *   TrainlyPDF.pdfBlob(nome, planos, opts)       -> Promise<Blob>
 *   TrainlyPDF.exportAllToZip(opts)              -> Promise<{blob, filename, exported, skipped}>
 *   TrainlyPDF.safeFileName / clean / downloadBlob
 *   TrainlyShare.waNumber / waUrl / openWhatsApp
 * ========================================================================== */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ carregamento
  var _loading = {};
  function loadScript(src) {
    if (_loading[src]) return _loading[src];
    _loading[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { delete _loading[src]; reject(new Error('Não foi possível carregar ' + src)); };
      document.head.appendChild(s);
    });
    return _loading[src];
  }
  function ensureLibs(needZip) {
    var jobs = [];
    if (!(root.jspdf && root.jspdf.jsPDF)) jobs.push(loadScript('vendor/jspdf.umd.min.js'));
    if (needZip && !root.JSZip) jobs.push(loadScript('vendor/jszip.min.js'));
    return Promise.all(jobs).then(function () {
      if (!(root.jspdf && root.jspdf.jsPDF)) throw new Error('Biblioteca de PDF indisponível.');
      if (needZip && !root.JSZip) throw new Error('Biblioteca de ZIP indisponível.');
    });
  }

  // ------------------------------------------------------------ texto seguro
  // As fontes padrão do PDF cobrem Latin-1 (acentos do português). Símbolos e
  // emojis fora disso seriam impressos como lixo: trocamos ou removemos.
  function clean(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFC'); } catch (e) { }
    s = s.replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u2022\u25CF]/g, '-')
      .replace(/\u2192/g, '->')
      .replace(/[\u00A0\u2009\u202F]/g, ' ')
      .replace(/[\u200B-\u200F\u2060\uFE00-\uFE0F]/g, '')
      .replace(/[^\x20-\x7E\xA1-\xFF\n]/g, '');
    return s.replace(/[ \t]+/g, ' ').trim();
  }

  function safeFileName(name, fallback) {
    var s = String(name == null ? '' : name);
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
    s = s.replace(/[^A-Za-z0-9 _.\-]/g, '').replace(/\s+/g, ' ').replace(/^[. ]+|[. ]+$/g, '').slice(0, 60).trim();
    return s || fallback || 'aluno';
  }

  function fmtLong(iso) {
    if (!iso) return '';
    var d = new Date(String(iso) + 'T12:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function fmtShort(iso) {
    if (!iso) return '';
    var d = new Date(String(iso) + 'T12:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function todayLong() {
    return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // ------------------------------------------------------------ layout do PDF
  var DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var PW = 210, PH = 297, M = 15, CW = PW - 2 * M, BOTTOM = PH - 20;
  var C = {
    ink: [17, 17, 16], mute: [136, 136, 128], soft: [247, 247, 245], line: [228, 228, 224],
    yellow: [245, 200, 0], green: [46, 125, 82], greenBg: [240, 250, 244], greenLine: [190, 225, 203],
    red: [224, 62, 62], redBg: [254, 242, 242], redLine: [254, 202, 202]
  };
  // colunas da tabela
  var X_NUM = M + 3, X_NAME = M + 14, W_NAME = 112, X_SER = M + 142, X_REPS = M + 163;

  function defaultStatus(p) {
    var today = new Date().toISOString().slice(0, 10);
    if (p.expiry && p.expiry < today) return 'expired';
    if (p.startDate && p.startDate > today) return 'upcoming';
    return 'active';
  }

  function repsText(ex) {
    var arr = Array.isArray(ex.repsArr) ? ex.repsArr
      : (ex.reps ? String(ex.reps).split(',').map(function (s) { return s.trim(); }) : [ex.reps || '']);
    var uniq = arr.filter(function (v, i) { return arr.indexOf(v) === i; });
    return clean(uniq.length === 1 ? uniq[0] : arr.join(' / '));
  }
  function tagsOf(ex) {
    var t = [];
    if (ex.biset) t.push('Bi-set: ' + ex.biset);
    if (ex.unilateral) t.push('Unilateral');
    if (ex.isometria) t.push('Isometria' + (ex.isometriaSegs ? ' ' + ex.isometriaSegs + 's' : ''));
    if (ex.restPause) t.push('Rest-pause');
    if (ex.dropSet) t.push('Drop-set');
    return t.map(clean).filter(Boolean).join('  |  ');
  }

  function Page(doc, studentName, planTitle) {
    this.doc = doc; this.y = M; this.studentName = studentName; this.planTitle = planTitle;
  }
  Page.prototype.newPage = function (running) {
    this.doc.addPage(); this.y = M;
    if (running) {
      var d = this.doc;
      d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor.apply(d, C.mute);
      d.text(clean('Trainly  |  ' + this.studentName + '  |  ' + this.planTitle), M, this.y + 2);
      this.y += 8;
    }
  };
  Page.prototype.ensure = function (h, running) {
    if (this.y + h > BOTTOM) { this.newPage(running !== false); return true; }
    return false;
  };

  function drawTableHead(pg) {
    var d = pg.doc;
    d.setFont('helvetica', 'bold'); d.setFontSize(7); d.setTextColor.apply(d, C.mute);
    d.text('#', X_NUM, pg.y + 4.6);
    d.text('EXERCÍCIO', X_NAME, pg.y + 4.6);
    d.text('SÉRIES', X_SER, pg.y + 4.6, { align: 'center' });
    d.text('REPS', X_REPS, pg.y + 4.6, { align: 'center' });
    d.setDrawColor.apply(d, C.line); d.setLineWidth(0.3);
    d.line(M, pg.y + 7, M + CW, pg.y + 7);
    pg.y += 7;
  }

  function drawBlockHeader(pg, letter, title, days, count, cont) {
    var d = pg.doc, h = 13;
    d.setFillColor.apply(d, C.soft); d.setDrawColor.apply(d, C.line); d.setLineWidth(0.3);
    d.roundedRect(M, pg.y, CW, h, 2, 2, 'FD');
    d.setFillColor.apply(d, C.yellow);
    d.roundedRect(M + 3, pg.y + 2, 9, 9, 1.8, 1.8, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(10); d.setTextColor.apply(d, C.ink);
    d.text(letter, M + 7.5, pg.y + 8.2, { align: 'center' });
    d.setFontSize(10.5);
    var t = clean(title) + (cont ? ' (continuação)' : '');
    d.text(d.splitTextToSize(t, 100)[0], M + 15, pg.y + 6);
    d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor.apply(d, C.mute);
    d.text(clean(days), M + 15, pg.y + 10.3);
    d.setFontSize(8);
    d.text(count + (count === 1 ? ' exercício' : ' exercícios'), M + CW - 3, pg.y + 7.4, { align: 'right' });
    pg.y += h;
  }

  function rowLayout(d, ex) {
    d.setFont('helvetica', 'bold'); d.setFontSize(9.5);
    var nameLines = d.splitTextToSize(clean(ex.name) || '(sem nome)', W_NAME);
    var tags = tagsOf(ex), tagLines = [], obsLines = [];
    d.setFont('helvetica', 'normal'); d.setFontSize(7.5);
    if (tags) tagLines = d.splitTextToSize(tags, W_NAME);
    var obs = clean(ex.obs);
    if (obs) { d.setFont('helvetica', 'italic'); obsLines = d.splitTextToSize(obs, W_NAME); }
    d.setFont('helvetica', 'normal'); d.setFontSize(9.5);
    var repsLines = d.splitTextToSize(repsText(ex), 30);
    var h = 3 + nameLines.length * 4.4 + tagLines.length * 3.5 + obsLines.length * 3.5 + 3;
    h = Math.max(h, 3 + repsLines.length * 4.4 + 3, 9);
    return { nameLines: nameLines, tagLines: tagLines, obsLines: obsLines, repsLines: repsLines, h: h };
  }

  function drawRow(pg, ex, idx, L) {
    var d = pg.doc, y0 = pg.y, y = y0 + 3 + 3.2;
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.setTextColor.apply(d, C.mute);
    d.text(String(idx + 1), X_NUM, y);
    d.setFontSize(9.5); d.setTextColor.apply(d, C.ink);
    L.nameLines.forEach(function (ln) { d.text(ln, X_NAME, y); y += 4.4; });
    y -= 4.4 - 3.4;
    if (L.tagLines.length) {
      d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor.apply(d, C.mute);
      L.tagLines.forEach(function (ln) { d.text(ln, X_NAME, y); y += 3.5; });
    }
    if (L.obsLines.length) {
      d.setFont('helvetica', 'italic'); d.setFontSize(7.5); d.setTextColor(110, 110, 104);
      L.obsLines.forEach(function (ln) { d.text(ln, X_NAME, y); y += 3.5; });
    }
    d.setFont('helvetica', 'bold'); d.setFontSize(9.5); d.setTextColor.apply(d, C.ink);
    d.text(clean(ex.series == null ? '' : ex.series), X_SER, y0 + 3 + 3.2, { align: 'center' });
    d.setFont('helvetica', 'normal');
    var ry = y0 + 3 + 3.2;
    L.repsLines.forEach(function (ln) { d.text(ln, X_REPS, ry, { align: 'center' }); ry += 4.4; });
    d.setDrawColor.apply(d, C.line); d.setLineWidth(0.2);
    d.line(M, y0 + L.h, M + CW, y0 + L.h);
    pg.y += L.h;
  }

  function drawPlanHeader(pg, studentName, plan, status) {
    var d = pg.doc, expired = status === 'expired';
    var start = fmtShort(plan.startDate), exp = fmtShort(plan.expiry);
    var period = start && plan.expiry ? start + ' a ' + exp : start ? 'Início: ' + start
      : plan.expiry ? 'Vence em: ' + exp : 'Sem data definida';
    if (plan.expiry && !start) period = 'Vence em: ' + exp;
    var top = pg.y;

    d.setFont('helvetica', 'bold'); d.setFontSize(8); d.setTextColor.apply(d, C.mute);
    d.text('TRAINLY', M, top + 3);
    d.setFontSize(20); d.setTextColor.apply(d, C.ink);
    var nl = d.splitTextToSize(clean(studentName) || 'Aluno', 105);
    var y = top + 11;
    nl.slice(0, 2).forEach(function (ln) { d.text(ln, M, y); y += 8; });
    d.setFont('helvetica', 'bold'); d.setFontSize(11); d.setTextColor(85, 85, 80);
    var tl = d.splitTextToSize(clean(plan.title) || 'Ficha de treino', 105);
    tl.slice(0, 2).forEach(function (ln) { d.text(ln, M, y); y += 5.2; });

    var rx = M + CW;
    d.setFontSize(7); d.setTextColor.apply(d, C.mute);
    d.text('VALIDADE', rx, top + 3, { align: 'right' });
    d.setFontSize(10); d.setTextColor.apply(d, expired ? C.red : C.green);
    var pl = d.splitTextToSize(clean(period) + (expired ? ' (vencido)' : ''), 70);
    var py = top + 8.5;
    pl.forEach(function (ln) { d.text(ln, rx, py, { align: 'right' }); py += 4.6; });
    d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor(170, 170, 165);
    d.text('Gerado em ' + todayLong(), rx, Math.max(py + 1, top + 16), { align: 'right' });

    y = Math.max(y, py + 4) + 1;
    d.setDrawColor.apply(d, C.ink); d.setLineWidth(0.7);
    d.line(M, y, M + CW, y);
    y += 6;

    d.setFillColor.apply(d, expired ? C.redBg : C.greenBg);
    d.setDrawColor.apply(d, expired ? C.redLine : C.greenLine); d.setLineWidth(0.3);
    d.roundedRect(M, y, CW, 9, 2, 2, 'FD');
    d.setFillColor.apply(d, expired ? C.red : C.green);
    d.circle(M + 5, y + 4.5, 1.1, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.setTextColor.apply(d, expired ? C.red : C.green);
    d.text(expired ? 'Plano vencido - solicite uma atualização ao treinador'
      : status === 'upcoming' ? 'Plano ainda não iniciado' : 'Plano ativo', M + 9, y + 5.7);
    pg.y = y + 9 + 7;
  }

  function drawPlan(pg, studentName, plan, status) {
    drawPlanHeader(pg, studentName, plan, status);
    var workouts = plan.workouts || [];
    if (!workouts.length) {
      var d0 = pg.doc;
      d0.setFont('helvetica', 'italic'); d0.setFontSize(10); d0.setTextColor.apply(d0, C.mute);
      d0.text('Nenhum treino cadastrado neste plano.', M, pg.y + 4);
      pg.y += 10;
      return;
    }
    workouts.forEach(function (w, wi) {
      var d = pg.doc;
      var letter = String.fromCharCode(65 + (wi % 26));
      var title = w.title || ('Treino ' + (wi + 1));
      var days = (w.days || []).map(function (n) { return DAYS[n]; }).filter(Boolean).join(', ') || 'Sem dias definidos';
      var exs = w.exercises || [];
      var layouts = exs.map(function (ex) { return rowLayout(d, ex); });
      var firstH = layouts.length ? layouts[0].h : 9;
      pg.ensure(13 + 7 + firstH + 2);
      drawBlockHeader(pg, letter, title, days, exs.length, false);
      drawTableHead(pg);
      if (!exs.length) {
        d.setFont('helvetica', 'italic'); d.setFontSize(9); d.setTextColor.apply(d, C.mute);
        d.text('Nenhum exercício cadastrado.', X_NAME, pg.y + 6);
        pg.y += 10;
      }
      exs.forEach(function (ex, ei) {
        var L = layouts[ei];
        if (pg.y + L.h > BOTTOM) {
          pg.newPage(true);
          drawBlockHeader(pg, letter, title, days, exs.length, true);
          drawTableHead(pg);
        }
        drawRow(pg, ex, ei, L);
      });
      pg.y += 8;
      if (pg.y > BOTTOM - 20) pg.newPage(true);
    });
  }

  function drawFooters(doc) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor.apply(doc, C.line); doc.setLineWidth(0.3);
      doc.line(M, PH - 13, M + CW, PH - 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(170, 170, 165);
      doc.text('Trainly  |  Ficha gerada automaticamente', M, PH - 8);
      doc.text('Página ' + i + ' de ' + n, M + CW, PH - 8, { align: 'right' });
    }
  }

  /** Cria o PDF (um plano por página inicial). Exige jsPDF já carregado. */
  function createPdf(studentName, plans, opts) {
    opts = opts || {};
    var jsPDF = root.jspdf && root.jspdf.jsPDF;
    if (!jsPDF) throw new Error('Biblioteca de PDF não carregada.');
    var getStatus = opts.getPlanStatus || defaultStatus;
    var list = (plans || []).filter(Boolean);
    var doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({
      title: clean('Ficha de Treino - ' + studentName),
      subject: 'Ficha de treino', creator: 'Trainly', author: 'Trainly'
    });
    if (!list.length) {
      var pg0 = new Page(doc, studentName, '');
      drawPlan(pg0, studentName, { title: 'Sem plano', workouts: [] }, 'active');
    }
    list.forEach(function (plan, i) {
      if (i > 0) doc.addPage();
      var pg = new Page(doc, studentName, plan.title || '');
      drawPlan(pg, studentName, plan, getStatus(plan));
    });
    drawFooters(doc);
    return doc;
  }

  function pdfBlob(studentName, plans, opts) {
    return ensureLibs(false).then(function () {
      return createPdf(studentName, plans, opts).output('blob');
    });
  }

  // ------------------------------------------------------------ download
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) { } }, 20000);
  }

  // ------------------------------------------------------------ ZIP em lote
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var ORDER = { active: 0, upcoming: 1, expired: 2 };

  function exportAllToZip(opts) {
    var students = opts.students || [];
    var getStatus = opts.getPlanStatus || defaultStatus;
    var onProgress = opts.onProgress || function () { };
    var isCancelled = opts.isCancelled || function () { return false; };
    var includeExpired = !!opts.includeExpired;
    var outType = opts.outputType || 'blob';
    var exported = [], skipped = [], used = {};

    return ensureLibs(true).then(function () {
      onProgress({ phase: 'fetch', done: 0, total: students.length });
      return opts.fetchPlans(students.map(function (s) { return s.id; }));
    }).then(function (found) {
      var get = function (id) { return found instanceof Map ? found.get(id) : (found || {})[id]; };
      var zip = new root.JSZip();
      var chain = Promise.resolve();
      students.forEach(function (s, i) {
        chain = chain.then(function () {
          if (isCancelled()) { var e = new Error('CANCELLED'); e.code = 'CANCELLED'; throw e; }
          var all = (get(s.id) || []).slice();
          var plans = all.filter(function (p) { return includeExpired || getStatus(p) !== 'expired'; });
          plans.sort(function (a, b) {
            var d = ORDER[getStatus(a)] - ORDER[getStatus(b)];
            return d || ((b.createdAt || 0) - (a.createdAt || 0));
          });
          if (!plans.length) {
            skipped.push({ name: s.name || '(sem nome)', reason: all.length ? 'só tem planos vencidos' : 'sem plano' });
          } else {
            var base = safeFileName(s.name, 'aluno'), fn = base, n = 2;
            while (used[fn.toLowerCase()]) fn = base + ' (' + (n++) + ')';
            used[fn.toLowerCase()] = true;
            var doc = createPdf(s.name || 'Aluno', plans, { getPlanStatus: getStatus });
            zip.file(fn + '.pdf', doc.output('arraybuffer'));
            exported.push({ name: s.name || '(sem nome)', file: fn + '.pdf', plans: plans.length });
          }
          onProgress({ phase: 'pdf', done: i + 1, total: students.length, name: s.name || '' });
          return tick();
        });
      });
      return chain.then(function () {
        if (!exported.length) { var e = new Error('NO_PLANS'); e.code = 'NO_PLANS'; e.skipped = skipped; throw e; }
        var lines = [
          'Treinos exportados pelo Trainly em ' + new Date().toLocaleString('pt-BR'),
          '',
          'Alunos com PDF: ' + exported.length,
          'Alunos sem PDF: ' + skipped.length,
          includeExpired ? 'Planos vencidos: incluídos' : 'Planos vencidos: não incluídos',
          ''
        ];
        if (skipped.length) {
          lines.push('Alunos sem PDF:');
          skipped.forEach(function (x) { lines.push(' - ' + x.name + ' (' + x.reason + ')'); });
        }
        zip.file('LEIA-ME.txt', lines.join('\r\n'));
        return zip.generateAsync({ type: outType, compression: 'DEFLATE', compressionOptions: { level: 6 } }, function (m) {
          onProgress({ phase: 'zip', percent: Math.round(m.percent) });
        });
      });
    }).then(function (out) {
      var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
      return {
        blob: out, exported: exported, skipped: skipped,
        filename: 'treinos-trainly-' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '.zip'
      };
    });
  }

  root.TrainlyPDF = {
    clean: clean, safeFileName: safeFileName, ensureLibs: ensureLibs,
    createPdf: createPdf, pdfBlob: pdfBlob, downloadBlob: downloadBlob, exportAllToZip: exportAllToZip
  };

  // ============================================================== WhatsApp
  /** Telefone brasileiro (ou internacional com DDI) -> só dígitos para wa.me. '' se inválido. */
  function waNumber(phone) {
    var d = String(phone == null ? '' : phone).replace(/\D/g, '').replace(/^0+/, '');
    if (d.length === 10 || d.length === 11) return '55' + d;      // DDD + número
    if (d.length >= 12 && d.length <= 15) return d;               // já com código do país
    return '';
  }
  function waUrl(num, text) {
    return 'https://wa.me/' + (num || '') + '?text=' + encodeURIComponent(text || '');
  }
  // redirectIfBlocked (padrão true): se o navegador bloquear o pop-up, navega nesta aba.
  // Use false depois de operações assíncronas, para não tirar a pessoa do painel.
  function openWhatsApp(num, text, redirectIfBlocked) {
    var url = waUrl(num, text);
    var w = null;
    try { w = root.open(url, '_blank'); } catch (e) { }
    if (w) { try { w.opener = null; } catch (e) { } return true; }
    if (redirectIfBlocked !== false) root.location.href = url;
    return false;
  }
  root.TrainlyShare = { waNumber: waNumber, waUrl: waUrl, openWhatsApp: openWhatsApp };
})(typeof window !== 'undefined' ? window : globalThis);
