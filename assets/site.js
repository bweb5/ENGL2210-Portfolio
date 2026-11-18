/* Document viewer and video embed for the assignment pages. */
(function () {
  "use strict";

  /* On narrow screens the document list scrolls sideways; bring the current one into view. */
  var cur = document.querySelector('.doc-nav a[aria-current="page"]');
  if (cur) {
    var list = cur.closest("ol");
    if (list && list.scrollWidth > list.clientWidth) {
      list.scrollLeft = cur.parentElement.offsetLeft - list.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2;
    }
  }

  /* ---------- PDF viewer ----------
     <div class="viewer" data-pdf="documents/File.pdf" data-title="..."></div>
     Shows the PDF inline. If the file is missing on the live site, says which
     file to upload instead of showing a GitHub 404 page. */
  document.querySelectorAll(".viewer[data-pdf]").forEach(function (box) {
    var src = box.getAttribute("data-pdf");
    var title = box.getAttribute("data-title") || "Document";

    function showPdf() {
      var f = document.createElement("iframe");
      f.src = src + "#view=FitH";
      f.title = title + " (PDF)";
      f.loading = "lazy";
      box.appendChild(f);
    }
    function showMissing() {
      var m = document.createElement("div");
      m.className = "viewer-missing";
      var s = document.createElement("strong");
      s.textContent = "This document hasn’t been uploaded yet.";
      var p = document.createElement("span");
      p.textContent = "Add " + src + " to the site to show it here.";
      m.appendChild(s); m.appendChild(p);
      box.appendChild(m);
    }

    // Opened straight from disk (file://): browsers block fetch, so just embed.
    if (location.protocol === "file:") { showPdf(); return; }

    fetch(src, { method: "HEAD", cache: "no-cache" })
      .then(function (r) { if (r.ok) showPdf(); else showMissing(); })
      .catch(showPdf);
  });

  /* ---------- Video ----------
     <div class="video" data-youtube-id="" data-mp4="documents/File.mp4"></div>
     Uses YouTube when an ID is set, otherwise the MP4 file. */
  document.querySelectorAll(".video").forEach(function (box) {
    var id = (box.getAttribute("data-youtube-id") || "").trim();
    var mp4 = box.getAttribute("data-mp4");
    var title = box.getAttribute("data-title") || "Video";
    var frame = document.createElement("div");
    frame.className = "video-frame";
    box.appendChild(frame);

    if (id) {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id);
      f.title = title;
      f.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      frame.appendChild(f);
      var note = document.createElement("p");
      note.className = "video-note";
      note.innerHTML = 'Video not loading? <a href="https://www.youtube.com/watch?v=' +
        encodeURIComponent(id) + '" target="_blank" rel="noopener">Watch it on YouTube</a>.';
      box.appendChild(note);
      return;
    }

    var v = document.createElement("video");
    v.controls = true; v.preload = "metadata"; v.src = mp4;
    v.setAttribute("aria-label", title);
    v.addEventListener("error", function () {
      v.remove();
      var m = document.createElement("div");
      m.className = "viewer-missing";
      var s = document.createElement("strong");
      s.textContent = "This video hasn’t been added yet.";
      var p = document.createElement("span");
      p.textContent = "Add a YouTube video ID in video-instructions.html, or upload " + mp4 + ".";
      m.appendChild(s); m.appendChild(p);
      frame.appendChild(m);
    });
    frame.appendChild(v);
  });
})();
