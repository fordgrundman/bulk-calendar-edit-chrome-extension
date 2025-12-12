//---------------------------------- GLOBAL STATE ----------------------------------
let isSelecting = false;
let startX, startY;
let selectionBox;
let selected = [];
let isKeyboardSelecting = false;
let altPressed = false;
let sPressed = false;
let aPressed = false;
let uPressed = false;
let shiftPressed = false;
let bPressed = false;
let dragStartY = 0;
let draggedEventId = null;
let minutesDialogOverlay = null;
let minutesDialogOpen = false;
let eventsBeforeMostRecentChange = [];

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

  //update counter based on theme changes
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

//--------------GET UP TO DATE WITH STORAGE, HIGHLIGHTCOLOR AND EVENTS-TO-UNDO ------------------

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

// Load eventsToUndo from chrome.storage
chrome.storage.local.get("eventsToUndo", ({ eventsToUndo }) => {
  window.eventsToUndo = eventsToUndo || [];
});

// Receive updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "EVENTS_TO_UNDO_UPDATED") {
    window.eventsToUndo = msg.events;
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

  updateSelectionBox(e);
}

function handleMouseUp(e) {
  if (isSelecting && !isKeyboardSelecting) {
    finishMarqueeSelection();
  }
}

//---------------------------------- KEYBOARD HANDLERS -------------------------------
function handleKeyDown(e) {
  if (e.key === "Alt") altPressed = true;
  if (e.key === "a") aPressed = true;
  if (e.key === "u") uPressed = true;
  if (e.key === "s" || e.key === "S") sPressed = true;
  if (e.key === "Shift") shiftPressed = true;
  if (e.key === "b" || e.key === "B") bPressed = true;

  if (altPressed && aPressed && selected.length > 0) deselectAllEvents();
  if (uPressed && altPressed) {
    UndoLastAction();
  }

  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    altPressed &&
    selected.length > 0
  ) {
    resetSelectionState();
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
      showMoveEventsDialog();
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

  if (e.key === "a" || e.key === "A") {
    aPressed = false;
  }
  if (e.key === "b" || e.key === "B") {
    bPressed = false;
  }

  if (e.key === "u" || e.key === "U") {
    uPressed = false;
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

//---------------------------------- DELETE EVENTS -----------------------------------
async function deleteSelectedEvents() {
  if (!checkIfCalendarView()) return;

  const confirmedDelete = confirm(
    "Are you sure you want to delete the selected events? This action cannot be undone."
  );
  if (!confirmedDelete) return;
  if (selected.length === 0) return;

  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });
  if (!authResponse.authenticated) {
    alert("Please sign in first to delete events");
    return;
  }
  const token = authResponse.token;

  // overlay
  const overlay = document.createElement("div");
  overlay.id = "delete-events-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = 10000;
  const box = document.createElement("div");
  box.style.background = "white";
  box.style.color = "black";
  box.style.padding = "20px 40px";
  box.style.borderRadius = "8px";
  box.style.fontSize = "18px";
  box.style.fontWeight = "bold";
  box.textContent = "Deleting Events... Please Wait";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const updateOverlayText = (text) => {
    box.textContent = text;
  };

  //equips the code with an ability to pause/sleep before retrying a failed delete attempt, give api rate limit time to reset
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  //helps us identify http errors that are temporary, not permanent
  //codes 429 (rate limited) and 500->600 (server error).
  const isTransientStatus = (s) => s === 429 || (s >= 500 && s < 600);

  // fetch all event details, so we can show metadata like title description if deletion fails
  //filters out events that are already deleted (404/410), have no permissions to via fetchStatus
  const fetchEvent = async (eventId) => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 404 || res.status === 410)
        return { id: eventId, gone: true }; //event already deleted/DNE so provide that info to avoid further deletion attempts
      if (!res.ok)
        return { id: eventId, fetchStatus: res.status, idOnly: true };
      const data = await res.json();
      return {
        id: eventId,
        title: data.summary || "Untitled Event",
        description: data.description || "",
      };
    } catch (err) {
      return { id: eventId, fetchStatus: "network-error", idOnly: true };
    }
  };

  const fetched = await Promise.all(selected.map(fetchEvent));

  // delete single with aggressive retry (up to 15 attempts)
  const deleteSingle = async (event, attemptNumber = 1) => {
    const maxAttempts = 15;

    //exponential backoff because the heavier the rate limit, the more you need to wait from API
    let delay = 500 * Math.pow(1.5, attemptNumber - 1);

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Success cases
      if (res.status === 410 || res.status === 404)
        return { ok: true, event, skipped: false };
      if (res.ok) return { ok: true, event, skipped: false };

      // Get response body for all non-success cases
      const responseText = await res.text();

      // Check if 403 is a rate limit (should retry) or permission issue (should skip)
      if (res.status === 403) {
        try {
          const errorData = JSON.parse(responseText);
          const isRateLimit = errorData?.error?.errors?.some(
            (e) =>
              e.reason === "rateLimitExceeded" ||
              e.reason === "userRateLimitExceeded"
          );

          if (isRateLimit) {
            // Rate limit - treat as transient and retry with longer delay
            console.warn(
              `Rate limit hit for event ${event.title}, attempt ${attemptNumber}/${maxAttempts}`
            );
            if (attemptNumber < maxAttempts) {
              await sleep(delay * 2); // Double delay for rate limits
              return deleteSingle(event, attemptNumber + 1);
            } else {
              console.error(
                `Max retries reached (rate limit) for event ${event.title}`
              );
              return {
                ok: false,
                skipped: false,
                event,
                status: res.status,
                reason: "rate_limit_exceeded",
                response: responseText,
              };
            }
          } else {
            // True permission denial - skip
            console.log(`Skipping event (403 - no permission): ${event.title}`);
            console.log("API error response:", responseText);
            return { ok: true, skipped: true };
          }
        } catch (e) {
          // Can't parse response, assume permission issue and skip
          console.log(
            `Skipping event (403 - unparseable response): ${event.title}`
          );
          return { ok: true, skipped: true };
        }
      }

      // Transient errors - retry
      if (isTransientStatus(res.status)) {
        console.warn(
          `Transient error (${res.status}) for event ${event.title}, attempt ${attemptNumber}/${maxAttempts}`
        );
        if (attemptNumber < maxAttempts) {
          await sleep(delay);
          return deleteSingle(event, attemptNumber + 1);
        } else {
          console.error(
            `Max retries reached for event ${event.title}, status: ${res.status}, response:`,
            responseText
          );
          return {
            ok: false,
            skipped: false,
            event,
            status: res.status,
            reason: "max_retries",
            response: responseText,
          };
        }
      } else {
        // Other permanent errors
        console.error(
          `Permanent error (${res.status}) for event ${event.title}:`,
          responseText
        );
        return {
          ok: false,
          skipped: false,
          event,
          status: res.status,
          reason: "permanent",
          response: responseText,
        };
      }
    } catch (err) {
      console.warn(
        `Network error for event ${event.title}, attempt ${attemptNumber}/${maxAttempts}:`,
        err
      );
      if (attemptNumber < maxAttempts) {
        await sleep(delay);
        return deleteSingle(event, attemptNumber + 1);
      } else {
        console.error(
          `Max retries reached for event ${event.title} (network error):`,
          err
        );
        return {
          ok: false,
          skipped: false,
          event,
          error: err,
          reason: "max_retries",
        };
      }
    }
  };

  // Process all events
  //keep events we fetched successfully, skip events already gone or dont have permission to view (fetchStatus)
  const validEvents = fetched.filter((ev) => !ev.gone && !ev.fetchStatus);

  //deletions happen in batches
  const BATCH_SIZE = 12; //12 is fast enough but low enough to avoid aggressive rate limiting
  const deleteResults = [];
  let processed = 0;

  for (let i = 0; i < validEvents.length; i += BATCH_SIZE) {
    const slice = validEvents.slice(i, i + BATCH_SIZE);
    updateOverlayText(`Deleting Events... ${processed}/${validEvents.length}`);
    const sliceResults = await Promise.all(slice.map((e) => deleteSingle(e)));
    deleteResults.push(...sliceResults);
    processed += slice.length;
  }

  // Only count actual failures (not skipped/permission-denied)
  const failures = deleteResults.filter((r) => !r.ok);
  const successes = deleteResults.filter((r) => r.ok && !r.skipped);
  const skipped = deleteResults.filter((r) => r.ok && r.skipped);

  // Remove overlay
  const existingOverlay = document.getElementById("delete-events-overlay");
  if (existingOverlay) existingOverlay.remove();

  // Handle results
  if (failures.length > 0) {
    const failureList = failures.map((f) => `- ${f.event.title}`).join("\n");
    alert(
      `Failed to delete ${failures.length} event(s) after multiple retries:\n${failureList}\n\n` +
        `These events could not be deleted and will remain on your calendar. ` +
        `Please try again later or delete them manually.`
    );
    console.error("Delete failures:", failures);
    // Do NOT reload - events failed to delete
  } else {
    // All operations completed successfully (owned events deleted, non-owned skipped)
    if (successes.length > 0) {
      //successes holds event data for the event BEFORE the time changes, use for UNDO feature
      successes.forEach((s) => {
        eventsBeforeMostRecentChange.push(s.event);

        //send message to background to update local storage with eventsToUndo, to persist after reload
        chrome.runtime.sendMessage({
          type: "UPDATE_EVENTS_TO_UNDO",
          eventsToUndo: {
            events: eventsBeforeMostRecentChange,
            action: "delete", //add type of action for easy undo
            delta: undefined,
          },
        });
      });

      //reload the page so changes are reflected for user
      window.location.reload();
    } else {
      // All events were skipped (none owned)
      alert(
        "No events were deleted. You don't have permission to delete the selected events."
      );
    }
  }
}

//------------------------------------------------- MOVE EVENT POPUP ---------------------------------------------------
function showMoveEventsDialog() {
  if (!checkIfCalendarView()) return;

  moveDialogOpen = true;

  const overlay = document.createElement("div");
  moveDialogOverlay = overlay;

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
  } by:`;
  label.style.cssText = `margin-bottom: 10px; font-size: 14px; color: #333;`;

  const inputContainer = document.createElement("div");
  inputContainer.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
    margin-bottom: 10px;
  `;

  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.placeholder = "Enter amount";
  quantityInput.value = "15";
  quantityInput.style.cssText = `
    width: 120px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    text-align: center;
  `;

  const unitSelect = document.createElement("select");
  unitSelect.style.cssText = `
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    color: black;
  `;

  const minutesOption = document.createElement("option");
  minutesOption.value = "minutes";
  minutesOption.textContent = "Minutes";

  const hoursOption = document.createElement("option");
  hoursOption.value = "hours";
  hoursOption.textContent = "Hours";

  const daysOption = document.createElement("option");
  daysOption.value = "days";
  daysOption.textContent = "Days";

  unitSelect.appendChild(minutesOption);
  unitSelect.appendChild(hoursOption);
  unitSelect.appendChild(daysOption);

  inputContainer.appendChild(quantityInput);
  inputContainer.appendChild(unitSelect);

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
    if (moveDialogOverlay) {
      document.body.removeChild(moveDialogOverlay);
      moveDialogOverlay = null;
    }
    moveDialogOpen = false;
  };

  const handleSubmit = () => {
    const quantity = parseInt(quantityInput.value);
    const unit = unitSelect.value;

    if (!isNaN(quantity) && quantity !== 0) {
      moveEvents(selected, quantity, unit);
    }
    handleClose();
  };

  submitBtn.addEventListener("click", handleSubmit);
  cancelBtn.addEventListener("click", handleClose);

  quantityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
    if (e.key === "Escape") handleClose();
  });

  buttonsDiv.appendChild(submitBtn);
  buttonsDiv.appendChild(cancelBtn);
  dialog.appendChild(label);
  dialog.appendChild(inputContainer);
  dialog.appendChild(buttonsDiv);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  quantityInput.focus();
  quantityInput.select();
}

// -----------------------------------------------------MOVE EVENTS------------------------------------------------
function convertToMinutes(quantity, unit) {
  switch (unit) {
    case "minutes":
      return quantity;
    case "hours":
      return quantity * 60;
    case "days":
      return quantity * 60 * 24;
    default:
      return 0;
  }
}

async function moveEvents(events, quantity, unit) {
  const minutes = convertToMinutes(quantity, unit);

  if (!checkIfCalendarView()) return;
  if (events.length === 0) return;

  const authResponse = await chrome.runtime.sendMessage({
    type: "GET_AUTH_TOKEN",
  });
  if (!authResponse.authenticated) {
    alert("Please sign in first to move events");
    return;
  }
  const token = authResponse.token;

  // overlay
  const overlay = document.createElement("div");
  overlay.id = "move-events-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = 10000;
  const box = document.createElement("div");
  box.style.background = "white";
  box.style.color = "black";
  box.style.padding = "20px 40px";
  box.style.borderRadius = "8px";
  box.style.fontSize = "18px";
  box.style.fontWeight = "bold";
  box.textContent = "Moving Events... Please Wait";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const updateOverlayText = (text) => {
    box.textContent = text;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isTransientStatus = (s) => s === 429 || (s >= 500 && s < 600);

  // fetch event details up-front
  const fetchEvent = async (eventId) => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 404 || res.status === 410)
        return { id: eventId, gone: true };
      if (!res.ok)
        return { id: eventId, fetchStatus: res.status, idOnly: true };
      const data = await res.json();
      return {
        id: eventId,
        summary: data.summary || "Untitled Event",
        description: data.description || "",
        start: data.start,
        end: data.end,
      };
    } catch (err) {
      return { id: eventId, fetchStatus: "network-error", idOnly: true };
    }
  };

  const fetched = await Promise.all(events.map(fetchEvent));

  // Move single event with aggressive retry (up to 15 attempts)
  const moveSingle = async (event, attemptNumber = 1) => {
    const maxAttempts = 15;

    // validate start/end
    const startTime = new Date(
      event.start?.dateTime || event.start?.date || NaN
    );
    const endTime = new Date(event.end?.dateTime || event.end?.date || NaN);
    if (isNaN(startTime) || isNaN(endTime)) {
      console.error(
        `Invalid time for event ${event.summary}:`,
        event.start,
        event.end
      );
      return { ok: false, skipped: false, event, reason: "invalid_time" };
    }

    startTime.setMinutes(startTime.getMinutes() + minutes);
    endTime.setMinutes(endTime.getMinutes() + minutes);

    const payload = {
      start: {
        dateTime: event.start?.dateTime ? startTime.toISOString() : undefined,
        date:
          event.start?.date && !event.start?.dateTime
            ? startTime.toISOString().split("T")[0]
            : undefined,
        timeZone: event.start?.timeZone,
      },
      end: {
        dateTime: event.end?.dateTime ? endTime.toISOString() : undefined,
        date:
          event.end?.date && !event.end?.dateTime
            ? endTime.toISOString().split("T")[0]
            : undefined,
        timeZone: event.end?.timeZone,
      },
    };

    let delay = 500 * Math.pow(1.5, attemptNumber - 1);

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      // Success cases
      if (res.status === 404 || res.status === 410)
        return { ok: true, event, skipped: false };
      if (res.ok) return { ok: true, event, skipped: false };

      // Get response body for all non-success cases
      const responseText = await res.text();

      // Check if 403 is a rate limit (should retry) or permission issue (should skip)
      if (res.status === 403) {
        try {
          const errorData = JSON.parse(responseText);
          const isRateLimit = errorData?.error?.errors?.some(
            (e) =>
              e.reason === "rateLimitExceeded" ||
              e.reason === "userRateLimitExceeded"
          );

          if (isRateLimit) {
            // Rate limit - treat as transient and retry with longer delay
            console.warn(
              `Rate limit hit for event ${event.summary}, attempt ${attemptNumber}/${maxAttempts}`
            );
            if (attemptNumber < maxAttempts) {
              await sleep(delay * 2); // Double delay for rate limits
              return moveSingle(event, attemptNumber + 1);
            } else {
              console.error(
                `Max retries reached (rate limit) for event ${event.summary}`
              );
              return {
                ok: false,
                skipped: false,
                event,
                status: res.status,
                reason: "rate_limit_exceeded",
                response: responseText,
              };
            }
          } else {
            // True permission denial - skip
            console.log(
              `Skipping event (403 - no permission): ${event.summary}`
            );
            console.log("API error response:", responseText);
            return { ok: true, skipped: true };
          }
        } catch (e) {
          // Can't parse response, assume permission issue and skip
          console.log(
            `Skipping event (403 - unparseable response): ${event.summary}`
          );
          return { ok: true, skipped: true };
        }
      }

      // Transient errors - retry
      if (isTransientStatus(res.status)) {
        console.warn(
          `Transient error (${res.status}) for event ${event.summary}, attempt ${attemptNumber}/${maxAttempts}`
        );
        if (attemptNumber < maxAttempts) {
          await sleep(delay);
          return moveSingle(event, attemptNumber + 1);
        } else {
          console.error(
            `Max retries reached for event ${event.summary}, status: ${res.status}, response:`,
            responseText
          );
          return {
            ok: false,
            skipped: false,
            event,
            status: res.status,
            reason: "max_retries",
            response: responseText,
          };
        }
      } else {
        // Other permanent errors
        console.error(
          `Permanent error (${res.status}) for event ${event.summary}:`,
          responseText
        );
        return {
          ok: false,
          skipped: false,
          event,
          status: res.status,
          reason: "permanent",
          response: responseText,
        };
      }
    } catch (err) {
      console.warn(
        `Network error for event ${event.summary}, attempt ${attemptNumber}/${maxAttempts}:`,
        err
      );
      if (attemptNumber < maxAttempts) {
        await sleep(delay);
        return moveSingle(event, attemptNumber + 1);
      } else {
        console.error(
          `Max retries reached for event ${event.summary} (network error):`,
          err
        );
        return {
          ok: false,
          skipped: false,
          event,
          error: err,
          reason: "max_retries",
        };
      }
    }
  };

  // Process all valid events
  const validEvents = fetched.filter((ev) => !ev.gone && !ev.fetchStatus);

  const BATCH_SIZE = 12;
  const results = [];
  let processed = 0;

  for (let i = 0; i < validEvents.length; i += BATCH_SIZE) {
    const slice = validEvents.slice(i, i + BATCH_SIZE);
    updateOverlayText(`Moving Events... ${processed}/${validEvents.length}`);
    const sliceResults = await Promise.all(slice.map((e) => moveSingle(e)));
    results.push(...sliceResults);
    processed += slice.length;
  }

  // Only count actual failures (not skipped/permission-denied)
  const failures = results.filter((r) => !r.ok);
  const successes = results.filter((r) => r.ok && !r.skipped);

  const skipped = results.filter((r) => r.ok && r.skipped);

  // Remove overlay
  const existingOverlay = document.getElementById("move-events-overlay");
  if (existingOverlay) existingOverlay.remove();

  // Handle results
  if (failures.length > 0) {
    const failureList = failures.map((f) => `- ${f.event.summary}`).join("\n");
    alert(
      `Failed to move ${failures.length} event(s) after multiple retries:\n${failureList}\n\n` +
        `These events could not be moved and remain at their original times. ` +
        `Please try again later or move them manually.`
    );
    console.error("Move failures:", failures);
    // Do NOT reload - events failed to move
  } else {
    // All operations completed successfully (owned events moved, non-owned skipped)
    if (successes.length > 0) {
      //successes holds event data for the event BEFORE the time changes, use for UNDO feature

      successes.forEach((s) => {
        eventsBeforeMostRecentChange.push(s.event);

        //send message to background to update local storage with eventsToUndo, to persist after reload
        chrome.runtime.sendMessage({
          type: "UPDATE_EVENTS_TO_UNDO",
          eventsToUndo: {
            events: eventsBeforeMostRecentChange,
            action: "move", //add type of action for easy undo
            delta: minutes, //time difference of move
          },
        });
      });

      //reload the page so changes are reflected for user
      window.location.reload();
    } else {
      // All events were skipped (none owned)
      alert(
        "No events were moved. You don't have permission to modify the selected events."
      );
    }
  }
}

//---------------------------------- UNDO LAST ACTION ----------------------------------
function UndoLastAction() {
  //whether last action was move or delete is stored in each event of eventsToUndo
  const eventsToUndo = window.eventsToUndo;
  console.log(eventsToUndo);

  const wasAMove = eventsToUndo?.action === "move";

  if (wasAMove) {
    //we can just calculate time delta and call our moveEventsFunction
    //reload will get handled in the move function
    //we need to undo, so the time delta should be opposite of sign
    timeDelta = eventsToUndo.delta * -1;
    const idArray = eventsToUndo.events.map((event) => event.id);
    moveEvents(idArray, timeDelta, "minutes");
  } else {
    //was a delete, so we have to POST new events with the old values
  }
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

      counterElem.style.margin = "0.5rem auto";
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

  altPressed = false;
  sPressed = false;
  aPressed = false;
  uPressed = false;
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
