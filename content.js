let isSelecting = false;
let startX, startY;
let selectionBox;

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
    a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom
  );
}

document.addEventListener("mouseup", (e) => {
  if (isSelecting) {
    isSelecting = false;
    const rect = selectionBox.getBoundingClientRect();

    const events = document.querySelectorAll('[role="button"][data-eventid]');
    events.forEach((event) => {
      const eventRect = event.getBoundingClientRect();
      if (!isOverlapping(rect, eventRect)) {
        event.style.backgroundColor = "red"; //red highlight on selected event boxes
      }
    });

    selectionBox.remove();
    selectionBox = null;
  }
});
