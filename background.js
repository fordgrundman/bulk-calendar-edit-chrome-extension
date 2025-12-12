let saveTimeout = null;

// Listener for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SET_HIGHLIGHT_COLOR") {
    const color = request.color;

    //wait a shot time before saving to storage to prevent quota errors
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({ highlightColor: color });

      //notify every tab that the color has changed
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (!tab.id) continue;
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: "HIGHLIGHT_COLOR_UPDATED",
              color,
            },
            () => {
              if (chrome.runtime.lastError) {
                // //swallow the error so Chrome doesn't log it
                // console.debug("No listener in tab", tab.id);
              }
            }
          );
        }
      });
    }, 150);

    sendResponse({ status: "ok" });

    //have this listener respond asynchronously after the timeout, prevents sendResponse from failing when the service worker pauses,
    //prevents “Extension context invalidated”
    return true;
  }

  //---------------------------------auth handler ----------------------
  if (request.type === "GET_AUTH_TOKEN") {
    const interactive = request.interactive || false;
    const prompt = request.prompt || null;
    const userEmail = null;

    function respondAuthError(message) {
      sendResponse({ authenticated: false, error: message });
    }

    function respondAuthSuccess(token) {
      sendResponse({ authenticated: true, token });
    }

    const getTokenAsync = (options) =>
      new Promise((resolve) => chrome.identity.getAuthToken(options, resolve));

    const removeCachedTokenAsync = (token) =>
      new Promise((resolve) =>
        chrome.identity.removeCachedAuthToken({ token }, resolve)
      );

    (async () => {
      try {
        if (interactive && prompt === "select_account") {
          // Step 1 — get a token so we know which one to remove
          const token = await getTokenAsync({ interactive: true });
          if (!token)
            return respondAuthError(
              "No token retrieved during account selection."
            );

          // Step 2 — remove it from Chrome Identity cache
          await removeCachedTokenAsync(token);

          // Step 3 — get a fresh one (forces chooser)
          const freshToken = await getTokenAsync({ interactive: true });
          if (!freshToken) return respondAuthError("No fresh token retrieved.");

          return respondAuthSuccess(freshToken);
        } else {
          // normal case
          const token = await getTokenAsync({ interactive });
          if (!token) return respondAuthError("No token returned.");

          respondAuthSuccess(token);
        }
      } catch (err) {
        respondAuthError(err?.message || "Unknown error");
      }
    })();

    return true; // keep channel open
  }

  // -------------------------------- LOGOUT HANDLER -------------------------
  if (request.type === "LOGOUT") {
    (async () => {
      // 1. Clear ALL cached tokens that belong to your extension
      chrome.identity.clearAllCachedAuthTokens(() => {
        // console.log("All cached auth tokens cleared.");
      });

      // 2. Try revoking the currently granted token (optional, harmless)
      if (request.token) {
        try {
          fetch(
            `https://accounts.google.com/o/oauth2/revoke?token=${request.token}`,
            {
              method: "POST",
              mode: "no-cors",
            }
          );
        } catch (e) {
          console.warn("Token revoke failed:", e);
        }
      }

      // Return logout confirmation
      sendResponse({ success: true });
    })();

    return true; // keep message channel open
  }
});
