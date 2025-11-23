let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];
let isKeyboardSelecting = false;
let altPressed = false;
let sPressed = false;
let shiftPressed = false;
let bPressed = false;
let isDragging = false;
let dragStartY = 0;
let draggedEventId = null;

//check if our selection box overlaps with any event rects
function isOverlapping(rectA, rectB) {
  return (
    rectA.left < rectB.right &&
    rectA.right > rectB.left &&
    rectA.top < rectB.bottom &&
    rectA.bottom > rectB.top
  );
}

function startMarqueeSelection(e) {
  //remove any pre-existing selection box from the DOM if one already exists
  console.log("startMarqueeSelection called");
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }

  isSelecting = true;
  startX = e.pageX;
  startY = e.pageY;

  selectionBox = document.createElement("div");
  selectionBox.style.cssText = `
    position: fixed; /* <-- changed from absolute */
    border: 2px dashed red;
    background-color: rgba(226, 74, 74, 0.2);
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
  altPressed = false;
  sPressed = false;

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

      console.log("🆔 Extracted eventId:", eventId);

      if (!eventId) {
        return;
      }

      if (!isEventSelected) {
        event.style.backgroundColor = "red";
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

  selectionBox.remove();
  selectionBox = null;
}

function initializeExtension() {
  const leftSidebar = document.querySelector(".wBon4c");

  if (leftSidebar) {
    const newElem = document.createElement("div");
    newElem.textContent = "Google Calendar Bulk Edit";
    newElem.style.cssText = `
      padding: 10px;
      border: 0.1px solid red;
      border-radius: 4px;
      margin-top: 1rem;
      height: 5rem;
      text-align: center;
      font-weight: bold;
      font-size: 14px;
      line-height: 1.2;
    `;
    leftSidebar.appendChild(newElem);
  }

  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
}

function handleMouseDown(e) {
  if (e.button === 1 && e.shiftKey) {
    startMarqueeSelection(e);
    return;
  }

  if (
    e.button === 0 &&
    !isSelecting &&
    !isKeyboardSelecting &&
    selected.length > 0
  ) {
    if (checkForEventDrag(e)) {
      e.preventDefault();
    }
  }
}

function handleKeyDown(e) {
  if (e.key === "Alt") altPressed = true;
  if (e.key === "s" || e.key === "S") sPressed = true;
  if (e.key === "Shift") shiftPressed = true;
  if (e.key === "b" || e.key === "B") bPressed = true;

  if (altPressed && sPressed && !isKeyboardSelecting && !isSelecting) {
    console.log("alt and s clicked together");
    isKeyboardSelecting = true;

    startMarqueeSelection({
      pageX: window.lastMouseX,
      pageY: window.lastMouseY,
      preventDefault: () => {},
    });

    e.preventDefault();
  }

  if (shiftPressed && bPressed && selected.length > 0) {
    showMinutesInputDialog();
    e.preventDefault();
  }
}

function showMinutesInputDialog() {
  const overlay = document.createElement("div");
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

  const handleSubmit = () => {
    const minutes = parseInt(input.value);
    if (!isNaN(minutes) && minutes !== 0) {
      moveSelectedEventsByMinutes(minutes);
      document.body.removeChild(overlay);
    }
  };

  submitBtn.addEventListener("click", handleSubmit);
  cancelBtn.addEventListener("click", () => document.body.removeChild(overlay));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") document.body.removeChild(overlay);
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

function handleKeyUp(e) {
  if (e.key === "Alt") {
    altPressed = false;
    console.log("alt pressed");
  }
  if (e.key === "s" || e.key === "S") {
    sPressed = false;
    console.log("s pressed");
  }

  if (e.key === "Shift") {
    shiftPressed = false;
    console.log("shift pressed");
  }
  if (e.key === "b" || e.key === "B") {
    bPressed = false;
    console.log("b pressed");
  }
  if (e.key === "Delete" && selected.length > 0) {
    deleteSelectedEvents();
  }

  if (isKeyboardSelecting && (!altPressed || !sPressed)) {
    finishMarqueeSelection();
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

async function deleteSelectedEvents() {
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
        console.error(
          `Failed to delete event ${eventId}:`,
          eventResponse.statusText
        );
      }
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
    }
  }

  window.location.reload();
}

async function moveSelectedEventsByMinutes(minutes) {
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

      if (!eventResponse.ok) continue;

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
      console.error(`Error processing event ${eventId}:`, error);
    }
  }

  window.location.reload();
}

initializeExtension();
