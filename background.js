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

//listen for messages from popup.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AUTH") {
    getAuthToken(true)
      .then((token) => {
        sendResponse({ token });
      })
      .catch((err) => {
        sendResponse({ error: err.message || err });
      });
    return true; //keep message channel open for async
  }
});
