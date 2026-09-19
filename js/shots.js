/* ==========================================================================
   shots.js — the application screenshot slots.

   WHAT THIS IS FOR
   The compositions are built around captures of the Praxis application, taken
   by tools/capture.js driving the real frontend. They are in assets/app/ and
   they load.

   The application in them is real - the actual components, CSS, charts and
   board renderer, photographed, not mocked up. The game library behind it is
   a demo one, because the real account has an untouched drill deck and half
   these screens rendered as zeros. assets/app/README.md states that trade in
   full; it is not something to leave implicit.

   The three-state handling below is kept anyway, because a capture can always
   be missing: mid re-capture, on a branch where one was renamed, or on a
   deploy where the folder did not ship. A slot that fails then keeps its exact
   geometry and says which file it wanted, rather than collapsing the layout
   around a broken image.

   A slot is one line of markup:

       <figure class="shot shot--wide" data-shot="report"
               data-focus="50% 18%"
               data-alt="Praxis mistake report, showing ..."></figure>

   and this file gives it an <img> pointing at assets/app/report.webp.

   THREE STATES, AND THE MIDDLE ONE IS THE POINT
     is-ready    the file exists. The frame becomes the image.
     is-missing  it does not. The frame keeps its exact geometry and shows a
                 technical placard naming the file it is waiting for, so the
                 composition still reads and the gap is legible as a pending
                 asset rather than as a failure.
     (neither)   still loading.

   NOTHING HERE INVENTS APPLICATION UI. A placeholder says which capture is
   missing; it never draws a fake version of the product. That rule matters
   more than the page looking finished, because a mocked-up screenshot is a
   claim about what the software does.

   WEBP, NOT PNG. These are screenshots of a dark interface full of text, and
   PNG is the wrong container for that: the seven captures came to 10.7 MB as
   PNG and 0.6 MB as WebP at quality 88, with no visible difference at the
   sizes any slot renders. Every browser that can run this page can decode it.

   LAZY BY CONSTRUCTION. The images carry loading="lazy", and js/scroll.js
   sets content-visibility:hidden on every scene that is off screen — content
   that is not rendered does not start a lazy fetch, so a sixteen-viewport
   page loads the two or three captures you can actually see.
   ========================================================================== */
window.PAGE.register('shots', function (scope) {
  'use strict';

  var slots = Array.prototype.slice.call(scope.querySelectorAll('[data-shot]'));
  if (!slots.length) return;

  var BASE = '/assets/app/';
  var EXT = '.webp';

  slots.forEach(function (fig, i) {
    var name = fig.getAttribute('data-shot');
    if (!name) return;

    var img = document.createElement('img');
    img.className = 'shot__img';
    img.loading = 'lazy';
    img.decoding = 'async';
    /* The alt text describes what the capture SHOWS, and it is written in the
       markup rather than generated, because only the person who took the
       screenshot knows what is in it. A slot with no alt is a slot nobody has
       described yet, and it says so. */
    img.alt = fig.getAttribute('data-alt') || '';
    if (!img.alt) fig.setAttribute('data-undescribed', 'true');

    var focus = fig.getAttribute('data-focus');
    if (focus) img.style.objectPosition = focus;

    img.addEventListener('load', function () {
      fig.classList.add('is-ready');
      fig.classList.remove('is-missing');
      /* The real aspect ratio, once known, so a crop that was designed
         against an assumed shape settles onto the true one instead of
         stretching. CSS uses it only where a slot opts in. */
      if (img.naturalWidth && img.naturalHeight) {
        fig.style.setProperty('--shot-ar',
          (img.naturalWidth / img.naturalHeight).toFixed(4));
      }
    });

    img.addEventListener('error', function () {
      fig.classList.add('is-missing');
      img.remove();
    });

    /* The placard. Built even when the image is present — CSS hides it — so
       there is no reflow at the moment a capture loads. */
    var placard = document.createElement('figcaption');
    placard.className = 'shot__await';
    placard.innerHTML =
      '<span class="shot__ref">' + pad(i + 1) + '</span>' +
      '<span class="shot__file">' + name + EXT + '</span>' +
      '<span class="shot__note">awaiting capture</span>';
    fig.appendChild(placard);

    img.src = BASE + name + EXT;
    fig.insertBefore(img, placard);
  });

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* A one-line count in the console, so whoever is dropping the captures in
     can see what is still outstanding without opening the network panel. */
  setTimeout(function () {
    var missing = slots.filter(function (f) {
      return f.classList.contains('is-missing');
    }).map(function (f) { return f.getAttribute('data-shot'); });
    if (missing.length) {
      console.info('[shots] ' + missing.length + ' of ' + slots.length +
                   ' captures missing: ' + missing.join(', ') +
                   ' — drop them in assets/app/');
    }
  }, 1200);
});
