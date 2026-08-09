/* Marketing analytics tags -- GA4 + Microsoft Clarity.
   Placeholder IDs until the real client accounts exist (deferred to
   Handoff, same pattern as OAuth/SMTP -- see
   docs/migration/ACCOUNT-SETUP-AND-HANDOFF.md). An empty id is a no-op:
   loadGA4()/loadClarity() do nothing until a real one is set here.

   Never injected unconditionally -- js/app.js only calls loadIfConsented()
   after the cookie-disclosure banner (#cookie) has actually been accepted,
   this session or a previous one. See js/app.js's COOKIE DISCLOSURE section. */
window.DTS_ANALYTICS = {
  ga4MeasurementId: "",   // e.g. "G-XXXXXXXXXX"
  clarityProjectId: "",   // e.g. "abcd1234ef"

  loaded: { ga4: false, clarity: false },

  loadGA4: function () {
    if (this.loaded.ga4 || !this.ga4MeasurementId) return;
    this.loaded.ga4 = true;
    var id = this.ga4MeasurementId;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id);
  },

  loadClarity: function () {
    if (this.loaded.clarity || !this.clarityProjectId) return;
    this.loaded.clarity = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", this.clarityProjectId);
  },

  loadIfConsented: function () {
    this.loadGA4();
    this.loadClarity();
  }
};
