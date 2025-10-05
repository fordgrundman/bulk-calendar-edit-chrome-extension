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
  //only check if not alr selecting
  if (isSelecting) return false;

  //find the event element under the mouse
  const eventElement = e.target.closest('[role="button"][data-eventid]');
  if (!eventElement) return false;

  const eventId = eventElement.getAttribute("data-eventid");

  //check if this event is selected
  if (selected.includes(eventId)) {
    isDragging = true;
    draggedEventId = eventId;
    dragStartX = e.pageX;
    dragStartY = e.pageY;
  }
}

//===== MAIN SELECTION FUNCTIONS =====
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
  // Only handle middle click + shift here
  if (e.button === 1 && e.shiftKey) {
    startMarqueeSelection(e);
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
    moveSelectedEventsForward();
    e.preventDefault();
  }
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

  if (e.key === "b") {
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

  updateSelectionBox(e);
}

function handleMouseUp(e) {
  if (isSelecting && !isKeyboardSelecting) {
    finishMarqueeSelection();
  }
}

// Add this function after your existing functions
async function moveSelectedEventsForward() {
  if (selected.length === 0) {
    console.log("No events selected");
    return;
  }

  // Get auth token
  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });

  if (!authResponse.authenticated) {
    console.error("User not authenticated");
    alert("Please sign in first to move events");
    return;
  }

  const token = authResponse.token;
  console.log(`Moving ${selected.length} events forward by 15 minutes...`);

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

      // Calculate new times (add 15 minutes)
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = new Date(event.end.dateTime || event.end.date);

      startTime.setMinutes(startTime.getMinutes() + 15);
      endTime.setMinutes(endTime.getMinutes() + 15);

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
          `Successfully moved event ${eventId} forward by 15 minutes`
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
