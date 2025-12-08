const statusDiv = document.getElementById("status");
const accountInfoDiv = document.getElementById("accountInfo");
const signinBtn = document.getElementById("signin");
const signoutBtn = document.getElementById("signout");

// Holds the most recently retrieved token so logout can revoke it
window.lastToken = null;

async function checkAuthStatus() {
  statusDiv.textContent = "Checking authentication...";
  statusDiv.className = "status";
  signinBtn.disabled = true;
  signoutBtn.disabled = true;
  accountInfoDiv.textContent = "";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_AUTH_TOKEN",
      interactive: false,
      prompt: "select_account", // this is safe + keeps chooser available
    });

    if (response?.authenticated) {
      statusDiv.textContent = "Signed in";
      statusDiv.className = "status signed-in";
      signinBtn.disabled = true;
      signoutBtn.disabled = false;

      // Store token for logout
      window.lastToken = response.token;

      // Fetch user info
      const userInfo = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${response.token}` } }
      );

      if (userInfo.ok) {
        const data = await userInfo.json();
        accountInfoDiv.textContent = data.email;
      }
    } else {
      statusDiv.textContent = "Not signed in";
      statusDiv.className = "status signed-out";
      signinBtn.disabled = false;
      signoutBtn.disabled = true;
    }
  } catch (error) {
    statusDiv.textContent = "Not signed in";
    statusDiv.className = "status signed-out";
    signinBtn.disabled = false;
    signoutBtn.disabled = true;
  }
}

// Run on popup load
checkAuthStatus();

// ------------------------ SIGN IN ------------------------
signinBtn.addEventListener("click", async () => {
  statusDiv.textContent = "Signing in...";
  signinBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_AUTH_TOKEN",
      interactive: true,
    });

    if (response?.authenticated) {
      statusDiv.textContent = "Sign in successful!";
      statusDiv.className = "status signed-in";

      // Store token for logout
      window.lastToken = response.token;
    } else {
      statusDiv.textContent = "Sign in failed";
      statusDiv.className = "status signed-out";
      signinBtn.disabled = false;
    }
  } catch (error) {
    statusDiv.textContent = "Sign in failed";
    statusDiv.className = "status signed-out";
    signinBtn.disabled = false;
  }
});

// ------------------------ SIGN OUT ------------------------
signoutBtn.addEventListener("click", () => {
  statusDiv.textContent = "Signing out...";
  signoutBtn.disabled = true;

  chrome.runtime.sendMessage(
    {
      type: "LOGOUT",
      token: window.lastToken, // send token for safe revocation
    },
    (response) => {
      if (response?.success) {
        statusDiv.textContent = "Signed out";
        statusDiv.className = "status signed-out";

        accountInfoDiv.textContent = "";
        signinBtn.disabled = false;
        signoutBtn.disabled = true;
        window.lastToken = null;
      } else {
        statusDiv.textContent = "Logout failed";
        console.error(response?.error);
        signinBtn.disabled = false;
        signoutBtn.disabled = true;
      }
    }
  );
});

// --------------------------------------------------------------------------
// --------------------------- COLOR PICKER LOGIC ---------------------------
// --------------------------------------------------------------------------

const colorPicker = document.getElementById("colorPicker");
const colorInput = document.getElementById("colorInput");

// Keep color picker and text input in sync + send changes to background
colorPicker.addEventListener("input", () => {
  colorInput.value = colorPicker.value;

  chrome.runtime.sendMessage({
    type: "SET_HIGHLIGHT_COLOR",
    color: colorPicker.value,
  });
});

colorInput.addEventListener("input", () => {
  const hex = colorInput.value.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    colorPicker.value = hex;
    chrome.runtime.sendMessage({
      type: "SET_HIGHLIGHT_COLOR",
      color: hex,
    });
  }
});

// Load saved color only once on popup load
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("highlightColor", ({ highlightColor }) => {
    if (highlightColor) {
      colorPicker.value = highlightColor;
      colorInput.value = highlightColor;
    }
  });
});
