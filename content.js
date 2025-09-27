//===== STATE & CONFIG =====
let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];
let isKeyboardSelecting = false;
let ctrlPressed = false;
let keyPressed = false;
let shiftPressed = false;

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
  keyPressed = false;

  if (!selectionBox) return; // Safety check

  const rect = selectionBox.getBoundingClientRect();

  //Process event selection
  const gcEvents = document.querySelectorAll('[role="button"][data-eventid]');

  gcEvents.forEach((event) => {
    const eventRect = event.getBoundingClientRect();
    const isEventSelected = event.classList.contains("gc-bulk-selected");

    if (isOverlapping(rect, eventRect)) {
      const eventId = event.getAttribute("data-eventid");

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

  console.log(selected);

  selectionBox.remove();
  selectionBox = null;
}

//===== EVENT HANDLERS & INITIALIZATION =====

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
    keyPressed = true;
  }

  if (e.key === "Shift") {
    shiftPressed = true;
  }

  //handle shift + b for moving events forward 15 minutes (test)
  if (shiftPressed && e.key.toLowerCase() === "b" && selected.length > 0) {
    moveSelectedEventsForward();
    e.preventDefault();
  }

  // Handle Ctrl + Z - only start if not already selecting
  if (ctrlPressed && keyPressed && !isKeyboardSelecting && !isSelecting) {
    isKeyboardSelecting = true;

    // Create fake mouse event at center of screen or last mouse position
    const fakeEvent = {
      pageX: window.lastMouseX || window.innerWidth / 2,
      pageY: window.lastMouseY || window.innerHeight / 2,
      preventDefault: () => e.preventDefault(),
    };
    startMarqueeSelection(fakeEvent);
    e.preventDefault();
  }
}
function handleKeyUp(e) {
  // Track key releases
  if (e.key === "Control") {
    ctrlPressed = false;
  }
  if (e.key === "z") {
    keyPressed = false;
  }
  if (e.key === "Shift") {
    shiftPressed = false;
  }

  // Handle Ctrl + Z release - finish selection when either key is released
  if (isKeyboardSelecting && (!ctrlPressed || !keyPressed)) {
    finishMarqueeSelection();
  }
}

//function to move events forward
async function moveSelectedEventsForward() {
  if (selected.length === 0) {
    console.log("NO events selected");
    return;
  }

  //check if authenticated before making API calls
  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });

  if (!authResponse.authenticated) {
    console.error("User not authenticated");
    alert("Please sign in first to move events");
    return;
  }

  const token = authResponse.token;
  console.log(`Moving ${selected.length} events forward by 15 minutes...`); // Fix: Use backticks for template literal

  for (const eventId of selected) {
    try {
      //get event details
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

      //calc new times (add 15 minutes for test)
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = new Date(event.end.dateTime || event.end.date);

      startTime.setMinutes(startTime.getMinutes() + 15);
      endTime.setMinutes(endTime.getMinutes() + 15);

      //update event - Fix: Create proper updated event object
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

      // Fix: Actually send the PUT request to update the event
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
      // Fix: Add catch block for try
      console.error(`Error processing event ${eventId}:`, error);
    }
  } // Fix: Move the closing brace for the for loop here

  //refresh page to see changes - Fix: Move this outside the loop
  console.log("refreshing to show updated events");
  window.location.reload();
}

function handleMouseMove(e) {
  // Track mouse position for Ctrl+V
  window.lastMouseX = e.pageX;
  window.lastMouseY = e.pageY;

  updateSelectionBox(e);
}

function handleMouseUp(e) {
  if (isSelecting && !isKeyboardSelecting) {
    finishMarqueeSelection();
  }
}

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

//Start the extension
initializeExtension();
