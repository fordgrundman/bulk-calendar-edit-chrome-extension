chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  //acknowledge the periodic ping added to keep service worker active always
  if (request.type === "PING") {
    sendResponse({ ok: true });
    return true;
  }

  if (request.type === "GET_AUTH_TOKEN") {
    const interactive = request.interactive || false;
    const prompt = request.prompt || null;

    function respondAuthError(message) {
      sendResponse({ authenticated: false, error: message });
    }

    function respondAuthSuccess(token) {
      sendResponse({ authenticated: true, token });
    }

    //account selection requires forcing removal then requesting again
    if (interactive && prompt === "select_account") {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (!token) {
          respondAuthError("No token retrieved during account selection.");
          return;
        }

        chrome.identity.removeCachedAuthToken({ token }, () => {
          chrome.identity.getAuthToken({ interactive: true }, (freshToken) => {
            if (!freshToken) {
              respondAuthError("No fresh token retrieved.");
            } else {
              respondAuthSuccess(freshToken);
            }
          });
        });
      });

      return true;
    }

    //normal token retrieval
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        respondAuthError(chrome.runtime.lastError.message);
      } else if (token) {
        respondAuthSuccess(token);
      } else {
        respondAuthError("No token returned.");
      }
    });

    return true;
  }
});
