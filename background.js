chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
});

//function to authenticate and get token
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, function (token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

//listen for messages from popup.js and content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "AUTH") {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        //store token for content script to use
        await chrome.storage.local.set({
          auth_token: token,
          is_authenticated: true,
          auth_timestamp: Date.now(),
        });
        sendResponse({ token: token });
      }
    });
    return true;
  }

  //Handle requests from content.js for auth token
  if (request.type === "GET_AUTH_TOKEN") {
    chrome.storage.local.get(["auth_token", "is_authenticated"], (result) => {
      if (result.is_authenticated && result.auth_token) {
        sendResponse({ token: result.auth_token, authenticated: true });
      } else {
        sendResponse({ authenticated: false });
      }
    });
    return true;
  }

  //Handle auth check requests
  if (request.type === "CHECK_AUTH") {
    chrome.storage.local.get(["is_authenticated"], (result) => {
      sendResponse({ authenticated: !!result.is_authenticated });
    });
    return true;
  }
});
