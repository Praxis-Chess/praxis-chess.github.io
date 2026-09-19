/* ==========================================================================
   lifecycle.js — mount / unmount registry.

   Every module registers a boot function that returns its own teardown,
   rather than running itself on load. Three things fall out of that and all
   three are load-bearing on a site with five pages:

     1. ONE MODULE THROWING CANNOT TAKE THE PAGE WITH IT. A boot that raises
        is caught here, logged, and the remaining modules still mount. The
        version of this site without that had a null board container on the
        about page, and the thrown TypeError took the navigation with it —
        on a page where the navigation was the only thing that mattered.

     2. THE PHONE MOUNTS AN ALLOWLIST, not everything. See js/boot.js. An
        allowlist rather than a skip-list on purpose, so a module added
        later is OFF on mobile until somebody has decided it belongs there.

     3. mount() REPORTS WHAT ACTUALLY CAME UP. js/boot.js uses that to
        undo the pre-paint reveal class when the reveal module did not
        mount, which is the difference between a page that does not animate
        and a page that is permanently blank.
   ========================================================================== */
window.PAGE = (function () {
  'use strict';
  var mods = [], live = [];

  return {
    register: function (name, boot) { mods.push({ name: name, boot: boot }); },

    /* Returns the names that mounted. A module may legitimately decline by
       returning nothing at all — js/fps.js does exactly that on every load
       without ?fps — so "registered" and "live" are different questions and
       the caller usually wants the second one. */
    mount: function (scope, only) {
      scope = scope || document;
      var up = [];
      mods.forEach(function (m) {
        if (only && only.indexOf(m.name) === -1) return;
        try {
          var down = m.boot(scope);
          up.push(m.name);
          if (typeof down === 'function') live.push({ name: m.name, down: down });
        } catch (e) {
          console.error('[mount] ' + m.name, e);
        }
      });
      return up;
    },

    /* Has a module been REGISTERED — that is, did its file load at all?
       Different from whether it is live: js/boot.js asks this to find out
       whether it still needs to fetch js/field.js, which the phone build
       never put on the page in the first place. */
    has: function (name) {
      for (var i = 0; i < mods.length; i++) if (mods[i].name === name) return true;
      return false;
    },

    unmount: function () {
      live.forEach(function (l) {
        try { l.down(); } catch (e) { console.error('[unmount] ' + l.name, e); }
      });
      live = [];
    }
  };
})();
