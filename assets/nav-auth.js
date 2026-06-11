/*
 * Shared nav-auth glue.
 *
 * Public marketing pages (index, about, docs, quickstart, benchmarks, ide,
 * license, contact, socials, …) each ship a static <a href="/auth/login">
 * Sign in</a> in their top nav. That static label is wrong when the user
 * has an active Supabase session in localStorage — Supabase persists the
 * session across page loads, but the nav never reads it back.
 *
 * This script reads the session at DOM-ready and swaps the "Sign in" CTA
 * for an "Account" link when the user is logged in. The link still routes
 * through the same .nav-cta class so the existing styling carries over.
 *
 * Project ref `msmonxiacxhendxehezw` is the Mesh Supabase project — same
 * value used by every page's createClient call. If the ref changes, update
 * SUPABASE_PROJECT_REF below.
 */
(function meshNavAuth() {
  var PROJECT_REF = 'msmonxiacxhendxehezw';
  var STORAGE_KEY = 'sb-' + PROJECT_REF + '-auth-token';

  function readSession() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // Supabase v2 nests the session under `currentSession` on legacy
      // builds; on newer builds it's the top-level object itself.
      var session = parsed && parsed.currentSession ? parsed.currentSession : parsed;
      if (!session || !session.access_token) return null;
      if (session.expires_at && session.expires_at * 1000 < Date.now()) return null;
      return session;
    } catch (_e) {
      return null;
    }
  }

  function applySignedInState() {
    var session = readSession();
    if (!session) return;

    var email = (session.user && session.user.email) || '';
    var name  = (session.user && session.user.user_metadata && (
      session.user.user_metadata.full_name ||
      session.user.user_metadata.name ||
      session.user.user_metadata.first_name
    )) || '';
    var label = name || email || 'Account';

    // 1. Convert the "Sign in" CTA into an "Account" link. We match by the
    //    /auth/login href so the swap survives nav re-orderings.
    var ctas = document.querySelectorAll('a.nav-cta[href="/auth/login"], a.nav-cta[href="/auth/login.html"]');
    for (var i = 0; i < ctas.length; i++) {
      var a = ctas[i];
      a.setAttribute('href', '/account');
      a.textContent = label;
      a.setAttribute('title', email);
      a.classList.add('nav-cta--signed-in');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySignedInState, { once: true });
  } else {
    applySignedInState();
  }

  // Cross-tab updates: if the user signs in or out in another tab, refresh
  // this tab's CTA without requiring a reload.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) applySignedInState();
  });
})();
