let saveTimeout = null;

// Listener for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  //color picker handler
  if(request.type === "SET_HIGHLIGHT_COLOR") {
    const color = request.color;

    //cancel any previous delayed save, like dragging the color picker
    clearTimeout(saveTimeout);

    //debounce storage to avoid quota errors. AKA, wait a shot time before saving to storage
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({highlightColor: color});
      
      //notify every tab that the color has changed
      chrome.tabs.query({}, (tabs) => {
        for(const tab of tabs) {
          if(!tab.id) continue;
          chrome.tabs.sendMessage(tab.id, {
            type: "HIGHLIGHT_COLOR_UPDATED", color
          }, () => {
            if (chrome.runtime.lastError) {
            // //swallow the error so Chrome doesn't log it
            // console.debug("No listener in tab", tab.id);
            }
          });
        }
      });
    }, 150)

    sendResponse({ status: "ok"});

    //have this listener respond asynchronously after the timeout, prevents sendResponse from failing when the service worker pauses, 
    //prevents “Extension context invalidated”
    return true;
  }

  //auth handler
  if (request.type !== "GET_AUTH_TOKEN") return;

  const interactive = request.interactive || false;
  const prompt = request.prompt || null;

  // Helper functions for responding
  function respondAuthError(message) {
    sendResponse({ authenticated: false, error: message });
  }

  function respondAuthSuccess(token) {
    sendResponse({ authenticated: true, token });
  }

  // Wrap chrome.identity calls in promises to keep worker alive
  const getTokenAsync = (options) =>
    new Promise((resolve) => chrome.identity.getAuthToken(options, resolve));

  const removeCachedTokenAsync = (token) =>
    new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));

  //Main async flow
  (async () => {
    try {
      if (interactive && prompt === "select_account") {
        //Get initial token
        const token = await getTokenAsync({ interactive: true });
        if (!token) return respondAuthError("No token retrieved during account selection.");

        // Remove cached token
        await removeCachedTokenAsync(token);

        //Get a fresh token
        const freshToken = await getTokenAsync({ interactive: true });
        if (!freshToken) return respondAuthError("No fresh token retrieved.");

        return respondAuthSuccess(freshToken);
      } else {
        // Normal token retrieval
        const token = await getTokenAsync({ interactive });
        if (!token) return respondAuthError("No token returned.");

        respondAuthSuccess(token);
      }
    } catch (err) {
      respondAuthError(err?.message || "Unknown error");
    }
  })();

  // Keep sendResponse valid for async call
  return true;
});