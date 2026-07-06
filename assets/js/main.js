/* STORM Lab UK — site behaviour
   Nav toggle, research filters, and the brand canvas animations
   (ported from the design system's React canvases). All animation respects
   prefers-reduced-motion and degrades to nothing if JS/canvas is unavailable. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Mobile nav ────────────────────────────────────────────────────────────
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ── Research filter pills ───────────────────────────────────────────────────
  var filters = document.querySelectorAll('.filter');
  if (filters.length) {
    var cards = document.querySelectorAll('.grant[data-area]');
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var f = btn.getAttribute('data-filter');
        cards.forEach(function (c) {
          c.style.display = (f === 'All' || c.getAttribute('data-area') === f) ? '' : 'none';
        });
      });
    });
  }

  // ── Contact enquiry form (AJAX submit → inline thank-you) ────────────────────
  var eForm = document.getElementById('enquiry-form');
  if (eForm && eForm.dataset.ajax === 'true') {
    var thanks = document.getElementById('enquiry-thanks');
    var resetBtn = document.getElementById('enquiry-reset');
    eForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = eForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      fetch(eForm.action, { method: 'POST', body: new FormData(eForm), headers: { 'Accept': 'application/json' } })
        .then(function (res) {
          if (res.ok) { eForm.hidden = true; if (thanks) thanks.hidden = false; }
          else { throw new Error('bad status'); }
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'Send enquiry'; }
          alert('Something went wrong sending your enquiry — please email us directly instead.');
        });
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (thanks) thanks.hidden = true;
      eForm.hidden = false; eForm.reset();
      var btn = eForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.textContent = 'Send enquiry'; }
    });
  }

  // ── Canvas helpers ──────────────────────────────────────────────────────────
  var INK = '#1E1E1E', GREY = '#C2C2C2', FAINT = '#E7E7E7', YELLOW = '#F8CD04';

  function fitCanvas(c) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight || 200;
    c.width = w * dpr; c.height = h * dpr;
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function drawManip(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    var cx = w * 0.30, cy = h / 2;
    ctx.fillStyle = YELLOW; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - 46, cy - 16, 30, 32, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '600 11px "Space Mono", monospace';
    ctx.fillText('N', cx - 40, cy + 4); ctx.fillText('S', cx - 28, cy + 4);
    for (var i = 1; i <= 5; i++) {
      var spread = i * 26;
      ctx.beginPath();
      ctx.strokeStyle = i === 2 ? YELLOW : GREY;
      ctx.lineWidth = i === 2 ? 2 : 1;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -t * 0.04 * (1 + i * 0.1);
      ctx.moveTo(cx - 20, cy);
      ctx.bezierCurveTo(cx - 20 + spread, cy - spread, cx + 90 + spread * 0.6, cy - spread, cx + 130, cy);
      ctx.bezierCurveTo(cx + 90 + spread * 0.6, cy + spread, cx - 20 + spread, cy + spread, cx - 20, cy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    var px = cx + 80 + Math.sin(t * 0.0014) * 42;
    var py = cy + Math.cos(t * 0.0014) * 4;
    ctx.save(); ctx.translate(px, py);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-15, -7, 30, 14, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(9, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawLoc(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = FAINT;
    for (var x = 24; x < w - 10; x += 26) for (var y = 24; y < h - 10; y += 26) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    var tx = w / 2 + Math.sin(t * 0.0011) * (w * 0.26);
    var ty = h / 2 + Math.sin(t * 0.0017 + 1) * (h * 0.24);
    ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(tx, 8); ctx.lineTo(tx, h - 8); ctx.moveTo(8, ty); ctx.lineTo(w - 8, ty); ctx.stroke();
    ctx.setLineDash([]);
    for (var k = 0; k < 3; k++) {
      var phase = ((t * 0.0006 + k / 3) % 1);
      var r = phase * 46;
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.strokeStyle = YELLOW; ctx.globalAlpha = 1 - phase; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = YELLOW; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '500 10px "Space Mono", monospace';
    var xmm = ((tx - w / 2) / w * 60).toFixed(1), ymm = ((ty - h / 2) / h * 40).toFixed(1);
    ctx.fillText('x ' + xmm + '  y ' + ymm + ' mm', 14, h - 14);
  }

  function drawSoft(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    var baseX = 30, baseY = h / 2, segs = 60, len = w - 70;
    ctx.lineCap = 'round';
    var prevX = baseX, prevY = baseY, tipX = baseX, tipY = baseY;
    for (var i = 0; i <= segs; i++) {
      var s = i / segs;
      var x = baseX + s * len;
      var amp = 26 * s;
      var y = baseY + Math.sin(s * 3.0 - t * 0.0022) * amp;
      if (i > 0) {
        ctx.beginPath(); ctx.strokeStyle = INK; ctx.lineWidth = 13 * (1 - s) + 2.5;
        ctx.moveTo(prevX, prevY); ctx.lineTo(x, y); ctx.stroke();
      }
      prevX = x; prevY = y; tipX = x; tipY = y;
    }
    ctx.fillStyle = GREY; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(baseX - 18, baseY - 16, 16, 32, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = YELLOW; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tipX, tipY, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  var drawers = { manip: drawManip, loc: drawLoc, soft: drawSoft };

  document.querySelectorAll('canvas.storm-anim').forEach(function (c) {
    if (!c.getContext || !c.getContext('2d').roundRect) return; // graceful no-op on old engines
    var dim = fitCanvas(c);
    var fn = drawers[c.getAttribute('data-anim')] || drawManip;
    if (reduce) { fn(dim.ctx, dim.w, dim.h, 1200); return; }
    var raf;
    (function frame(t) { fn(dim.ctx, dim.w, dim.h, t); raf = requestAnimationFrame(frame); })(0);
    window.addEventListener('resize', function () { dim = fitCanvas(c); });
  });

  // ── Tentacle hero (research detail) ──────────────────────────────────────────
  var hero = document.getElementById('tentacle-hero');
  if (hero && hero.getContext) {
    var ctx = hero.getContext('2d');
    function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function resize() {
      var r = hero.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      hero.width = Math.max(1, r.width * dpr); hero.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    var t = 0, N = 96, raf2;
    function draw() {
      var W = hero.clientWidth, H = hero.clientHeight;
      ctx.clearRect(0, 0, W, H);
      var baseX = W * 0.06, baseY = H * 0.52, len = Math.min(W * 0.82, 1120);
      var mt = t * 0.00075;
      var magX = baseX + len * 0.96 + Math.cos(mt) * 40;
      var magY = baseY + Math.sin(mt) * (H * 0.20);
      var pts = [];
      for (var i = 0; i <= N; i++) {
        var u = i / N, x = baseX + len * u;
        var bend = (magY - baseY) * Math.pow(u, 1.7);
        var wave = Math.sin(u * 5.5 - t * 0.0035) * (1 - u) * 30;
        pts.push([x, baseY + bend * 0.62 + wave, u]);
      }
      for (var k = 1; k <= 4; k++) {
        var rrad = 26 + k * 26 + Math.sin(t * 0.002 + k) * 4;
        ctx.beginPath(); ctx.strokeStyle = 'rgba(239,202,10,' + (0.12 - k * 0.02) + ')'; ctx.lineWidth = 1.2;
        ctx.ellipse(magX, magY, rrad * 1.15, rrad, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.28)'; ctx.shadowBlur = 16;
      for (var j = 0; j < pts.length - 1; j++) {
        var a = pts[j], b = pts[j + 1], wd = 20 * (1 - a[2]) + 2.4;
        ctx.beginPath(); ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 + 0.55 * (1 - a[2])) + ')'; ctx.lineWidth = wd;
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
      for (var m = 6; m <= N - 4; m += 9) {
        var p = pts[m];
        ctx.beginPath(); ctx.fillStyle = 'rgba(10,10,10,1)'; ctx.arc(p[0], p[1], 9 * (1 - p[2]) + 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      }
      var tip = pts[N], prev = pts[N - 6], ang = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
      ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(ang);
      ctx.beginPath(); ctx.fillStyle = '#EFCA0A'; ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle = 'rgba(239,202,10,0.9)'; ctx.lineWidth = 2; ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(120,120,120,0.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(magX + 30, magY); ctx.lineTo(W + 40, magY - 40); ctx.stroke();
      ctx.fillStyle = '#EFCA0A'; rr(ctx, magX - 13, magY - 13, 26, 26, 5); ctx.fill();
      ctx.fillStyle = '#0A0A0A'; ctx.font = '600 10px "Space Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', magX, magY); ctx.restore();
      t += 16;
      if (!reduce) raf2 = requestAnimationFrame(draw);
    }
    draw();
  }
})();
