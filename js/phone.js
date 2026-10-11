/* ==========================================================================
   phone.js — the behaviour only the phone build has.

   Loaded by the phone half of the script list in index.html and nowhere
   else, and every module here is in the MOBILE allowlist in js/boot.js, so
   none of it can run on the desktop build. Five small modules rather than
   five files: on a phone every request is paid for on a mobile connection.

     phone-chrome   a reading-progress hairline under the masthead, the
                    masthead's button going solid once the hero's own
                    primary has scrolled away, the open menu marking where
                    you are, and the hero board receding as you leave it
     share          the phone's "Get Praxis": the share sheet, else the
                    clipboard, else a mail to yourself
     inspect        tap a capture to open it full size and pan around it
     stages         the six pipeline stages open one at a time
     counts         the scene-02 counters count up once, when they arrive

   ONE SCROLL LISTENER, passive and threaded through requestAnimationFrame,
   and it writes transforms to two elements directly rather than a custom
   property on <html>: a property set on the root invalidates style for the
   whole document on every frame, which is exactly the cost a phone notices.
   ========================================================================== */

/* ---- phone-chrome ------------------------------------------------------ */
window.PAGE.register('phone-chrome', function (scope) {
  'use strict';

  var root = document.documentElement;
  var hdr = scope.querySelector('.hdr');
  var hero = scope.querySelector('#hero');
  var board = scope.querySelector('#hero .hero__shot');
  if (!hdr) return;

  /* The progress hairline. Desktop carries the same 1px orchid bar in its
     bottom strip; the phone has no strip, and on a page six screens long
     "how much is left" is a real question. */
  var bar = document.createElement('i');
  bar.className = 'hdr__bar';
  bar.setAttribute('aria-hidden', 'true');
  hdr.appendChild(bar);

  var reduced = window.DORMANT.reduced === true;
  var ticking = false;

  function frame() {
    ticking = false;
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';

    /* THE BOARD RECEDES. It travels at three quarters of the page's speed,
       shrinks a little and dims as the hero leaves, so the statement scrolls
       away over it and the next section arrives in front - depth from the
       one object the hero already has, not a decoration added for it. The
       hero clips its own overflow (css/mobile.css), so the lag can never
       carry the board over the section below. Skipped entirely under
       reduced motion, and a no-op once the hero is gone. */
    if (board && hero && !reduced) {
      var h = hero.offsetHeight || 1;
      if (y <= h) {
        var t = y / h;
        board.style.transform = 'translate3d(0,' + (y * 0.25).toFixed(1) + 'px,0) scale(' + (1 - t * 0.06).toFixed(4) + ')';
        board.style.opacity = (1 - t * 0.75).toFixed(3);
      }
    }
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();

  /* ONE SOLID BUTTON PER SCREEN. While any of the hero is under the masthead
     its control is hidden (css/mobile.css); once the second section reaches
     the masthead, the masthead's appears and becomes the primary. The class
     marks "past", not "at", so the first paint is already right and nothing
     flips on load. */
  var io = null, spy = null;
  if ('IntersectionObserver' in window) {
    if (hero) {
      io = new IntersectionObserver(function (entries) {
        var e = entries[0];
        root.classList.toggle('is-past-hero', !e.isIntersecting && e.boundingClientRect.top < 52);
      }, { rootMargin: '-52px 0px 0px 0px' });
      io.observe(hero);
    }

    /* WHERE YOU ARE, in the open menu. The section crossing a line a third
       of the way down the screen is the current one; its link takes the
       accent and aria-current. */
    var links = Array.prototype.slice.call(scope.querySelectorAll('.menu__link[data-spy]'));
    var byId = {};
    links.forEach(function (a) {
      a.getAttribute('data-spy').split(' ').forEach(function (id) { byId[id] = a; });
    });
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var a = byId[e.target.id];
        if (!a) return;
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        a.setAttribute('aria-current', 'location');
      });
    }, { rootMargin: '-33% 0px -66% 0px' });
    Array.prototype.forEach.call(scope.querySelectorAll('.scene[id]'), function (s) {
      if (byId[s.id]) spy.observe(s);
    });
  }

  return function () {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (io) io.disconnect();
    if (spy) spy.disconnect();
    bar.remove();
  };
});

/* ---- share ------------------------------------------------------------- */
window.PAGE.register('share', function (scope) {
  'use strict';

  var btns = Array.prototype.slice.call(scope.querySelectorAll('[data-share]'));
  if (!btns.length) return;

  /* The canonical address, never location.href: a link shared from a local
     preview or with a fragment on it is not the one to open on a computer. */
  var canon = document.querySelector('link[rel="canonical"]');
  var url = canon ? canon.href : location.origin + '/';
  var title = 'Praxis Chess';
  var text = 'Praxis Chess finds the mistakes you keep repeating across your games. It runs on a computer: open this there.';

  /* One polite live region for the whole page, so "Link copied" is announced
     once however many share buttons there are. */
  var live = document.createElement('p');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);

  var timers = [];
  function confirm(btn, msg) {
    var was = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', was);
    btn.textContent = msg;
    live.textContent = msg;
    timers.push(setTimeout(function () { btn.textContent = was; live.textContent = ''; }, 2400));
  }

  function mail() {
    location.href = 'mailto:?subject=' + encodeURIComponent(title) +
      '&body=' + encodeURIComponent(text + '\n\n' + url);
  }

  /* The control is a mailto: link in the markup, so with no JavaScript, or
     with neither API below, following it IS the fallback. */
  function onClick(e) {
    var btn = e.currentTarget;
    if (navigator.share) {
      e.preventDefault();
      navigator.share({ title: title, text: text, url: url }).catch(function () {
        /* AbortError is the visitor closing the sheet, which is an answer,
           not a failure. Nothing to do either way. */
      });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      e.preventDefault();
      navigator.clipboard.writeText(url).then(function () {
        confirm(btn, 'Link copied');
      }, mail);
      return;
    }
    /* Neither: let the link do what it says. */
  }

  btns.forEach(function (b) { b.addEventListener('click', onClick); });

  return function () {
    btns.forEach(function (b) { b.removeEventListener('click', onClick); });
    timers.forEach(clearTimeout);
    live.remove();
  };
});

/* ---- inspect ----------------------------------------------------------- */
window.PAGE.register('inspect', function (scope) {
  'use strict';

  /* WHY. The captures are 1920px screens of a dense desktop interface, and
     at 340px their text is texture. That still has a job - it says "this is
     real software" - but the phone can do better than texture: tap one and
     it opens at close to its own size, panning under the thumb, starting on
     the region the page crop was showing. Reading the actual mistake cards
     in the actual app is the strongest evidence the page has. */
  var figs = Array.prototype.slice.call(scope.querySelectorAll('.shot[data-shot]'))
    .filter(function (f) { return f.offsetParent !== null; });
  if (!figs.length) return;

  var root = document.documentElement;
  var lb = null, pane = null, img = null, cap = null, toggle = null, closeBtn = null;
  var opener = null, pushed = false, fit = false;

  function build() {
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Screenshot, full size');
    lb.hidden = true;
    lb.innerHTML =
      '<div class="lb__bar">' +
        '<p class="lb__cap"></p>' +
        '<button class="lb__btn" type="button" data-lb-fit>Fit</button>' +
        '<button class="lb__btn" type="button" data-lb-close>Close</button>' +
      '</div>' +
      '<div class="lb__pane" tabindex="0"><img class="lb__img" alt="" /></div>' +
      '<p class="lb__hint">Drag to look around <span class="dim2">//</span> demo data</p>';
    document.body.appendChild(lb);
    pane = lb.querySelector('.lb__pane');
    img = lb.querySelector('.lb__img');
    cap = lb.querySelector('.lb__cap');
    toggle = lb.querySelector('[data-lb-fit]');
    closeBtn = lb.querySelector('[data-lb-close]');
    closeBtn.addEventListener('click', function () { close(true); });
    toggle.addEventListener('click', function () { setFit(!fit); });
  }

  function setFit(on) {
    fit = on;
    lb.classList.toggle('is-fit', fit);
    toggle.textContent = fit ? 'Zoom' : 'Fit';
    toggle.setAttribute('aria-pressed', fit ? 'true' : 'false');
  }

  function open(fig) {
    var src = fig.querySelector('.shot__img');
    if (!src) return;
    if (!lb) build();
    opener = fig;
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    cap.textContent = (fig.closest('.prac__cell') && fig.closest('.prac__cell').querySelector('.prac__word'))
      ? fig.closest('.prac__cell').querySelector('.prac__word').textContent
      : 'The report';
    setFit(false);
    lb.hidden = false;
    root.classList.add('is-lb-open');

    /* Start where the page crop was looking. data-focus is "x% y%", the
       same focal point the slot's object-position uses; data-inspect, where
       a slot has one, is a closer start for the full-size view. */
    var f = (fig.getAttribute('data-inspect') || fig.getAttribute('data-focus') || '50% 40%').split(' ');
    var fx = parseFloat(f[0]) / 100, fy = parseFloat(f[1]) / 100;
    requestAnimationFrame(function () {
      pane.scrollLeft = (pane.scrollWidth - pane.clientWidth) * (isNaN(fx) ? .5 : fx);
      pane.scrollTop = (pane.scrollHeight - pane.clientHeight) * (isNaN(fy) ? .4 : fy);
    });

    /* BACK CLOSES IT. On a phone the back gesture is how anything full
       screen is dismissed, and without a history entry it would leave the
       page instead. */
    try { history.pushState({ lb: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
    closeBtn.focus();
  }

  function close(fromUi) {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    root.classList.remove('is-lb-open');
    if (fromUi && pushed) { pushed = false; history.back(); }
    pushed = false;
    if (opener) opener.focus();
  }

  function onPop() { if (lb && !lb.hidden) { pushed = false; close(false); } }
  function onKey(e) {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') close(true);
    /* Two controls and a pane: keep Tab inside the dialog. */
    if (e.key === 'Tab') {
      var f = [toggle, closeBtn, pane];
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  }

  function onFig(e) {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    open(e.currentTarget);
  }

  figs.forEach(function (fig) {
    fig.setAttribute('role', 'button');
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('aria-label', 'Open full size: ' + (fig.getAttribute('data-alt') || 'screenshot'));
    var tag = document.createElement('span');
    tag.className = 'shot__zoom';
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = 'Inspect +';
    fig.appendChild(tag);
    fig.addEventListener('click', onFig);
    fig.addEventListener('keydown', onFig);
  });
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);

  return function () {
    figs.forEach(function (fig) {
      fig.removeEventListener('click', onFig);
      fig.removeEventListener('keydown', onFig);
    });
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    if (lb) lb.remove();
  };
});

/* ---- stages ------------------------------------------------------------ */
window.PAGE.register('stages', function (scope) {
  'use strict';

  /* The phone cut the six one-line descriptions to keep the section short,
     which left six words and no way to learn what any of them meant. They
     come back one at a time, on request: the list stays six lines tall until
     somebody asks, and then grows by exactly one answer. The name and number
     move into a real <button> so the control is announced as one. */
  var stages = Array.prototype.slice.call(scope.querySelectorAll('.pipe__stage'));
  if (!stages.length) return;

  var items = [];
  stages.forEach(function (st, i) {
    var n = st.querySelector('.pipe__n'), t = st.querySelector('.pipe__t');
    var b = st.querySelector('.pipe__b');
    if (!n || !t || !b) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pipe__tog';
    btn.setAttribute('aria-expanded', 'false');
    b.id = b.id || 'pipe-b-' + (i + 1);
    btn.setAttribute('aria-controls', b.id);
    st.insertBefore(btn, n);
    btn.appendChild(n);
    btn.appendChild(t);
    items.push({ st: st, btn: btn });
  });

  function set(item, open) {
    item.st.classList.toggle('is-open', open);
    item.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function onClick(e) {
    var btn = e.currentTarget;
    items.forEach(function (it) {
      set(it, it.btn === btn ? !it.st.classList.contains('is-open') : false);
    });
  }
  items.forEach(function (it) { it.btn.addEventListener('click', onClick); });

  return function () {
    items.forEach(function (it) { it.btn.removeEventListener('click', onClick); });
  };
});

/* ---- counts ------------------------------------------------------------ */
window.PAGE.register('counts', function (scope) {
  'use strict';

  /* 1, 11, 42, 97. On desktop the scene accumulates as you scroll, which is
     the whole argument: the more games it reads, the more often it finds the
     same mistake. The phone has no scrub, so the numbers do the accumulating
     themselves, once, over 1.1s, when the row arrives. Reduced motion gets
     the final figures and nothing moves. */
  var row = scope.querySelector('.prob__count .prob__counters');
  if (!row || window.DORMANT.reduced || !('IntersectionObserver' in window)) return;

  var cells = Array.prototype.slice.call(row.querySelectorAll('.met__v')).map(function (v) {
    var el = v.querySelector('span') || v;
    return { el: el, to: parseInt(el.textContent, 10) || 0 };
  });
  /* Start from zero only if the row is not already on screen: a reload in
     the middle of the page should show the numbers, not replay them. */
  var r = row.getBoundingClientRect();
  if (r.top < window.innerHeight) return;
  cells.forEach(function (c) { c.el.textContent = '0'; });

  var raf = 0;
  function run() {
    var t0 = performance.now(), DUR = 1100;
    function tick(now) {
      var k = Math.min(1, (now - t0) / DUR);
      var e = 1 - Math.pow(1 - k, 3);
      cells.forEach(function (c) { c.el.textContent = String(Math.round(c.to * e)); });
      if (k < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    run();
  }, { rootMargin: '0px 0px -15% 0px' });
  io.observe(row);

  return function () {
    io.disconnect();
    cancelAnimationFrame(raf);
    cells.forEach(function (c) { c.el.textContent = String(c.to); });
  };
});
