/* ==========================================================================
   copy.js — copy-to-clipboard, for the quickstart commands.

   Every `[data-copy]` element copies the value of that attribute and says so
   for two and a half seconds. Three details that are not obvious:

   THE LABEL IS SWAPPED, NOT THE ELEMENT. Replacing the button's text content
   would destroy the child <span> that carries the label, and on the second
   click there is nothing left to write into. The original string is captured
   once, at mount.

   THE FAILURE PATH SAYS SOMETHING TOO. navigator.clipboard is unavailable on
   an insecure origin — which includes the http://localhost:5599 dev server
   in some browsers — and rejects when the document is not focused. A button
   that silently does nothing reads as a broken button, so a rejection falls
   through to the same acknowledgement with a different word.

   IT IS ANNOUNCED. The confirmation is a visual change on a control the
   visitor just pressed, and a screen reader has no reason to look at it, so
   the button owns an aria-live region. Without it the whole interaction is
   silent for anyone not watching the pixels.
   ========================================================================== */
window.PAGE.register('copy', function (scope) {
  'use strict';

  var btns = Array.prototype.slice.call(scope.querySelectorAll('[data-copy]'));
  if (!btns.length) return;

  var timers = [], bound = [];

  btns.forEach(function (btn) {
    var label = btn.querySelector('[data-label]') || btn;
    var original = label.textContent;
    var timer = null;

    /* polite, not assertive: this is a confirmation, not an alert, and
       assertive would interrupt whatever is being read at the time. */
    btn.setAttribute('aria-live', 'polite');

    /* Named, and kept, so teardown can actually remove it. An anonymous
       listener here survives unmount, and js/boot.js re-mounts the whole
       registry when the window crosses the breakpoint — which is how one
       click ends up writing to the clipboard twice. */
    function onClick() {
      var text = btn.getAttribute('data-copy') || '';

      function say(word, ok) {
        label.textContent = word;
        btn.classList.toggle('is-done', ok !== false);
        clearTimeout(timer);
        timer = setTimeout(function () {
          label.textContent = original;
          btn.classList.remove('is-done');
        }, 2400);
        timers.push(timer);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { say('copied', true); },
          function () { say('press ctrl-c', false); }
        );
      } else {
        say('press ctrl-c', false);
      }
    }

    btn.addEventListener('click', onClick);
    bound.push({ el: btn, fn: onClick });
  });

  return function () {
    timers.forEach(clearTimeout);
    bound.forEach(function (b) { b.el.removeEventListener('click', b.fn); });
  };
});
