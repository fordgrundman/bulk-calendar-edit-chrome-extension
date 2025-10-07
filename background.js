chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_AUTH_TOKEN") {
    chrome.identity.getAuthToken({ interactive: false }, function (token) {
      if (chrome.runtime.lastError) {
        console.error("Auth error:", chrome.runtime.lastError);
        sendResponse({
          authenticated: false,
          error: chrome.runtime.lastError.message,
        });
      } else if (token) {
        //authenticate the token and approve content scripts requests
        sendResponse({ authenticated: true, token: token });
      } else {
        sendResponse({ authenticated: false, error: "No token received" });
      }
    });
    return true; // Keep the message channel open for async response
  }
});
