//===== STATE & CONFIG =====
let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];

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
  isSelecting = false;
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
        selectedIds.push(eventId);
        event.classList.add("gc-bulk-selected");
      } else {
        //Deselect event
        event.style.backgroundColor = event.style.borderColor;
        selectedIds = selected.filter(
          (filterEventId) => filterEventId !== eventId
        );
        event.classList.remove("gc-bulk-selected");
      }
    }
  });

  console.log(selectedIds);

  selectionBox.remove();
  selectionBox = null;
}

//===== EVENT HANDLERS & INITIALIZATION =====

function handleMouseDown(e) {
  if (e.button === 1 && e.shiftKey) {
    //Middle click + Shift
    startMarqueeSelection(e);
  }
}

function handleMouseMove(e) {
  updateSelectionBox(e);
}

function handleMouseUp(e) {
  if (isSelecting) {
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
}

//Start the extension
initializeExtension();
