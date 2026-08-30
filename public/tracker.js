/**
 * tracker.js — lightweight analytics tracker (~3KB minified).
 * Auto-tracks pageviews, heartbeats, exits. No cookies, no PII.
 *
 * Install: <script async defer src="https://your-selasar-instance.com/tracker.js"
 *           data-tracking-id="YOUR-TRACKING-ID"></script>
 *
 * Custom events: analytics.track('signup_click', { plan: 'pro' });
 */
(function () {
  var script = document.currentScript;
  var TRACKING_ID = script && script.getAttribute('data-tracking-id');
  if (!TRACKING_ID) return;

  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || '/api/event';
  var HEARTBEAT_INTERVAL = 10000; // 10s
  var lastPing = Date.now();
  var pageLoadTime = lastPing;
  var currentPath = location.pathname;
  function detectOS() {
    var ua = navigator.userAgent;
    if (/Win/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
  }

  // Parse UTM params from URL query string (only present keys are kept).
  var utmParams = (function () {
    var params = {};
    var qs = location.search.substring(1).split('&');
    for (var i = 0; i < qs.length; i++) {
      var pair = qs[i].split('=');
      var key = decodeURIComponent(pair[0].replace(/\+/g, ' '));
      var val = decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
      if (key === 'utm_source' || key === 'utm_medium' || key === 'utm_campaign' || key === 'utm_content' || key === 'utm_term') {
        if (val) params[key] = val;
      }
    }
    return params;
  })();

  function send(payload) {
    payload.tracking_id = TRACKING_ID;
    payload.path = location.pathname;
    payload.title = document.title;
    payload.referrer = document.referrer;
    payload.os = detectOS();
    // Attach UTM params (utm_source/utm_medium override referrer-based detection server-side).
    for (var k in utmParams) {
      if (utmParams.hasOwnProperty(k)) payload[k] = utmParams[k];
    }
    var data = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, data);
    } else {
      fetch(ENDPOINT, { method: 'POST', body: data, keepalive: true });
    }
  }

  // Pageview on load.
  send({ type: 'pageview' });

  // Heartbeat: send ping every 10s while tab is visible.
  setInterval(function () {
    if (document.visibilityState === 'visible') {
      lastPing = Date.now();
      send({ type: 'heartbeat' });
    }
  }, HEARTBEAT_INTERVAL);

  // Exit: send final duration on page hide.
  document.addEventListener('pagehide', function () {
    send({ type: 'exit', duration_ms: Date.now() - pageLoadTime });
  });

  // SPA route change detection (pushState/replaceState/popstate).
  var pushState = history.pushState;
  var replaceState = history.replaceState;
  history.pushState = function () {
    pushState.apply(this, arguments);
    onRouteChange();
  };
  history.replaceState = function () {
    replaceState.apply(this, arguments);
    onRouteChange();
  };
  window.addEventListener('popstate', onRouteChange);

  function onRouteChange() {
    if (location.pathname !== currentPath) {
      // Send exit for previous page.
      send({ type: 'exit', duration_ms: Date.now() - lastPing, path: currentPath });
      currentPath = location.pathname;
      pageLoadTime = Date.now();
      lastPing = pageLoadTime;
      send({ type: 'pageview' });
    }
  }

  // Public API for custom events.
  window.analytics = {
    track: function (eventName, props) {
      var payload = { type: 'custom', event_name: eventName };
      if (props) payload.props = props;
      send(payload);
    },
  };
})();
