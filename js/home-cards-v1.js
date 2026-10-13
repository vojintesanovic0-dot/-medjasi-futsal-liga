/* Međasi — kartice na početnoj otvaraju odgovarajuću sekciju (v1)
   Delegacija događaja preživljava ponovno iscrtavanje početne. Dugmad zadržavaju postojeće akcije. */
(function(){
  "use strict";
  var KPI = { "EKIPE":"teams", "IGRAČI":"players", "UTAKMICE":"matches", "GOLOVI":"stats" };
  var PANELS = [
    ["NAREDNA", "matches"], ["LIVE", "matches"], ["TABELA", "table"],
    ["TOP STRIJELAC", "stats"], ["TOP FORMA", "table"],
    ["GALERIJA", "gallery"], ["NAVIJAČKI CENTAR", "community"]
  ];
  function go(id){
    if (typeof window.showSection === "function") window.showSection(id);
  }
  document.addEventListener("click", function(event){
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("button,a,input,select,textarea,label,iframe,[role='button']")) return;
    var home = document.getElementById("home");
    if (!home || !home.contains(target)) return;
    var kpi = target.closest(".dashboard-kpi");
    if (kpi) {
      var labelNode = kpi.querySelector("small");
      var label = (labelNode ? labelNode.textContent : kpi.textContent || "").trim().toUpperCase();
      for (var key in KPI) if (label.indexOf(key) === 0) { go(KPI[key]); return; }
      return;
    }
    var panel = target.closest(".dashboard-panel, .dashboard-community-panel");
    if (!panel) return;
    var heading = ((panel.querySelector("h2, h3") || {}).textContent || "").trim().toUpperCase();
    for (var i = 0; i < PANELS.length; i++) {
      if (heading.indexOf(PANELS[i][0]) !== -1) { go(PANELS[i][1]); return; }
    }
  });
})();
