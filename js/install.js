/* ==========================================================================
   install.js — the Install scene's toggles. Desktop build only.

       <div data-install> … [data-os] [data-set] [data-row] [data-ins-speed] …

   THE MOTION IS NOT HERE. Each row is an `.at` element, so the scene's --p
   fills its bar through CSS, as everywhere else on the page. This file only
   re-times the rows when a toggle changes what gets downloaded:

     - which rows exist (the light set drops the 7B model),
     - each bar's LENGTH, its share of the largest download (--w),
     - each bar's START and SPAN in the scene (--s0, --inv), laid end to end
       in proportion to bytes, so a 4.7 GB model takes four times the scroll
       of a 1.3 GB one — the chart is the size of the wait.

   And it rewrites the one command that differs per computer, including the
   copy button's data-copy (js/copy.js reads that at click time, so nothing
   needs re-binding).

   THE TIME IS ARITHMETIC ON THE VISITOR'S OWN NUMBER. Bytes × 8 ÷ their
   Mbit/s. Nothing is estimated that the page does not know: build time and
   first-start time depend on the machine, and are not shown.

   Sizes are the published ones: Ollama's library pages for the two Qwen
   models, the Hugging Face file listing for the commentary GGUF
   (1,274,396,192 bytes at revision v1.0).
   ========================================================================== */
window.PAGE.register('install', function (scope) {
  'use strict';

  var root = scope.querySelector('[data-install]');
  if (!root) return;

  var GB = { 'qwen2.5:7b': 4.68, 'qwen3:4b-instruct': 2.5, 'praxis-grid-2b-r3': 1.27 };
  var SETS = {
    standard: ['qwen2.5:7b', 'qwen3:4b-instruct', 'praxis-grid-2b-r3'],
    light: ['qwen3:4b-instruct', 'praxis-grid-2b-r3']
  };
  var UP = {
    gpu: 'docker compose -f docker/compose.yaml -f docker/compose.gpu.yaml up -d --build',
    mac: 'docker compose -f docker/compose.yaml -f docker/compose.host-ollama.yaml up -d --build',
    cpu: 'docker compose -f docker/compose.yaml up -d --build'
  };
  var ROLE_LIGHT = { 'qwen3:4b-instruct': 'explanations, reports, Ask Prax' };

  /* The span of the scene the model bars share, in --p units. Starts after
     the database and app rows, ends before the "open localhost" line. */
  var FROM = 0.22, TO = 0.76;

  var state = { os: 'gpu', set: 'standard' };
  var bound = [];

  var up = root.querySelector('[data-ins-up]');
  var upCopy = root.querySelector('[data-ins-copy]');
  var pre = root.querySelector('[data-ins-pre]');
  var lightNote = root.querySelector('[data-ins-light]');
  var speed = root.querySelector('[data-ins-speed]');
  var total = root.querySelector('[data-ins-total]');
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-row][data-gb]'));
  var roles = {};
  rows.forEach(function (r) {
    var role = r.querySelector('.ins__n small');
    roles[r.getAttribute('data-row')] = role ? role.textContent : '';
  });

  /* Half-up, not toFixed: 4.68 + 2.5 + 1.27 is 8.450000000000001 in floating
     point, which toFixed(1) turns into "8.4" while every other line says 8.5. */
  function fmtGb(x) { return (Math.round(x * 10 + 1e-9) / 10).toFixed(1) + ' GB'; }

  function fmtTime(seconds) {
    if (seconds < 90) return 'about a minute';
    var m = Math.round(seconds / 60);
    if (m < 90) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  function render() {
    var names = SETS[state.set];
    var bytes = names.reduce(function (a, n) { return a + GB[n]; }, 0);
    var largest = Math.max.apply(null, names.map(function (n) { return GB[n]; }));

    var at = FROM;
    rows.forEach(function (r) {
      var name = r.getAttribute('data-row');
      var on = names.indexOf(name) >= 0;
      r.hidden = !on;
      if (!on) return;
      var span = (TO - FROM) * GB[name] / bytes;
      r.style.setProperty('--s0', at.toFixed(3));
      r.style.setProperty('--inv', (1 / span).toFixed(2));
      r.querySelector('.ins__t').style.setProperty('--w', (GB[name] / largest).toFixed(3));
      var role = r.querySelector('.ins__n small');
      if (role) role.textContent = (state.set === 'light' && ROLE_LIGHT[name]) || roles[name];
      at += span;
    });

    var cmd = UP[state.os];
    up.textContent = cmd;
    upCopy.setAttribute('data-copy', cmd);
    pre.hidden = state.os !== 'mac';
    lightNote.hidden = state.set !== 'light';

    var mbit = parseFloat(speed.value);
    var where = state.os === 'mac' ? ' into your Ollama' : ' of models';
    total.textContent = !(mbit > 0)
      ? fmtGb(bytes) + where
      : fmtGb(bytes) + where + ' ≈ ' + fmtTime(bytes * 1e9 * 8 / (mbit * 1e6)) + ' of download';
  }

  function press(group, attr, value) {
    Array.prototype.forEach.call(root.querySelectorAll('[' + attr + ']'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value));
    });
    state[group] = value;
    render();
  }

  function on(el, type, fn) {
    el.addEventListener(type, fn);
    bound.push([el, type, fn]);
  }

  Array.prototype.forEach.call(root.querySelectorAll('[data-os]'), function (b) {
    on(b, 'click', function () { press('os', 'data-os', b.getAttribute('data-os')); });
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-set]'), function (b) {
    on(b, 'click', function () { press('set', 'data-set', b.getAttribute('data-set')); });
  });
  on(speed, 'input', render);
  /* The page owns the wheel and arrow keys on the desktop build; typing a
     number must not also move the page. */
  on(speed, 'keydown', function (e) { e.stopPropagation(); });
  on(speed, 'wheel', function (e) { e.stopPropagation(); });

  render();

  return function () {
    bound.forEach(function (b) { b[0].removeEventListener(b[1], b[2]); });
  };
});
