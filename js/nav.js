/* ==========================================================================
   nav.js — the header, and the sheet that replaces it on a phone.

   TWO JOBS, AND THEY ARE SEPARATE ON PURPOSE.

   (a) THE HEADER GROWS A BACKGROUND ONCE THE PAGE HAS MOVED. At rest it is
       68px of nothing, so the hero meets the top edge of the window with no
       horizontal line cutting across it. That is the whole reason the header
       is not simply opaque: the hero composition depends on reaching the
       top, and a permanent bar with a blur on it is the single fastest way
       to make a page look like a template.

       Threaded through requestAnimationFrame rather than run on the scroll
       event. Reading scrollY inside the listener is fine; TOGGLING A CLASS
       there is not, because the class change invalidates style and the next
       scroll event reads a value the browser has to recompute. On a long
       page with a backdrop-filter on the element being toggled, that was
       measurable.

   (b) THE MENU IS A DISCLOSURE, not a decoration. It is a real <button> with
       aria-expanded, the panel is hidden with the hidden ATTRIBUTE, and the
       Escape key closes it and puts focus back on the button. All three of
       those matter and none are free.

       The panel is hidden with [hidden] rather than with opacity or a
       transform, because a menu that is only visually hidden is still in the
       tab order — and tabbing into an invisible menu is exactly the same
       failure as tabbing to an off-screen link.
   ========================================================================== */
window.PAGE.register('nav', function (scope) {
  'use strict';

  var hdr = scope.querySelector('[data-hdr]');
  var btn = scope.querySelector('[data-burger]');
  var menu = scope.querySelector('[data-menu]');
  var root = document.documentElement;

  /* ---- (a) the stuck state --------------------------------------------- */
  var ticking = false, stuck = false;
  var THRESHOLD = 12;        // px. Low: the change should feel immediate.

  function read() {
    ticking = false;
    var now = window.scrollY > THRESHOLD;
    if (now === stuck) return;          // the guard that makes this cheap
    stuck = now;
    if (hdr) hdr.classList.toggle('is-stuck', stuck);
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(read);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  read();                               // a reload mid-page starts stuck

  /* ---- (b) the menu ----------------------------------------------------- */
  function setOpen(open) {
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
    /* On <html>, not on body. iOS Safari ignores overflow:hidden on body
       when a scroll gesture is already in flight, and the page carries on
       moving underneath an open menu. */
    root.classList.toggle('is-menu-open', open);
  }
  function isOpen() {
    return btn ? btn.getAttribute('aria-expanded') === 'true' : false;
  }

  function onBtn() { setOpen(!isOpen()); }

  function onKey(e) {
    if (e.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    if (btn) btn.focus();               // focus must not be left in a hidden panel
  }

  /* A link inside the sheet navigates; on a same-page fragment it would
     otherwise leave the menu covering the thing it just scrolled to. */
  function onMenuClick(e) {
    if (e.target.closest && e.target.closest('a,button')) setOpen(false);
  }

  /* CROSSING THE BREAKPOINT WITH THE MENU OPEN left an open sheet and a
     visible desktop nav at the same time, plus overflow:hidden on a
     document that now had no menu to justify it. Reads --build rather than
     repeating the 760 literal; css/mobile.css is the only place that number
     is written down. */
  var rt = 0;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var mobile = getComputedStyle(root).getPropertyValue('--build').trim() === 'mobile';
      if (!mobile && isOpen()) setOpen(false);
    }, 150);
  }

  if (btn) btn.addEventListener('click', onBtn);
  if (menu) menu.addEventListener('click', onMenuClick);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  setOpen(false);                       // the state the markup already claims

  return function () {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    if (btn) btn.removeEventListener('click', onBtn);
    if (menu) menu.removeEventListener('click', onMenuClick);
    clearTimeout(rt);
  };
});
