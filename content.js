//===== STATE & CONFIG =====
let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];
let isKeyboardSelecting = false;
let ctrlPressed = false;
let zPressed = false;
let shiftPressed = false;
let bPressed = false;

//drag bulk-move variables
let isDragging = false;
let dragStartY = 0;
let draggedEventId = null;

//===== UTILITY FUNCTIONS =====
function isOverlapping(rectA, rectB) {
  return (
    rectA.left < rectB.right &&
    rectA.right > rectB.left &&
    rectA.top < rectB.bottom &&
    rectA.bottom > rectB.top
  );
}

//===== DRAG DETECTION =====
function checkForEventDrag(e) {
  // Strict conditions: no selecting, no keyboard selecting, must have selected events
  if (isSelecting || isKeyboardSelecting || selected.length === 0) {
    console.log("Drag blocked:", {
      isSelecting,
      isKeyboardSelecting,
      selectedCount: selected.length,
    });
    return false;
  }

  //find the event element under the mouse
  const eventElement = e.target.closest('[role="button"][data-eventid]');
  if (!eventElement) return false;

  //extract google calendar api id from jslog
  const jslogAttr = eventElement.getAttribute("jslog");
  if (!jslogAttr) return false;

  const match = jslogAttr.match(/35463;\s*2:\["([^"]+)"/);
  const eventId = match ? match[1] : null;

  //check if this event is selected
  if (selected.includes(eventId)) {
    isDragging = true;
    draggedEventId = eventId;
    dragStartY = e.pageY;
    console.log("✅ Started dragging selected event:", eventId);
    console.log("Will move", selected.length, "events together");
    return true;
  }

  return false;
} //===== MAIN SELECTION FUNCTIONS =====
function startMarqueeSelection(e) {
  // Clear any existing selection box first
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }

  isSelecting = true;
  startX = e.pageX;
  startY = e.pageY;

  //Create selection box
  selectionBox = document.createElement("div");
  selectionBox.style.position = "absolute";
  selectionBox.style.border = "2px dashed red";
  selectionBox.style.backgroundColor = "rgba(226, 74, 74, 0.2)";
  selectionBox.style.left = `${startX}px`;
  selectionBox.style.top = `${startY}px`;
  selectionBox.style.pointerEvents = "none";
  selectionBox.style.zIndex = "999999";
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
  if (!isSelecting) return; // Prevent multiple calls

  isSelecting = false;
  isKeyboardSelecting = false; // Reset keyboard selection state
  ctrlPressed = false; // Reset key states
  zPressed = false;

  if (!selectionBox) return; // Safety check

  const rect = selectionBox.getBoundingClientRect();

  //Process event selection
  const gcEvents = document.querySelectorAll('[role="button"][data-eventid]');

  gcEvents.forEach((event, index) => {
    const eventRect = event.getBoundingClientRect();
    const isEventSelected = event.classList.contains("gc-bulk-selected");

    if (isOverlapping(rect, eventRect)) {
      const jslogAttr = event.getAttribute("jslog");

      if (!jslogAttr) {
        return;
      }

      //look for pattern: eventId embedded in jslog
      const match = jslogAttr.match(/35463;\s*2:\["([^"]+)"/);
      const eventId = match ? match[1] : null;

      console.log("🆔 Extracted eventId:", eventId);

      if (!eventId) {
        return; //skip if no id found
      }

      if (!isEventSelected) {
        //Select event
        event.style.backgroundColor = "red";
        selected.push(eventId);
        event.classList.add("gc-bulk-selected");
      } else {
        //Deselect event
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

//===== EVENT HANDLERS & INITIALIZATION =====

function initializeExtension() {
  //Create toolbar element
  const header = document.querySelector("header");
  const headerMid = header.querySelector(
    ":scope > :nth-child(2) > :nth-child(2)"
  );
  const newElem = document.createElement("div");
  newElem.textContent = "text";
  headerMid.insertBefore(newElem, headerMid.children[1]);

  //Attach event listeners
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp); // Added keyup listener
}

function handleMouseDown(e) {
  console.log("Mouse down:", {
    button: e.button,
    shiftKey: e.shiftKey,
    isSelecting,
    selectedCount: selected.length,
  });

  // Middle click + shift for marquee selection (highest priority)
  if (e.button === 1 && e.shiftKey) {
    console.log("🔥 Starting marquee selection");
    startMarqueeSelection(e);
    return;
  }

  // Left click - check for drag on selected events ONLY if not selecting and we have selected events
  if (
    e.button === 0 &&
    !isSelecting &&
    !isKeyboardSelecting &&
    selected.length > 0
  ) {
    console.log("🔍 Checking for drag on left click");
    if (checkForEventDrag(e)) {
      console.log("🎯 Drag started, preventing default");
      e.preventDefault();
      return;
    }
  }
}

function handleKeyDown(e) {
  // Track key states
  if (e.key === "Control") {
    ctrlPressed = true;
  }
  if (e.key === "z") {
    zPressed = true;
  }

  // Handle Ctrl + Z - only start if not already selecting
  if (ctrlPressed && zPressed && !isKeyboardSelecting && !isSelecting) {
    isKeyboardSelecting = true;
    startMarqueeSelection(e);
    e.preventDefault();
  }

  if (e.key === "Shift") {
    shiftPressed = true;
  }

  if (e.key === "b" || e.key === "B") {
    bPressed = true;
  }

  //handle test combo to move selected events forward by 15 minutes
  if (shiftPressed && bPressed && selected.length > 0) {
    showMinutesInputDialog();
    e.preventDefault();
  }
}
// Add this function to show the input dialog
function showMinutesInputDialog() {
  // Create overlay
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

  // Create dialog box
  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    text-align: center;
  `;

  // Create label
  const label = document.createElement("div");
  label.textContent = `Move ${selected.length} event${
    selected.length > 1 ? "s" : ""
  } by how many minutes?`;
  label.style.cssText = `
    margin-bottom: 10px;
    font-size: 14px;
    color: #333;
  `;

  // Create input
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

  // Create buttons container
  const buttonsDiv = document.createElement("div");
  buttonsDiv.style.cssText = `
    margin-top: 10px;
    display: flex;
    gap: 10px;
    justify-content: center;
  `;

  // Create submit button
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

  // Create cancel button
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

  // Handle submit
  const handleSubmit = () => {
    const minutes = parseInt(input.value);
    if (!isNaN(minutes) && minutes !== 0) {
      const steps = Math.round(minutes / 15);
      moveSelectedEventsBySteps(steps);
      document.body.removeChild(overlay);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    document.body.removeChild(overlay);
  };

  // Event listeners
  submitBtn.addEventListener("click", handleSubmit);
  cancelBtn.addEventListener("click", handleCancel);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  });

  // Assemble dialog
  buttonsDiv.appendChild(submitBtn);
  buttonsDiv.appendChild(cancelBtn);
  dialog.appendChild(label);
  dialog.appendChild(input);
  dialog.appendChild(buttonsDiv);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus input
  input.focus();
}

function handleKeyUp(e) {
  // Track key releases
  if (e.key === "Control") {
    ctrlPressed = false;
  }
  if (e.key === "z") {
    zPressed = false;
  }

  if (e.key === "Shift") {
    shiftPressed = false;
  }

  if (e.key === "b" || e.key === "B") {
    bPressed = false;
  }

  // Handle Ctrl + Z release - finish selection when either key is released
  if (isKeyboardSelecting && (!ctrlPressed || !zPressed)) {
    finishMarqueeSelection();
  }
}

function handleMouseMove(e) {
  // Track mouse position for Ctrl+Z
  window.lastMouseX = e.pageX;
  window.lastMouseY = e.pageY;

  // Handle dragging - prevent Google Calendar's default behavior
  if (isDragging) {
    document.body.style.cursor = "move";
    e.preventDefault(); // Prevent Google Calendar's default drag behavior
    return;
  }

  updateSelectionBox(e);
}

function handleMouseUp(e) {
  console.log("Mouse up:", { isDragging, isSelecting });

  //handle drag completion
  if (isDragging) {
    const dragEndY = e.pageY;
    const deltaY = dragEndY - dragStartY;

    //calculate 15 minute steps (12px = 1 step)
    const steps = Math.round(deltaY / 12);

    console.log(
      `🎯 Drag completed: ${deltaY}px = ${steps} steps (${steps * 15} minutes)`
    );

    if (steps !== 0) {
      moveSelectedEventsBySteps(steps);
    }

    //reset drag state
    isDragging = false;
    draggedEventId = null;
    document.body.style.cursor = "";
    return;
  }

  if (isSelecting && !isKeyboardSelecting) {
    console.log("🔥 Finishing marquee selection");
    finishMarqueeSelection();
  }
}

// Add this function after your existing functions
async function moveSelectedEventsBySteps(steps) {
  if (selected.length === 0) {
    console.log("No events selected");
    return;
  }

  const minutes = steps * 15;
  console.log(`Moving ${selected.length} events by ${minutes} minutes...`);

  // Get auth token from background script
  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });

  if (!authResponse.authenticated) {
    console.error("User not authenticated");
    alert("Please sign in first to move events");
    return;
  }

  const token = authResponse.token;

  for (const eventId of selected) {
    try {
      // Get event details
      const eventResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!eventResponse.ok) {
        console.error(
          `Failed to fetch event ${eventId}:`,
          eventResponse.statusText
        );
        continue;
      }

      const event = await eventResponse.json();

      // Calculate new times (add/subtract minutes)
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = new Date(event.end.dateTime || event.end.date);

      startTime.setMinutes(startTime.getMinutes() + minutes);
      endTime.setMinutes(endTime.getMinutes() + minutes);

      // Update event
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

      // Send update to Google Calendar
      const updateResponse = await fetch(
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

      if (updateResponse.ok) {
        console.log(
          `Successfully moved event ${eventId} by ${minutes} minutes`
        );
      } else {
        console.error(
          `Failed to update event ${eventId}:`,
          updateResponse.statusText
        );
      }
    } catch (error) {
      console.error(`Error processing event ${eventId}:`, error);
    }
  }

  // Refresh the page to see changes
  console.log("Refreshing page to show updated events...");
  window.location.reload();
}

//Start the extension
initializeExtension();
