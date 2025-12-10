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
async function deleteSelectedEvents() {
  if (!checkIfCalendarView()) return;

  const confirmedDelete = confirm(
    "Are you sure you want to delete the selected events? This action can not be undone."
  );

  if (!confirmedDelete) return;
  if (selected.length === 0) return;

  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });

  const token = authResponse.token;

  if (!authResponse.authenticated) {
    alert("Please sign in first to delete events");
    return;
  }

  for (const eventId of selected) {
    try {
      const eventResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        { headers: { Authorization: `Bearer ${token}` }, method: "DELETE" }
      );

      if (!eventResponse.ok) {
        alert(
          `Failed to delete event(s). Are you logged into Google Calendar Bulk Edit Extension on the correct email for this calendar? `
        );
        return;
      }
    } catch (error) {}
  }

  window.location.reload();
}

//---------------------------------- MOVE EVENTS LOGIC -------------------------------
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

  for (const eventId of selected) {
    try {
      const eventResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!eventResponse.ok) {
        alert(
          `Failed to move event(s). Are you logged into Google Calendar Bulk Edit Extension on the correct email for this calendar? `
        );
        return;
      }

      const event = await eventResponse.json();
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = new Date(event.end.dateTime || event.end.date);

      startTime.setMinutes(startTime.getMinutes() + minutes);
      endTime.setMinutes(endTime.getMinutes() + minutes);

      const updatedEvent = {
        ...event,
        start: {
          ...event.start,
          dateTime: event.start.dateTime ? startTime.toISOString() : undefined,
          date:
            event.start.date && !event.start.dateTime
              ? startTime.toISOString().split("T")[0]
              : undefined,
        },
        end: {
          ...event.end,
          dateTime: event.end.dateTime ? endTime.toISOString() : undefined,
          date:
            event.end.date && !event.end.dateTime
              ? endTime.toISOString().split("T")[0]
              : undefined,
        },
      };

      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedEvent),
        }
      );
    } catch (error) {
      // error intentionally ignored
    }
  }

  window.location.reload();
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

      counterElem.style.margin = "0 auto";
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
