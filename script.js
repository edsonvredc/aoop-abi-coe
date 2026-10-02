/* Modelo Operacional ServiceNow — navegação em slides */
(() => {
  const body = document.body;
  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  /* ---------- Sidebar: recolher (desktop) / gaveta (mobile) ---------- */
  const saved = store.get('snow-om-sb');
  if (saved === '1' || (saved === null && window.innerWidth < 1280)) body.classList.add('sb-collapsed');

  document.getElementById('collapseBtn').addEventListener('click', () => {
    const collapsed = body.classList.toggle('sb-collapsed');
    store.set('snow-om-sb', collapsed ? '1' : '0');
  });

  const closeMenu = () => body.classList.remove('menu-open');
  document.getElementById('menuOpen').addEventListener('click', () => body.classList.add('menu-open'));
  document.getElementById('menuClose').addEventListener('click', closeMenu);
  document.getElementById('scrim').addEventListener('click', closeMenu);

  /* ---------- Conectores dos diagramas ----------
     data-wires="a>b|flags,..."  flags: v = desce na vertical a partir da origem, d = tracejado */
  const wireBoxes = [...document.querySelectorAll('[data-wires]')];
  const glowIn = new Set([document.querySelector('.model')]);

  function drawWires(box) {
    const svg = box.querySelector(':scope > svg.wires');
    if (!svg) return;
    if (getComputedStyle(svg).display === 'none') { svg.innerHTML = ''; return; }

    const b = box.getBoundingClientRect();
    if (!b.width) return;
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
    };

    let out = '';
    box.dataset.wires.split(',').forEach((spec) => {
      const [pair, flags = ''] = spec.trim().split('|');
      const [from, to] = pair.split('>');
      const A = box.querySelector(`[data-node="${from}"]`);
      const B = box.querySelector(`[data-node="${to}"]`);
      if (!A || !B) return;

      // Mede o elemento visível dentro de nós "wrapper" (ex.: a pílula de Governança).
      const aEl = A.classList.contains('model-gov') && A.firstElementChild ? A.firstElementChild : A;
      const ra = rel(aEl), rb = rel(B);
      const dashed = flags.includes('d');

      // Conector horizontal: da lateral direita da origem até a lateral esquerda do destino.
      if (flags.includes('h')) {
        const hx1 = ra.x + ra.w, hy1 = ra.y + ra.h / 2;
        const hx2 = rb.x, hy2 = rb.y + rb.h / 2;
        if (hx2 - hx1 < 8) return;
        const xm = hx1 + (hx2 - hx1) / 2;
        const dy = hy2 - hy1;
        let hd;
        if (Math.abs(dy) < 1) {
          hd = `M${hx1},${hy1} H${hx2}`;
        } else {
          const s = Math.sign(dy);
          const r = Math.min(12, Math.abs(dy) / 2, (hx2 - hx1) / 2);
          hd = `M${hx1},${hy1} H${xm - r} Q${xm},${hy1} ${xm},${hy1 + s * r} V${hy2 - s * r} Q${xm},${hy2} ${xm + r},${hy2} H${hx2}`;
        }
        out += `<path class="w w--s" pathLength="1" d="${hd}"/><circle class="w-dot" cx="${hx2}" cy="${hy2}" r="3"/>`;
        return;
      }

      const x1 = ra.x + ra.w / 2, y1 = ra.y + ra.h;
      const x2 = flags.includes('v')
        ? Math.min(Math.max(x1, rb.x + 28), rb.x + rb.w - 28)
        : rb.x + rb.w / 2;
      const y2 = rb.y;
      if (y2 - y1 < 8) return;

      let d;
      const dx = x2 - x1;
      if (Math.abs(dx) < 1) {
        d = `M${x1},${y1} V${y2}`;
      } else {
        const ym = y1 + (y2 - y1) / 2;
        const dir = Math.sign(dx);
        const r = Math.min(14, Math.abs(dx) / 2, (y2 - y1) / 2);
        d = `M${x1},${y1} V${ym - r} Q${x1},${ym} ${x1 + dir * r},${ym} H${x2 - dir * r} Q${x2},${ym} ${x2},${ym + r} V${y2}`;
      }

      out += dashed
        ? `<path class="w w--d" d="${d}"/>`
        : `<path class="w w--s" pathLength="1" d="${d}"/>`;
      if (!dashed && glowIn.has(box)) out += `<path class="w-glow" pathLength="1" d="${d}"/>`;
      out += `<circle class="w-dot" cx="${x2}" cy="${y2}" r="3"/>`;
    });
    svg.innerHTML = out;
  }

  /* ---------- Modais de entregáveis ----------
     Qualquer elemento com data-modal="id" abre o <dialog> correspondente. */
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal]');
    if (opener) {
      const dlg = document.getElementById(opener.dataset.modal);
      if (dlg && !dlg.open) {
        dlg.querySelector('.modal-body')?.scrollTo(0, 0);
        dlg.showModal();
      }
      return;
    }
    if (e.target.closest('dialog.modal [data-close]')) e.target.closest('dialog').close();
  });
  // Fecha ao clicar fora da caixa (no backdrop).
  document.querySelectorAll('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    });
  });
  const modalOpen = () => !!document.querySelector('dialog.modal[open]');

  /* ---------- Relatório real de performance ----------
     Se existir uma imagem com o nome indicado em data-src, ela substitui o exemplo ilustrativo. */
  document.querySelectorAll('.report[data-src]').forEach((fig) => {
    const probe = new Image();
    probe.onload = () => {
      const img = fig.querySelector('.report-img');
      img.src = probe.src;
      fig.classList.add('has-img');
    };
    probe.src = fig.dataset.src;
  });

  /* ---------- Slides ---------- */
  const slides = [...document.querySelectorAll('.slide')];
  const navLinks = [...document.querySelectorAll('.nav > a')];
  const contentOf = (nav) => slides.filter((s) => s.dataset.nav === nav && !s.hasAttribute('data-cover'));
  const chapterLinks = navLinks.filter((l) => l.dataset.nav !== 'agenda');

  // Sub-blocos do menu: um link para cada slide de conteúdo do capítulo.
  const subLinks = [];
  chapterLinks.forEach((l) => {
    const sub = document.createElement('div');
    sub.className = 'nav-sub';
    let group = null;
    contentOf(l.dataset.nav).forEach((s) => {
      // Slides com data-group são agrupados sob um rótulo (ex.: Operações, Delivery).
      if (s.dataset.group && s.dataset.group !== group) {
        const g = document.createElement('span');
        g.className = 'nav-group';
        g.textContent = s.dataset.group;
        sub.append(g);
      }
      group = s.dataset.group || null;
      const a = document.createElement('a');
      a.href = '#' + s.id;
      a.textContent = s.dataset.title;
      a.dataset.slide = s.id;
      if (group) a.classList.add('in-group');
      sub.append(a);
      subLinks.push(a);
    });
    l.after(sub);
  });

  // Capas: tópicos do capítulo e barra de progresso entre capítulos.
  document.querySelectorAll('.cover-topics[data-topics]').forEach((ol) => {
    contentOf(ol.dataset.topics).forEach((s, i) => {
      const li = document.createElement('li');
      if (s.dataset.group) li.dataset.group = s.dataset.group;
      li.innerHTML = `<a href="#${s.id}"><b>${i + 1}</b></a>`;
      li.firstChild.append(s.dataset.title);
      ol.append(li);
    });
  });
  document.querySelectorAll('.cover-chapters[data-current]').forEach((ol) => {
    const at = chapterLinks.findIndex((l) => l.dataset.nav === ol.dataset.current);
    chapterLinks.forEach((l, i) => {
      const li = document.createElement('li');
      li.className = i < at ? 'is-done' : i === at ? 'is-current' : '';
      li.innerHTML = `<span><em>${String(i + 1).padStart(2, '0')}</em></span>`;
      li.firstChild.append(l.dataset.tipNav);
      ol.append(li);
    });
  });

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pgTitle = document.getElementById('pgTitle');
  const pgNum = document.getElementById('pgNum');
  const pgBar = document.getElementById('pgBar');
  document.getElementById('pgTotal').textContent = String(slides.length).padStart(2, '0');

  // Escalona a entrada dos elementos de cada slide.
  slides.forEach((s) => {
    s.querySelectorAll('.reveal').forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      const i = siblings.indexOf(el);
      if (i > 0) el.style.transitionDelay = (150 + Math.min(i, 6) * 70) + 'ms';
      else el.style.transitionDelay = '150ms';
    });
  });

  let current = -1;
  const DURATION = 650;
  const EASING = 'cubic-bezier(.65, 0, .35, 1)';

  function enter(slide) {
    const items = [...slide.querySelectorAll('.reveal, [data-wires]')];
    slide.querySelectorAll('[data-wires]').forEach(drawWires);
    if (reduceMotion) { items.forEach((el) => el.classList.add('in')); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => items.forEach((el) => el.classList.add('in'))));
  }
  function leave(slide) {
    slide.querySelectorAll('.reveal, [data-wires]').forEach((el) => el.classList.remove('in'));
  }

  // Remove o estado de saída de todos os slides que não são o atual.
  let cleanupTimer = 0;
  function cleanup() {
    slides.forEach((s, i) => {
      if (i === current || !s.classList.contains('is-leaving')) return;
      s.classList.remove('is-leaving');
      leave(s);
    });
  }

  function updateUI() {
    const s = slides[current];
    pgTitle.textContent = s.dataset.title || '';
    pgNum.textContent = String(current + 1).padStart(2, '0');
    pgBar.style.width = ((current + 1) / slides.length) * 100 + '%';
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
    navLinks.forEach((l) => {
      const on = l.dataset.nav === s.dataset.nav;
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      const sub = l.nextElementSibling;
      if (sub && sub.classList.contains('nav-sub')) sub.classList.toggle('is-open', on);
    });
    subLinks.forEach((a) => a.classList.toggle('is-current', a.dataset.slide === s.id));
    slides.forEach((sl, i) => sl.setAttribute('aria-hidden', i === current ? 'false' : 'true'));
  }

  function go(index, { animate = true } = {}) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    if (index === current) return;

    // Conclui qualquer transição em andamento antes de iniciar a próxima.
    slides.forEach((s) => s.getAnimations().forEach((a) => a.finish()));
    cleanup();

    const prev = slides[current];
    const next = slides[index];
    const dir = index > current ? 1 : -1;

    next.scrollTop = 0;
    next.classList.add('is-active');
    enter(next);

    if (prev) {
      if (animate && !reduceMotion) {
        prev.classList.add('is-leaving');
        prev.classList.remove('is-active');
        next.animate(
          [{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }],
          { duration: DURATION, easing: EASING }
        );
        const out = prev.animate(
          [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * 35}%)`, opacity: 0 }],
          { duration: DURATION, easing: EASING }
        );
        out.onfinish = cleanup;
        clearTimeout(cleanupTimer);
        cleanupTimer = setTimeout(cleanup, DURATION + 80);
      } else {
        prev.classList.remove('is-active', 'is-leaving');
        leave(prev);
      }
    }

    current = index;
    updateUI();
    history.replaceState(null, '', '#' + next.id);
  }

  const next = () => go(current + 1);
  const prev = () => go(current - 1);
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  /* Links internos (menu, cards, botões) usam a mesma transição */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    const slide = target && target.closest('.slide');
    if (!slide) return;
    e.preventDefault();
    closeMenu();
    go(slides.indexOf(slide));
  });

  /* Teclado */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (modalOpen()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
  });

  /* Swipe horizontal (touch) */
  let tx = 0, ty = 0, tracking = false;
  const deck = document.getElementById('deck');
  deck.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    tracking = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  deck.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
  }, { passive: true });

  /* Redesenha conectores quando o layout muda */
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((en) => drawWires(en.target)));
    wireBoxes.forEach((w) => ro.observe(w));
  } else {
    window.addEventListener('resize', () => wireBoxes.forEach(drawWires));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => wireBoxes.forEach(drawWires));

  /* Slide inicial a partir do hash */
  const fromHash = () => {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    const s = el && el.closest('.slide');
    return s ? slides.indexOf(s) : 0;
  };
  go(fromHash(), { animate: false });
  window.addEventListener('hashchange', () => go(fromHash()));
})();
