//---------------------------------- GLOBAL STATE ----------------------------------
let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];
let isKeyboardSelecting = false;
let altPressed = false;
let sPressed = false;
let aPressed = false;
let shiftPressed = false;
let bPressed = false;
let isDragging = false;
let dragStartY = 0;
let draggedEventId = null;
let minutesDialogOverlay = null;
let minutesDialogOpen = false;

const head = document.head;

//----------------------------- DARK MODE DETECTOR START ----------------------------
function detectTheme() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return "light";
  return meta.content;
}

// Watch for theme changes
const themeObserver = new MutationObserver(() => {
  const isDark = detectTheme() === "#1B1B1B";

  const counterElem = document.querySelector(".gc-selected-counter");
  if (counterElem) {
    counterElem.style.border =
      "0.1em solid " + (isDark ? "#F8FAFD" : "#1B1B1B");
    counterElem.style.color = isDark ? "#F8FAFD" : "#1B1B1B";
  }
});

themeObserver.observe(head, {
  attributes: true,
  subtree: true,
  attributes: true,
});
//----------------------------- DARK MODE DETECTOR END ------------------------------

//---------------------------------- SELECTION LOGIC --------------------------------
function isOverlapping(rectA, rectB) {
  return (
    rectA.left < rectB.right &&
    rectA.right > rectB.left &&
    rectA.top < rectB.bottom &&
    rectA.bottom > rectB.top
  );
}

// Load highlight color from chrome.storage
chrome.storage.local.get("highlightColor", ({ highlightColor }) => {
  window.highlightColor = highlightColor || "red";
});

// Receive updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "HIGHLIGHT_COLOR_UPDATED") {
    window.highlightColor = msg.color;
  }
});

//-----------------------------MAKING SURE WE ARE ON THE CALENDAR GRID ------------------

function checkIfCalendarView() {
  return (
    document.querySelector("#YPCqFe > div.mXmivb.ogB5bf.u4s1Oc.j0nwNb") !== null
  );
}

//--------------------------------- MARQUEE SELECTION --------------------------------
function startMarqueeSelection(e) {
  if (!checkIfCalendarView()) {
    isKeyboardSelecting = false;
    return;
  }

  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }

  isSelecting = true;
  startX = e.pageX;
  startY = e.pageY;

  let selectionBoxColor = window.highlightColor || "red";

  selectionBox = document.createElement("div");
  selectionBox.style.cssText = `
    position: fixed; 
    border: 2px dashed ${selectionBoxColor};
    background-color: color-mix(in srgb, ${selectionBoxColor} 30%, transparent);
    left: ${startX}px;
    top: ${startY}px;
    pointer-events: none;
    z-index: 999999;
  `;
  document.body.appendChild(selectionBox);

  e.preventDefault();
}

function updateSelectionBox(e) {
  if (!isSelecting) return;

  const x = Math.min(e.pageX, startX);
  const y = Math.min(e.pageY, startY);
  const width = Math.abs(e.pageX - startX);
  const height = Math.abs(e.pageY - startY);

  selectionBox.style.left = `${x}px`;
  selectionBox.style.top = `${y}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function finishMarqueeSelection() {
  if (!isSelecting) return;

  isSelecting = false;
  isKeyboardSelecting = false;

  if (!selectionBox) return;

  const rect = selectionBox.getBoundingClientRect();

  const gcEvents = document.querySelectorAll('[role="button"][data-eventid]');

  gcEvents.forEach((event, index) => {
    const eventRect = event.getBoundingClientRect();
    const isEventSelected = event.classList.contains("gc-bulk-selected");

    if (isOverlapping(rect, eventRect)) {
      const jslogAttr = event.getAttribute("jslog");

      if (!jslogAttr) {
        return;
      }

      const match = jslogAttr.match(/35463;\s*2:\["([^"]+)"/);
      const eventId = match ? match[1] : null;

      if (!eventId) {
        return;
      }

      if (!isEventSelected) {
        event.style.backgroundColor = window.highlightColor || "red";
        selected.push(eventId);
        event.classList.add("gc-bulk-selected");
      } else {
        event.style.backgroundColor = event.style.borderColor;
        selected = selected.filter(
          (filterEventId) => filterEventId !== eventId
        );
        event.classList.remove("gc-bulk-selected");
      }
    }
  });

  let counterElem = document.querySelector(".gc-selected-counter");
  if (counterElem) {
    counterElem.textContent = "Selected Events: " + selected.length;
  }

  selectionBox.remove();
  selectionBox = null;
}

//---------------------------------- MOUSE HANDLERS ----------------------------------
function handleMouseDown(e) {
  if (e.button === 1 && altPressed) {
    startMarqueeSelection(e);
    return;
  }
}

function handleMouseMove(e) {
  window.lastMouseX = e.pageX;
  window.lastMouseY = e.pageY;

  if (isDragging) {
    document.body.style.cursor = "move";
    e.preventDefault();
    return;
  }

  updateSelectionBox(e);
}

function handleMouseUp(e) {
  if (isDragging) {
    const deltaY = e.pageY - dragStartY;
    const steps = Math.round(deltaY / 12);
    const minutes = steps * 15;

    if (minutes !== 0) moveSelectedEventsByMinutes(minutes);

    isDragging = false;
    draggedEventId = null;
    document.body.style.cursor = "";
    return;
  }

  if (isSelecting && !isKeyboardSelecting) {
    finishMarqueeSelection();
  }
}

//---------------------------------- KEYBOARD HANDLERS -------------------------------
function handleKeyDown(e) {
  if (e.key === "Alt") altPressed = true;
  if (e.key === "a") aPressed = true;
  if (e.key === "s" || e.key === "S") sPressed = true;
  if (e.key === "Shift") shiftPressed = true;
  if (e.key === "b" || e.key === "B") bPressed = true;

  if (altPressed && aPressed && selected.length > 0) deselectAllEvents();

  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    altPressed &&
    selected.length > 0
  ) {
    altPressed = false;
    sPressed = false;
    aPressed = false;
    bPressed = false;
    shiftPressed = false;

    deleteSelectedEvents();
  }

  if (altPressed && sPressed && !isKeyboardSelecting && !isSelecting) {
    isKeyboardSelecting = true;

    startMarqueeSelection({
      pageX: window.lastMouseX,
      pageY: window.lastMouseY,
      preventDefault: () => {},
    });

    e.preventDefault();
  }

  if (altPressed && bPressed && selected.length > 0) {
    if (minutesDialogOpen) {
      if (minutesDialogOverlay) {
        document.body.removeChild(minutesDialogOverlay);
        minutesDialogOverlay = null;
      }
      minutesDialogOpen = false;
    } else {
      showMinutesInputDialog();
    }

    e.preventDefault();
  }
}

function handleKeyUp(e) {
  if (e.key === "Alt") {
    altPressed = false;
  }
  if (e.key === "s" || e.key === "S") {
    sPressed = false;
  }

  if (e.key === "Shift") {
    shiftPressed = false;
  }

  if (e.key === "a") {
    aPressed = false;
  }
  if (e.key === "b" || e.key === "B") {
    bPressed = false;
  }

  if (isKeyboardSelecting && (!altPressed || !sPressed)) {
    finishMarqueeSelection();
  }
}

//---------------------------------- DESELECT LOGIC ----------------------------------
function deselectAllEvents() {
  if (!checkIfCalendarView()) return;

  const gcEvents = document.querySelectorAll('[role="button"][data-eventid]');

  gcEvents.forEach((event) => {
    const isEventSelected = event.classList.contains("gc-bulk-selected");

    if (isEventSelected) {
      const jslogAttr = event.getAttribute("jslog");

      if (!jslogAttr) {
        return;
      }

      const match = jslogAttr.match(/35463;\s*2:\["([^"]+)"/);
      const eventId = match ? match[1] : null;

      if (!eventId) {
        return;
      }

      event.style.backgroundColor = event.style.borderColor;
      selected = selected.filter((filterEventId) => filterEventId !== eventId);
      event.classList.remove("gc-bulk-selected");
    }
  });

  //as a failsafe, just reset selected anyways
  selected = [];
  let counterElem = document.querySelector(".gc-selected-counter");
  if (counterElem) {
    counterElem.textContent = "Selected Events: " + selected.length;
  }
}

//---------------------------------- MOVE EVENT POPUP ---------------------------------
function showMinutesInputDialog() {
  if (!checkIfCalendarView()) return;

  minutesDialogOpen = true;

  const overlay = document.createElement("div");
  minutesDialogOverlay = overlay;

  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    text-align: center;
  `;

  const label = document.createElement("div");
  label.textContent = `Move ${selected.length} event${
    selected.length > 1 ? "s" : ""
  } by how many minutes?`;
  label.style.cssText = `margin-bottom: 10px; font-size: 14px; color: #333;`;

  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = "Enter minutes (+ or -)";
  input.style.cssText = `
    width: 200px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    text-align: center;
  `;

  const buttonsDiv = document.createElement("div");
  buttonsDiv.style.cssText = `margin-top: 10px; display: flex; gap: 10px; justify-content: center;`;

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Move Events";
  submitBtn.style.cssText = `
    padding: 8px 16px;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    background: #f1f1f1;
    color: #333;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;

  const handleClose = () => {
    if (minutesDialogOverlay) {
      document.body.removeChild(minutesDialogOverlay);
      minutesDialogOverlay = null;
    }
    minutesDialogOpen = false;
  };

  submitBtn.addEventListener("click", () => {
    const minutes = parseInt(input.value);
    if (!isNaN(minutes) && minutes !== 0) {
      moveSelectedEventsByMinutes(minutes);
    }
    handleClose();
  });

  cancelBtn.addEventListener("click", handleClose);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const minutes = parseInt(input.value);
      if (!isNaN(minutes) && minutes !== 0) {
        moveSelectedEventsByMinutes(minutes);
      }
      handleClose();
    }
    if (e.key === "Escape") handleClose();
  });

  buttonsDiv.appendChild(submitBtn);
  buttonsDiv.appendChild(cancelBtn);
  dialog.appendChild(label);
  dialog.appendChild(input);
  dialog.appendChild(buttonsDiv);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.focus();
}

//---------------------------------- DELETE EVENTS -----------------------------------
//---------------------------------- DELETE EVENTS WITH BATCH + OVERLAY -----------------------------------
async function deleteSelectedEvents() {
  if (!checkIfCalendarView()) return;

  const confirmedDelete = confirm(
    "Are you sure you want to delete the selected events? This action cannot be undone."
  );

  if (!confirmedDelete) return;
  if (selected.length === 0) return;

  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });

  if (!authResponse.authenticated) {
    alert("Please sign in first to delete events");
    return;
  }

  const token = authResponse.token;

  // --- Create overlay ---
  const overlay = document.createElement("div");
  overlay.id = "delete-events-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = 10000;

  const box = document.createElement("div");
  box.style.background = "white";
  box.style.color = "black";
  box.style.padding = "20px 40px";
  box.style.borderRadius = "8px";
  box.style.fontSize = "18px";
  box.style.fontWeight = "bold";
  box.textContent = "Deleting Events... Please Wait";

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // --- Helper: exponential backoff ---
  const fetchWithRetry = async (url, options, retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 410) {
          // Already gone, treat as success
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
      }
    }
  };

  try {
    // --- Split selected events into batches of ≤50 ---
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < selected.length; i += batchSize) {
      batches.push(selected.slice(i, i + batchSize));
    }

    const deleteBatch = async (eventBatch) => {
      const boundary = "batch_boundary_" + Date.now();
      let batchBody = "";

      eventBatch.forEach((eventId) => {
        batchBody += `--${boundary}\r\n`;
        batchBody += "Content-Type: application/http\r\n";
        batchBody += "Content-Transfer-Encoding: binary\r\n\r\n";
        batchBody += `DELETE /calendar/v3/calendars/primary/events/${eventId} HTTP/1.1\r\n\r\n`;
      });

      batchBody += `--${boundary}--`;

      const res = await fetchWithRetry(
        "https://www.googleapis.com/batch/calendar/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body: batchBody,
        }
      );

      const text = await res.text();

      // Simple failed detection: if batch response doesn't contain event id
      const failedEvents = [];
      eventBatch.forEach((eventId) => {
        if (!text.includes(eventId)) failedEvents.push(eventId);
      });

      return failedEvents;
    };

    let failedEvents = [];
    for (const batch of batches) {
      const failed = await deleteBatch(batch);
      failedEvents.push(...failed);
    }

    // --- Retry failed deletes individually ---
    for (const eventId of failedEvents) {
      try {
        await fetchWithRetry(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err) {
        console.error("Failed to delete event after retry:", eventId, err);
      }
    }

    // --- Reload page when done ---
    window.location.reload();
  } finally {
    // Remove overlay regardless of success/failure
    const existingOverlay = document.getElementById("delete-events-overlay");
    if (existingOverlay) existingOverlay.remove();
  }
}

//---------------------------------- MOVE EVENTS -----------------------------------
async function moveSelectedEventsByMinutes(minutes) {
  if (!checkIfCalendarView()) return;
  if (selected.length === 0) return;

  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });

  if (!authResponse.authenticated) {
    alert("Please sign in first to move events");
    return;
  }

  const token = authResponse.token;

  // --- Create overlay ---
  const overlay = document.createElement("div");
  overlay.id = "move-events-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = 10000;

  const box = document.createElement("div");
  box.style.background = "white";
  box.style.color = "black";
  box.style.padding = "20px 40px";
  box.style.borderRadius = "8px";
  box.style.fontSize = "18px";
  box.style.fontWeight = "bold";
  box.textContent = "Moving Events... Please Wait";

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // --- Helper: exponential backoff ---
  const fetchWithRetry = async (url, options, retries = 3, delay = 500) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
      }
    }
  };

  try {
    // --- Fetch all events ---
    const events = await Promise.all(
      selected.map(async (eventId) => {
        const res = await fetchWithRetry(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return res.json();
      })
    );

    // --- Split into batches of ≤50 ---
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }

    // --- Move batch function ---
    const moveBatch = async (eventBatch) => {
      const boundary = "batch_boundary_" + Date.now();
      let batchBody = "";

      eventBatch.forEach((event) => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);

        startTime.setMinutes(startTime.getMinutes() + minutes);
        endTime.setMinutes(endTime.getMinutes() + minutes);

        const updatedEvent = {
          start: {
            dateTime: event.start.dateTime
              ? startTime.toISOString()
              : undefined,
            date:
              event.start.date && !event.start.dateTime
                ? startTime.toISOString().split("T")[0]
                : undefined,
          },
          end: {
            dateTime: event.end.dateTime ? endTime.toISOString() : undefined,
            date:
              event.end.date && !event.end.dateTime
                ? endTime.toISOString().split("T")[0]
                : undefined,
          },
        };

        batchBody += `--${boundary}\r\n`;
        batchBody += "Content-Type: application/http\r\n";
        batchBody += "Content-Transfer-Encoding: binary\r\n\r\n";
        batchBody += `PATCH /calendar/v3/calendars/primary/events/${event.id} HTTP/1.1\r\n`;
        batchBody += "Content-Type: application/json; charset=UTF-8\r\n\r\n";
        batchBody += JSON.stringify(updatedEvent) + "\r\n";
      });

      batchBody += `--${boundary}--`;

      const res = await fetchWithRetry(
        "https://www.googleapis.com/batch/calendar/v3",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/mixed; boundary=${boundary}`,
          },
          body: batchBody,
        }
      );

      const text = await res.text();

      // Simple failed detection: if batch response doesn't contain event id
      const failedEvents = [];
      eventBatch.forEach((event) => {
        if (!text.includes(event.id)) failedEvents.push(event);
      });

      return failedEvents;
    };

    let failedEvents = [];
    for (const batch of batches) {
      const failed = await moveBatch(batch);
      failedEvents.push(...failed);
    }

    // --- Retry failed events individually ---
    for (const event of failedEvents) {
      try {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);

        startTime.setMinutes(startTime.getMinutes() + minutes);
        endTime.setMinutes(endTime.getMinutes() + minutes);

        const updatedEvent = {
          start: {
            dateTime: event.start.dateTime
              ? startTime.toISOString()
              : undefined,
            date:
              event.start.date && !event.start.dateTime
                ? startTime.toISOString().split("T")[0]
                : undefined,
          },
          end: {
            dateTime: event.end.dateTime ? endTime.toISOString() : undefined,
            date:
              event.end.date && !event.end.dateTime
                ? endTime.toISOString().split("T")[0]
                : undefined,
          },
        };

        await fetchWithRetry(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedEvent),
          }
        );
      } catch (err) {
        console.error("Failed to move event after retry:", event.id, err);
      }
    }

    // --- Reload page when done ---
    window.location.reload();
  } finally {
    // Remove overlay regardless of success/failure
    const existingOverlay = document.getElementById("move-events-overlay");
    if (existingOverlay) existingOverlay.remove();
  }
}

//---------------------------------- INITIALIZATION ----------------------------------
function initializeExtension() {
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  const elemBeforeCounter = document.querySelector(".qOsM1d.wBon4c");

  const currentTheme = detectTheme();
  const isDark = currentTheme === "#1B1B1B";

  if (elemBeforeCounter) {
    let counterElem = document.querySelector(".gc-selected-counter");
    if (!counterElem) {
      counterElem = document.createElement("div");
      counterElem.classList.add("gc-selected-counter");

      counterElem.style.margin = "0.5rem auto";
      counterElem.style.border = "0.1em solid white";
      counterElem.style.padding = "0.5em";
      counterElem.style.fontSize = "1rem";
      counterElem.style.fontWeight = "bold";
      counterElem.style.color = "white";
      counterElem.textContent = "Selected Events: 0";

      elemBeforeCounter.insertAdjacentElement("afterend", counterElem);
    } else {
      counterElem.style.border =
        "0.1em solid " + (isDark ? "#F8FAFD" : "#1B1B1B");
      counterElem.style.color = isDark ? "#F8FAFD" : "#1B1B1B";
    }
  }
}

initializeExtension();

//-------------------------RESETS FOR WHEN TAB LOSES FOCUS ---------------------------------
window.addEventListener("blur", () => {
  resetSelectionState();
});

// When user returns to the tab
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    resetSelectionState();
  }
});

function resetSelectionState() {
  isSelecting = false;
  isKeyboardSelecting = false;
  isDragging = false;

  altPressed = false;
  sPressed = false;
  aPressed = false;
  shiftPressed = false;
  bPressed = false;

  startX = null;
  startY = null;

  // remove selection box if it exists
  if (selectionBox && selectionBox.parentNode) {
    selectionBox.parentNode.removeChild(selectionBox);
  }
  selectionBox = null;
}

//--------RESTORE SELECTIONS BETWEEN RE-RENDERS (LIKE CHANGING CALENDAR WEEKS)-----------
function restoreSelectedEvents() {
  if (selected.length === 0) return;

  const gcEvents = document.querySelectorAll('[role="button"][data-eventid]');

  gcEvents.forEach((event) => {
    const jslogAttr = event.getAttribute("jslog");
    if (!jslogAttr) return;

    const match = jslogAttr.match(/35463;\s*2:\["([^"]+)"/);
    const eventId = match ? match[1] : null;

    if (eventId && selected.includes(eventId)) {
      event.classList.add("gc-bulk-selected");
      event.style.backgroundColor = window.highlightColor || "red";
    }
  });

  const counterElem = document.querySelector(".gc-selected-counter");
  if (counterElem) {
    counterElem.textContent = "Selected Events: " + selected.length;
  }
}

//---------------------------------- DOM OBSERVER (RE-INIT) --------------------------
let rerenderTimeout;

const observer = new MutationObserver(() => {
  clearTimeout(rerenderTimeout);

  rerenderTimeout = setTimeout(() => {
    initializeExtension(); // rebuild counter if needed
    restoreSelectedEvents(); // reapply bulk-selected classes
  }, 50);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
