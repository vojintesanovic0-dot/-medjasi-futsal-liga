/* Medjasi image pipeline v1
   Priprema slike prije uploada:
   - ispravlja orijentaciju (EXIF rotacija) i smanjuje na maksimalnu dimenziju,
   - ponovo enkodira u WebP (ili JPEG kao rezervu), čime se uklanja EXIF (GPS, uređaj, vrijeme),
   - GIF se ne prepravlja (canvas bi uklonio animaciju), samo se provjerava veličina.
   Izlaz: { blob, mime, ext, width, height } */
(function () {
  "use strict";

  var INPUT_MAX_BYTES = 15 * 1024 * 1024;   // najveća slika koju korisnik može izabrati
  var OUTPUT_MAX_BYTES = 2 * 1024 * 1024;   // ciljna veličina nakon pripreme

  // maxSide = najveća dimenzija u pikselima, quality = kvalitet enkodiranja (0-1)
  var PRESETS = {
    gallery:  { maxSide: 1920, quality: 0.85 },
    news:     { maxSide: 1920, quality: 0.85 },
    players:  { maxSide: 800,  quality: 0.88 },
    avatar:   { maxSide: 512,  quality: 0.9 },
    graphic:  { maxSide: 1080, quality: 0.92 },
    default:  { maxSide: 1600, quality: 0.85 }
  };

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (b) { resolve(b); }, type, quality);
    });
  }

  function drawTo(bitmap, w, h, whiteBackground) {
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Pregled slike nije dostupan u ovom browseru.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (whiteBackground) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas;
  }

  async function prepareImage(file, preset) {
    if (!file || !/^image\//i.test(file.type || "")) {
      throw new Error("Izabrana datoteka nije slika.");
    }
    if (file.size > INPUT_MAX_BYTES) {
      throw new Error("Slika može imati najviše 15 MB.");
    }

    var mime = String(file.type).toLowerCase();
    if (mime === "image/gif") {
      // Animirani GIF se ne smije pretvoriti kroz canvas (izgubio bi animaciju).
      return { blob: file, mime: "image/gif", ext: "gif", width: null, height: null };
    }

    var p = PRESETS[preset] || PRESETS["default"];

    var bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_) {
      throw new Error("Slika se ne može otvoriti. Probaj drugu datoteku.");
    }

    try {
      var scale = Math.min(1, p.maxSide / Math.max(bitmap.width, bitmap.height));
      var w = Math.max(1, Math.round(bitmap.width * scale));
      var h = Math.max(1, Math.round(bitmap.height * scale));

      // 1) WebP čuva providnost i obično je najmanji.
      var blob = await toBlob(drawTo(bitmap, w, h, false), "image/webp", p.quality);
      var ext = "webp";
      var outMime = "image/webp";

      // 2) Ako browser ne podržava WebP enkodiranje, canvas vraća PNG. Tada koristimo JPEG.
      if (!blob || blob.type !== "image/webp") {
        blob = await toBlob(drawTo(bitmap, w, h, true), "image/jpeg", p.quality);
        ext = "jpg";
        outMime = "image/jpeg";
      }

      // 3) Ako je još uvijek prevelika, smanji kvalitet jednom.
      if (blob && blob.size > OUTPUT_MAX_BYTES) {
        var lower = await toBlob(
          drawTo(bitmap, w, h, outMime === "image/jpeg"),
          outMime,
          0.7
        );
        if (lower && lower.size < blob.size) blob = lower;
      }

      if (!blob || blob.size === 0) {
        throw new Error("Slika nije mogla biti pripremljena. Probaj drugu datoteku.");
      }
      return { blob: blob, mime: outMime, ext: ext, width: w, height: h };
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  window.MedjasiImage = {
    prepareImage: prepareImage,
    PRESETS: PRESETS,
    INPUT_MAX_BYTES: INPUT_MAX_BYTES,
    OUTPUT_MAX_BYTES: OUTPUT_MAX_BYTES
  };
})();