/* ==========================================================================
   scroll.js — the accumulator, and the scene system built on it.

   WHAT CHANGED AND WHY
   The first version of this file gave every section exactly one viewport and
   faded it on distance. That is a slideshow, and it is the reason the page
   read as the same composition nine times. A narrative needs sections of
   DIFFERENT LENGTH: a statement wants one screen and leaves, an argument
   wants three screens and has to hold still while it makes itself.

   So a scene declares how long it is, in viewports:

       <section class="scene" data-len="2.5">
         <div class="scene__pin"> ... held still while you travel ... </div>
       </section>

   and this file publishes, per frame, how far through that scene you are:

       scene.style.setProperty('--p', 0 .. 1)

   Everything else — the choreography inside a scene — is CSS reading --p.
   That keeps the motion declarative, keeps it on the compositor, and means a
   scene can be re-timed without touching JavaScript.

   PINNING IS MANUAL, AND IT HAS TO BE.
   position:sticky needs a scrolling ancestor. There isn't one: the document
   never scrolls, a transform moves the track. So a pinned child is pushed
   back by exactly the distance the track has moved within its scene, which
   holds it still against the viewport while the scene passes through. Same
   effect, no scroll container, and it composites as one transform.

   EASED AGAINST ELAPSED TIME, NOT PER FRAME
   A fixed fraction per frame settles twice as fast at 120Hz as at 60Hz, so
   the same page feels different on different machines. The exponential below
   is framerate-independent, and it is the single line doing most of the work
   of making this not feel like scrolling.
   ========================================================================== */
window.PAGE.register('scroll', function (scope) {
  'use strict';

  var track = scope.querySelector('[data-track]');
  var scenes = Array.prototype.slice.call(scope.querySelectorAll('.scene'));
  var ticks = Array.prototype.slice.call(scope.querySelectorAll('[data-goto]'));
  if (!track || scenes.length < 2) return;

  var root = document.documentElement;

  /* A VIEWPORT HEIGHT OF ZERO IS A REAL STATE. A page restored into a
     background tab, or one that has not been painted yet, reports it — and at
     VH 0 every gesture clamps to 0 and the page is silently frozen with no
     error anywhere. */
  function viewport() {
    return window.innerHeight || root.clientHeight || 800;
  }

  var VH = viewport();
  var MAX = 0;
  /* Per scene: where it starts and how tall it is, both in pixels. Rebuilt on
     resize and never read from the DOM per frame. */
  var lay = [];

  function measure() {
    VH = viewport();
    var at = 0;
    lay = scenes.map(function (el) {
      var len = parseFloat(el.getAttribute('data-len')) || 1;
      var h = len * VH;
      el.style.height = h + 'px';
      var rec = { el: el, top: at, h: h, len: len,
                  pin: el.querySelector('.scene__pin'), p: -1, on: false };
      at += h;
      return rec;
    });
    /* The last scene is the end of the page: you can travel until its final
       screen is filling the viewport, not until its top reaches the top. */
    MAX = Math.max(0, at - VH);
  }

  var target = 0, current = 0;
  var EASE = 0.13;                       // seconds to close ~63% of the gap

  /* Published for js/strip.js and js/fps.js. The accumulator itself stays
     private — it is the single source of truth, and GOTO is the only door. */
  window.SCROLL = { index: 0, progress: 0, count: scenes.length, scene: 0 };

  function clamp(v) { return Math.max(0, Math.min(MAX, v)); }

  /* ---- wheel -----------------------------------------------------------
     CLAMPED PER EVENT. A trackpad flick can deliver a deltaY in the thousands
     in one event, and an unclamped accumulator then throws you through a
     whole scene from a gesture that felt like a nudge. */
  function onWheel(e) {
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;               // some browsers report lines
    target = clamp(target + Math.max(-160, Math.min(160, d)));
  }

  function onKey(e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
              t.isContentEditable)) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      target = clamp(target + VH * 0.55); e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      target = clamp(target - VH * 0.55); e.preventDefault();
    } else if (e.key === 'Home') { target = 0; e.preventDefault(); }
    else if (e.key === 'End') { target = MAX; e.preventDefault(); }
  }

  /* ---- touch -----------------------------------------------------------
     TOUCH ONLY. A pointer drag on a desktop would fight text selection:
     every attempt to select a sentence would scroll the page instead. */
  var dragging = false, lastY = 0;
  function onDown(e) {
    if (e.pointerType !== 'touch') return;
    dragging = true; lastY = e.clientY;
  }
  function onMove(e) {
    if (!dragging) return;
    var dy = e.clientY - lastY; lastY = e.clientY;
    target = clamp(target - dy * 1.7);
  }
  function onUp() { dragging = false; }

  /* ---- THE ONE DOOR IN FROM OUTSIDE ------------------------------------
     Keyboard focus has to be able to bring a scene on screen (js/a11y.js),
     the rail has to jump to one, and /pipeline and /download deep-link into
     one. All of them ease in exactly like a wheel gesture. */
  window.GOTO = function (i, instant) {
    var rec = lay[Math.max(0, Math.min(lay.length - 1, i | 0))];
    if (!rec) return;
    target = clamp(rec.top);
    if (instant) current = target;
  };

  ticks.forEach(function (b) {
    b.addEventListener('click', function () {
      window.GOTO(parseInt(b.getAttribute('data-goto'), 10));
    });
  });

  function onResize() {
    var was = lay.length ? indexAt(current) : 0;
    measure();
    /* Hold the SCENE, not the pixel. Resizing mid-page would otherwise leave
       the visitor stranded between two compositions. */
    if (lay[was]) { target = current = clamp(lay[was].top); }
  }

  function indexAt(px) {
    for (var i = lay.length - 1; i >= 0; i--) {
      if (px >= lay[i].top - 1) return i;
    }
    return 0;
  }

  /* ---- THE STAGE MUST NEVER SCROLL ITSELF ------------------------------
     .stage carries overflow:hidden, and that does NOT mean "cannot scroll" —
     it means "no scrollbar and no user gesture". The box is still a
     scrollport, and the browser will happily scroll it programmatically. A
     fragment navigation does exactly that: clicking a link to /#pipeline made
     Chrome scroll the stage 4,950px to bring that scene into view, while this
     file's accumulator stayed at 0.

     The result was a blank screen — the stage showing the region around scene
     four while the track was still translated to zero and every scene down
     there was content-visibility:hidden. It looked like the page had failed to
     load, and nothing in the console said otherwise.

     So the stage is pinned at the origin. The accumulator is the only thing
     allowed to move this page. */
  var stage = track.parentNode;
  function onStageScroll() {
    if (stage.scrollTop !== 0) stage.scrollTop = 0;
    if (stage.scrollLeft !== 0) stage.scrollLeft = 0;
  }
  stage.addEventListener('scroll', onStageScroll);
  onStageScroll();

  /* ---- THE HASH IS A REAL ADDRESS --------------------------------------
     The masthead links to /#pipeline and /#download, the two redirect routes
     land on them, and the back button moves between them. All of those change
     the hash without reloading, so the accumulator has to follow — eased,
     because arriving somewhere by clicking a link should feel like the same
     page moving rather than a different page appearing. */
  function onHash() {
    var id = (location.hash || '').slice(1);
    if (!id) return;
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].id === id) { window.GOTO(i); return; }
    }
  }
  window.addEventListener('hashchange', onHash);

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', onResize);

  measure();

  /* Deep link: /#download and the two redirect routes land on a scene rather
     than at the top. Instant, because easing through six scenes to reach the
     one that was asked for is a fifteen-second animation nobody requested. */
  (function () {
    var id = (location.hash || '').slice(1);
    if (!id) return;
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].id === id) { window.GOTO(i, true); break; }
    }
  })();

  /* ---- the frame -------------------------------------------------------- */
  var raf = 0, last = performance.now(), lastIdx = -1, moved = false;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    /* Recover if the height was wrong at mount and no resize has fired since. */
    var vh = viewport();
    if (vh !== VH && vh > 1) onResize();

    current += (target - current) * (1 - Math.exp(-dt / EASE));

    track.style.transform = 'translate3d(0,' + (-current).toFixed(2) + 'px,0)';

    if (!moved && current > 12) { moved = true; root.classList.add('is-moved'); }

    var idx = 0;

    for (var i = 0; i < lay.length; i++) {
      var s = lay[i];
      var rel = current - s.top;

      /* Progress through this scene, 0 at its first screen and 1 at its last.
         A one-viewport scene has no travel of its own, so its progress is how
         far it has climbed the viewport instead — which is what lets a short
         scene still drive an entrance. */
      var span = s.h - VH;
      var p = span > 1 ? rel / span : (rel + VH) / VH;
      p = p < 0 ? 0 : p > 1 ? 1 : p;

      /* ON SCREEN AT ALL? Everything below is skipped for scenes nobody can
         see, which on a sixteen-viewport page is most of them on any frame. */
      var visible = rel > -VH * 1.15 && rel < s.h + VH * 0.15;

      if (visible) {
        if (s.p !== p) {
          /* Two decimals. A custom property is a string, and writing a
             sixteen-digit float sixty times a second is real parsing work for
             precision no transform can express. */
          s.el.style.setProperty('--p', p.toFixed(3));
          s.p = p;
        }
        /* PINNING. Push the pinned child back by exactly what the track has
           moved inside this scene, so it holds against the viewport. */
        if (s.pin && s.len > 1) {
          var hold = Math.max(0, Math.min(rel, s.h - VH));
          s.pin.style.transform = 'translate3d(0,' + hold.toFixed(2) + 'px,0)';
        }
      }

      if (visible !== s.on) {
        s.on = visible;
        s.el.classList.toggle('is-live', visible);
        /* content-visibility does the heavy lifting: an off-screen scene is
           not laid out or painted at all. Without it a page this long pays
           layout for sixteen full compositions on every resize. */
        s.el.style.contentVisibility = visible ? 'visible' : 'hidden';
      }

      if (current >= s.top - VH * 0.5) idx = i;
    }

    window.SCROLL.index = idx;
    window.SCROLL.scene = lay[idx] ? idx + (lay[idx].p < 0 ? 0 : lay[idx].p) : 0;
    window.SCROLL.progress = MAX ? Math.min(current / MAX, 1) : 0;

    if (idx !== lastIdx) {
      lastIdx = idx;
      for (var k = 0; k < ticks.length; k++) {
        var on = k === idx;
        ticks[k].classList.toggle('is-on', on);
        ticks[k].setAttribute('aria-current', on ? 'true' : 'false');
      }
      root.setAttribute('data-scene', scenes[idx].id || String(idx));
    }
  }
  raf = requestAnimationFrame(tick);

  return function teardown() {
    cancelAnimationFrame(raf);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('hashchange', onHash);
    stage.removeEventListener('scroll', onStageScroll);
    scenes.forEach(function (el) {
      el.style.height = ''; el.style.contentVisibility = '';
      el.style.removeProperty('--p'); el.classList.remove('is-live');
      var pin = el.querySelector('.scene__pin');
      if (pin) pin.style.transform = '';
    });
    track.style.transform = '';
    root.classList.remove('is-moved');
    root.removeAttribute('data-scene');
    window.GOTO = undefined;
    window.SCROLL = undefined;
  };
});
