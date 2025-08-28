let isSelecting = false;
let startX, startY;
let selectionBox;

document.addEventListener("mousedown", (e) => {
  if (e.button === 0 && e.shiftKey) {
    //leftClick + Shift
    isSelecting = true;
    startX = e.pageX;
    startY = e.pageY;

    selectionBox = document.createElement("div");
    selectionBox.style.position = "absolute";
    selectionBox.style.border = "2px dashed #4A90E2";
    selectionBox.style.backgroundColor = "rgba(74, 144, 226, 0.2)";
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
  const x = Math.min(e.pageX, startX); //handle cases where drag in "opposite" of expected drag direction
  const y = Math.min(e.pageY);
});
