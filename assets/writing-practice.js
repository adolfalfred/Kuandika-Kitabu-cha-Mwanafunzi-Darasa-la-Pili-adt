(function () {
  "use strict";

  var STORAGE_PREFIX = "adt-kuandika-darasa-la-pili:";

  function storageKey(id) {
    return STORAGE_PREFIX + location.pathname + ":" + id;
  }

  function readStored(id) {
    try {
      return window.localStorage.getItem(storageKey(id));
    } catch (_error) {
      return null;
    }
  }

  function writeStored(id, value) {
    try {
      window.localStorage.setItem(storageKey(id), value);
    } catch (_error) {
      // The activity remains usable if private browsing blocks local storage.
    }
  }

  function removeStored(id) {
    try {
      window.localStorage.removeItem(storageKey(id));
    } catch (_error) {
      // Clearing the visible response remains useful without local storage.
    }
  }

  function normaliseId(value) {
    return String(value || "response")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "response";
  }

  function element(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function alternativeLabelText(ariaLabel) {
    var label = String(ariaLabel || "").toLowerCase();
    if (label.indexOf("sentensi") !== -1) {
      return "Ingiza sentensi kwa kibodi au kutumia Breli.";
    }
    if (label.indexOf("neno") !== -1 || label.indexOf("jina") !== -1) {
      return "Ingiza neno kwa kibodi au kutumia Breli.";
    }
    if (
      label.indexOf("habari") !== -1 ||
      label.indexOf("aya") !== -1 ||
      label.indexOf("hadithi") !== -1
    ) {
      return "Ingiza habari au hadithi kwa kibodi au kutumia Breli.";
    }
    return "Ingiza jibu kwa kibodi au kutumia Breli.";
  }

  function responseIsComplete(canvas) {
    var alternative = document.querySelector(
      '[data-canvas-alternative="' + canvas.id + '"]'
    );
    return (
      canvas.dataset.hasDrawing === "true" ||
      Boolean(alternative && alternative.value.trim())
    );
  }

  function updateCanvasResponse(canvas) {
    var response = document.querySelector(
      '[data-canvas-response="' + canvas.id + '"]'
    );
    var status = document.querySelector(
      '[data-canvas-live-status="' + canvas.id + '"]'
    );
    if (!response) return;

    var complete = responseIsComplete(canvas);
    var nextValue = complete ? "Jibu limekamilika" : "";
    if (response.value !== nextValue) {
      response.value = nextValue;
      response.dispatchEvent(new Event("input", { bubbles: true }));
      response.dispatchEvent(new Event("change", { bubbles: true }));
    }
    response.classList.toggle("is-complete", complete);
    if (status) {
      status.textContent = complete
        ? "Jibu lako limehifadhiwa kwenye kifaa hiki."
        : "Bado hujaongeza jibu.";
    }
  }

  function parseDrawing(value) {
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      if (!parsed || !Array.isArray(parsed.strokes)) return [];
      return parsed.strokes.filter(Array.isArray).map(function (stroke) {
        return stroke
          .filter(function (point) {
            return (
              point &&
              Number.isFinite(point.x) &&
              Number.isFinite(point.y)
            );
          })
          .map(function (point) {
            return {
              x: Math.max(0, Math.min(1, point.x)),
              y: Math.max(0, Math.min(1, point.y)),
            };
          });
      }).filter(function (stroke) {
        return stroke.length > 0;
      });
    } catch (_error) {
      return [];
    }
  }

  function initialiseCanvas(canvas) {
    var context = canvas.getContext("2d");
    var id = canvas.getAttribute("data-practice-storage") || canvas.id;
    var strokes = parseDrawing(readStored(id));
    var activeStroke = null;
    var activePointer = null;
    var resizeFrame = 0;

    function render() {
      var width = canvas.width;
      var height = canvas.height;
      if (!width || !height) return;

      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = Math.max(4, 4.5 * Math.min(window.devicePixelRatio || 1, 2));
      context.strokeStyle = "#172033";
      context.fillStyle = "#172033";

      strokes.forEach(function (stroke) {
        if (stroke.length === 1) {
          context.beginPath();
          context.arc(
            stroke[0].x * width,
            stroke[0].y * height,
            context.lineWidth / 2,
            0,
            Math.PI * 2
          );
          context.fill();
          return;
        }
        context.beginPath();
        context.moveTo(stroke[0].x * width, stroke[0].y * height);
        for (var index = 1; index < stroke.length; index += 1) {
          context.lineTo(stroke[index].x * width, stroke[index].y * height);
        }
        context.stroke();
      });
    }

    function resizeCanvas() {
      resizeFrame = 0;
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      var width = Math.max(1, Math.round(rect.width * ratio));
      var height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      render();
    }

    function scheduleResize() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resizeCanvas);
    }

    function pointFromEvent(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      };
    }

    function persist() {
      if (strokes.length) {
        writeStored(id, JSON.stringify({ version: 1, strokes: strokes }));
      } else {
        removeStored(id);
      }
      canvas.dataset.hasDrawing = strokes.length ? "true" : "false";
      updateCanvasResponse(canvas);
    }

    function addEventPoints(event) {
      if (!activeStroke) return;
      var events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
      if (!events.length) events = [event];
      events.forEach(function (pointerEvent) {
        activeStroke.push(pointFromEvent(pointerEvent));
      });
      render();
    }

    canvas.dataset.hasDrawing = strokes.length ? "true" : "false";
    scheduleResize();
    updateCanvasResponse(canvas);

    canvas.addEventListener("pointerdown", function (event) {
      if (activePointer !== null) return;
      event.preventDefault();
      activePointer = event.pointerId;
      activeStroke = [pointFromEvent(event)];
      strokes.push(activeStroke);
      canvas.setPointerCapture(event.pointerId);
      render();
    });

    canvas.addEventListener("pointermove", function (event) {
      if (event.pointerId !== activePointer || !activeStroke) return;
      event.preventDefault();
      addEventPoints(event);
    });

    function finishDrawing(event) {
      if (event.pointerId !== activePointer || !activeStroke) return;
      event.preventDefault();
      addEventPoints(event);
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      activePointer = null;
      activeStroke = null;
      persist();
    }

    canvas.addEventListener("pointerup", finishDrawing);
    canvas.addEventListener("pointercancel", finishDrawing);

    var clearButton = document.querySelector(
      '[data-clear-canvas="' + canvas.id + '"]'
    );
    if (clearButton) {
      clearButton.addEventListener("click", function () {
        strokes = [];
        activeStroke = null;
        activePointer = null;
        render();
        persist();
        canvas.focus();
      });
    }

    var alternative = document.querySelector(
      '[data-canvas-alternative="' + canvas.id + '"]'
    );
    if (alternative) {
      var alternativeStorageId = alternative.getAttribute("data-practice-storage");
      var storedAlternative = readStored(alternativeStorageId);
      if (storedAlternative !== null) alternative.value = storedAlternative;
      alternative.addEventListener("input", function () {
        writeStored(alternativeStorageId, alternative.value);
        updateCanvasResponse(canvas);
      });
      updateCanvasResponse(canvas);
    }

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(scheduleResize);
      observer.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", scheduleResize);
    }
  }

  function convertControl(control, index) {
    if (control.dataset.drawingConverted === "true") return null;

    var section = control.closest(
      'section[data-section-type="activity_open_ended_answer"]'
    );
    if (!section || !control.parentNode) return null;

    var sectionId =
      section.getAttribute("data-section-id") ||
      document.querySelector('meta[name="title-id"]')?.content ||
      "activity";
    var sourceId = normaliseId(control.id || sectionId + "-answer-" + (index + 1));
    var ariaLabel =
      control.getAttribute("aria-label") ||
      "Andika jibu lako kwa shughuli hii";
    var rows = Number.parseInt(control.getAttribute("data-writing-rows"), 10);
    if (!Number.isFinite(rows) || rows < 1) {
      rows = control.tagName === "INPUT" ? 2 : 4;
    }
    var canvasHeight = Math.max(8.25, rows * 4);
    var originalValue = control.value || control.textContent || "";

    var practice = element("div", "writing-practice");
    practice.dataset.sourceControlId = sourceId;

    var canvasWrap = element("div", "handwriting-canvas-wrap");
    canvasWrap.style.setProperty("--writing-canvas-height", canvasHeight + "rem");

    var canvas = element("canvas", "drawing-canvas handwriting-canvas");
    canvas.id = sourceId;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", ariaLabel);
    var describedBy = control.getAttribute("aria-describedby");
    if (describedBy) canvas.setAttribute("aria-describedby", describedBy);
    canvas.setAttribute("data-practice-storage", sourceId);
    canvasWrap.appendChild(canvas);
    practice.appendChild(canvasWrap);

    var actions = element("div", "drawing-actions");
    var clearButton = element("button", "drawing-clear", "Futa mwandiko");
    clearButton.type = "button";
    clearButton.setAttribute("data-clear-canvas", sourceId);
    clearButton.setAttribute("aria-label", "Futa mwandiko wa: " + ariaLabel);
    actions.appendChild(clearButton);

    var statusRow = element("div", "drawing-status-row");
    var responseId = sourceId + "-response";
    var statusLabel = element("label", "", "Hali ya jibu");
    statusLabel.htmlFor = responseId;
    statusRow.appendChild(statusLabel);

    var response = element("input", "drawing-response");
    response.type = "text";
    response.id = responseId;
    response.readOnly = true;
    response.setAttribute("aria-label", "Hali ya kukamilika kwa: " + ariaLabel);
    response.setAttribute("data-canvas-response", sourceId);
    response.setAttribute(
      "data-aria-id",
      control.getAttribute("data-aria-id") || sourceId + "-answer"
    );
    statusRow.appendChild(response);
    actions.appendChild(statusRow);
    practice.appendChild(actions);

    var alternativeWrap = element("div", "integrated-text-response");
    var alternativeId = sourceId + "-keyboard-braille";
    var alternativeLabelId = alternativeId + "-label";
    var alternativeLabel = element(
      "label",
      "",
      alternativeLabelText(ariaLabel)
    );
    alternativeLabel.id = alternativeLabelId;
    alternativeLabel.htmlFor = alternativeId;
    alternativeWrap.setAttribute("role", "group");
    alternativeWrap.setAttribute("aria-labelledby", alternativeLabelId);
    alternativeWrap.appendChild(alternativeLabel);

    var alternative = element("input", "drawing-alternative-input");
    alternative.type = "search";
    alternative.id = alternativeId;
    alternative.autocomplete = "off";
    alternative.inputMode = "text";
    alternative.spellcheck = false;
    alternative.value = originalValue.trim();
    alternative.setAttribute("role", "textbox");
    alternative.setAttribute("aria-labelledby", alternativeLabelId);
    alternative.setAttribute("data-canvas-alternative", sourceId);
    alternative.setAttribute("data-practice-storage", sourceId + "-alternative");
    alternativeWrap.appendChild(alternative);
    practice.appendChild(alternativeWrap);

    var liveStatus = element(
      "p",
      "writing-practice-status",
      "Bado hujaongeza jibu."
    );
    liveStatus.setAttribute("aria-live", "polite");
    liveStatus.setAttribute("data-canvas-live-status", sourceId);
    practice.appendChild(liveStatus);

    control.dataset.drawingConverted = "true";
    control.parentNode.replaceChild(practice, control);
    return canvas;
  }

  function initialise() {
    var controls = Array.prototype.slice.call(
      document.querySelectorAll(
        'section[data-section-type="activity_open_ended_answer"] textarea:not([data-no-drawing]), ' +
          'section[data-section-type="activity_open_ended_answer"] input[type="text"]:not([readonly]):not([data-no-drawing])'
      )
    );
    var canvases = controls.map(convertControl).filter(Boolean);
    canvases.forEach(initialiseCanvas);
    document.documentElement.dataset.writingPracticeReady = "true";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
