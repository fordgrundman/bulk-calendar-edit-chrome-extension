chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_AUTH_TOKEN") {
    const interactive = request.interactive || false;
    const prompt = request.prompt || null;

    if (interactive && prompt === "select_account") {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, () => {});
        }
      });
    }

    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          authenticated: false,
          error: chrome.runtime.lastError.message,
        });
      } else if (token) {
        sendResponse({ authenticated: true, token });
      } else {
        sendResponse({ authenticated: false });
      }
    });

    return true;
  }
});
