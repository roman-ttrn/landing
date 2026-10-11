/* =====================================================================
   ЖИВАЯ СЕТКА НА ФОНЕ
   Сетка ведёт себя как ткань: точки под курсором растягиваются
   и прогибаются, потом пружинно возвращаются на место.
   ===================================================================== */
(function () {
  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var GAP = 46;              // шаг сетки
  var RADIUS = 190;          // радиус влияния курсора
  var PUSH = 34;             // насколько сильно прогибает
  var cols = 0, rows = 0;
  var nodes = [];

  var pointer = { x: -9999, y: -9999, active: false };
  var scrollY = 0;

  var LINE = '231,233,238';  // цвет линий сетки
  var DOT  = '180,186,197';  // цвет точек

  function build() {
    cols = Math.ceil(W / GAP) + 1;
    rows = Math.ceil(H / GAP) + 1;
    nodes = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = c * GAP;
        var y = r * GAP;
        nodes.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0 });
      }
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function index(c, r) { return r * cols + c; }

  function step() {
    ctx.clearRect(0, 0, W, H);

    // сдвиг сетки при прокрутке (лёгкий параллакс)
    var offsetY = (-scrollY * 0.06) % GAP;
    var mx = pointer.x;
    var my = pointer.y;

    // --- физика: прогиб от курсора + пружина ---
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var tx = n.hx;
      var ty = n.hy + offsetY;

      if (pointer.active && !reduce) {
        var dx = tx - mx;
        var dy = ty - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < RADIUS * RADIUS && d2 > 0.001) {
          var d = Math.sqrt(d2);
          var force = (1 - d / RADIUS);
          force = force * force * PUSH;
          tx += (dx / d) * force;
          ty += (dy / d) * force;
        }
      }

      if (reduce) {
        n.x = tx; n.y = ty; n.vx = 0; n.vy = 0;
      } else {
        // пружина к целевой точке
        n.vx += (tx - n.x) * 0.09;
        n.vy += (ty - n.y) * 0.09;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    // --- рисуем сетку ---
    ctx.lineWidth = 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var a = nodes[index(c, r)];
        // линия вправо
        if (c < cols - 1) {
          var b = nodes[index(c + 1, r)];
          var stretch = Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / (GAP * 2.2));
          var alpha = 0.5 + stretch * 0.5;
          ctx.strokeStyle = 'rgba(' + LINE + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        // линия вниз
        if (r < rows - 1) {
          var d2 = nodes[index(c, r + 1)];
          var st2 = Math.min(1, Math.hypot(d2.x - a.x, d2.y - a.y) / (GAP * 2.2));
          var al2 = 0.5 + st2 * 0.5;
          ctx.strokeStyle = 'rgba(' + LINE + ',' + al2.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(d2.x, d2.y);
          ctx.stroke();
        }
      }
    }

    // --- точки в узлах (видны только рядом с курсором) ---
    if (pointer.active) {
      for (var k = 0; k < nodes.length; k++) {
        var nd = nodes[k];
        var ddx = nd.x - mx, ddy = nd.y - my;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd < RADIUS) {
          var t = 1 - dd / RADIUS;
          ctx.fillStyle = 'rgba(' + DOT + ',' + (t * 0.55).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, 1.6 + t * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    raf = requestAnimationFrame(step);
  }

  var raf = null;

  function start() { if (raf === null) raf = requestAnimationFrame(step); }
  function stop()  { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });

  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  }, { passive: true });

  window.addEventListener('pointerleave', function () { pointer.active = false; });
  window.addEventListener('blur', function () { pointer.active = false; });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  resize();
  start();
})();

/* =====================================================================
   ПОЯВЛЕНИЕ БЛОКОВ ПРИ ПРОКРУТКЕ
   ===================================================================== */
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        // небольшой каскад для соседей
        var delay = parseInt(en.target.dataset.delay || '0', 10);
        setTimeout(function () { en.target.classList.add('in'); }, delay);
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(function (el, i) { io.observe(el); });
})();

/* =====================================================================
   ВИДЕО: если файл добавлен — играем на месте.
   Пока файла нет — мягкий отклик на клик (заглушка).
   ===================================================================== */
(function () {
  document.querySelectorAll('.video-frame').forEach(function (f) {
    var src = f.dataset.src;

    if (!src) {
      // Заглушка: файл ещё не добавлен
      f.addEventListener('click', function () {
        f.classList.add('pulse');
        setTimeout(function () { f.classList.remove('pulse'); }, 450);
      });
      return;
    }

    // Есть файл — по клику подменяем блок на <video>
    f.addEventListener('click', function onClick() {
      f.removeEventListener('click', onClick);
      f.classList.remove('pulse');
      f.style.cursor = 'default';

      var v = document.createElement('video');
      v.src = src;
      if (f.dataset.poster) v.poster = f.dataset.poster;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.loop = true;
      v.muted = true;          // без звука
      v.defaultMuted = true;
      v.volume = 0;

      f.innerHTML = '';
      f.appendChild(v);
      v.play().catch(function () { /* автоплей может быть заблокирован — не беда, есть controls */ });
    });
  });
})();

/* =====================================================================
   ЛОГО DJANGO — статичное, без интерактива.
   (Раньше здесь было стирание курсором — убрано намеренно.)
   ===================================================================== */
