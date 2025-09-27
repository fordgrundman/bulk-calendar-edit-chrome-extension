//===== STATE & CONFIG =====
let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];
let isKeyboardSelecting = false;
let ctrlPressed = false;
let keyPressed = false;

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

  // Handle Ctrl + Z release - finish selection when either key is released
  if (isKeyboardSelecting && (!ctrlPressed || !keyPressed)) {
    finishMarqueeSelection();
  }
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
