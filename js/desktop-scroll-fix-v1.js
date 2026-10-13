/* Desktop scroll fix.
   Problem: on desktop the left menu (.sidebar-scroll) is its own scroll box.
   When the menu is taller than the window, a mouse wheel over the menu scrolls
   the menu, and once it reaches its end the browser keeps the same wheel gesture
   inside the menu, so the page does not scroll.
   Fix: wheel over the menu scrolls the menu only while it has room; at its
   ends the wheel scrolls the page. Only active on desktop widths. */
(function () {
  "use strict";
  var desktop = window.matchMedia("(min-width: 1025px)");

  document.addEventListener("wheel", function (e) {
    if (e.ctrlKey || !desktop.matches || !e.deltaY) return; // pinch-zoom and mobile widths are left alone
    var target = e.target;
    if (!target || !target.closest) return;
    var box = target.closest(".sidebar-scroll");
    if (!box) return;

    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // line mode to pixels
    var maxTop = box.scrollHeight - box.clientHeight;
    var canScrollBox = maxTop > 1 &&
      ((dy > 0 && box.scrollTop < maxTop - 1) || (dy < 0 && box.scrollTop > 1));

    e.preventDefault();
    if (canScrollBox) {
      box.scrollTop += dy;
    } else {
      window.scrollBy(0, dy);
    }
  }, { passive: false });
})();
