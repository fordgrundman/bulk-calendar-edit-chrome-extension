let isSelecting = false;
let startX, startY;
let selectionBox;

let selected = [];

let header = document.querySelector("header");
let headerMid = header.querySelector(":scope > :nth-child(2) > :nth-child(2)");
let newElem = document.createElement("div");
newElem.textContent = "text";

//PUT THE TOOLBAR FOR EXTENSION HERE AS NEW ELEM
headerMid.insertBefore(newElem, headerMid.children[1]); //insert before 2nd child

document.addEventListener("mousedown", (e) => {
  if (e.button === 1 && e.shiftKey) {
    //leftClick + Shift
    isSelecting = true;
    startX = e.pageX;
    startY = e.pageY;

    selectionBox = document.createElement("div");
    selectionBox.style.position = "absolute";
    selectionBox.style.border = "2px dashed red";
    selectionBox.style.backgroundColor = "rgba(226, 74, 74, 0.2)";
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.pointerEvents = "none"; //dont block clicks
    selectionBox.style.zindex = 999999;
    document.body.appendChild(selectionBox);

    e.preventDefault();
  }
});

document.addEventListener("mousemove", (e) => {
  if (!isSelecting) return;
  const x = Math.min(e.pageX, startX); //min handle cases where drag in "opposite" of expected drag direction
  const y = Math.min(e.pageY, startY);
  const width = Math.abs(e.pageX - startX); //abs: if drag in a certain way where width would calc to be negative, make it pos
  const height = Math.abs(e.pageY - startY); //distance is minus

  selectionBox.style.left = `${x}px`;
  selectionBox.style.top = `${y}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
});

//check for calendar event box overlap with selection box
function isOverlapping(a, b) {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

document.addEventListener("mouseup", (e) => {
  if (isSelecting) {
    isSelecting = false;
    const rect = selectionBox.getBoundingClientRect();

    const gcEvents = document.querySelectorAll('[role="button"][data-eventid]');
    //get og bg color
    const originalBgColors = new Map();
    gcEvents.forEach((evnt) => {
      originalBgColors.set(evnt, evnt.style.backgroundColor);
    });

    console.log(originalBgColors);

    gcEvents.forEach((evnt) => {
      const eventRect = evnt.getBoundingClientRect();
      //check if selected already
      const isEventSelected = evnt.classList.contains("gc-bulk-selected");
      if (isOverlapping(rect, eventRect)) {
        if (!isEventSelected) {
          evnt.style.backgroundColor = "red"; //red highlight on selected event boxes
          selected.push(evnt);
          evnt.classList.add("gc-bulk-selected");
          console.log("selected: ", evnt);
        } else {
          console.log("unselected: ", evnt);
          evnt.style.backgroundColor = evnt.style.borderColor;
          selected = selected.filter((filterEvent) => {
            return evnt != filterEvent;
          });
          evnt.classList.remove("gc-bulk-selected");
        }
      }
    });

    selectionBox.remove();
    selectionBox = null;
  }
});

//note that each step of a google calendar upwards is 12px in styling, and 15 minutes.
