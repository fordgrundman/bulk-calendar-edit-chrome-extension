const statusDiv = document.getElementById("status");
const accountInfoDiv = document.getElementById("accountInfo");
const signinBtn = document.getElementById("signin");
const signoutBtn = document.getElementById("signout");

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
    });

    if (response?.authenticated) {
      statusDiv.textContent = "Signed in";
      statusDiv.className = "status signed-in";
      signinBtn.disabled = true;
      signoutBtn.disabled = false;

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

signinBtn.addEventListener("click", async () => {
  statusDiv.textContent = "Signing in...";
  signinBtn.disabled = true;

  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) chrome.identity.removeCachedAuthToken({ token }, () => {});
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_AUTH_TOKEN",
      interactive: true,
      prompt: "select_account",
    });

    if (response?.authenticated) {
      statusDiv.textContent = "Sign in successful!";
      statusDiv.className = "status signed-in";
      setTimeout(checkAuthStatus, 500);
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

signoutBtn.addEventListener("click", () => {
  statusDiv.textContent = "Signing out...";
  signoutBtn.disabled = true;

  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
        statusDiv.textContent = "Signed out";
        statusDiv.className = "status signed-out";
        accountInfoDiv.textContent = "";
        signinBtn.disabled = false;
        signoutBtn.disabled = true;
      });
    } else {
      statusDiv.textContent = "Signed out";
      statusDiv.className = "status signed-out";
      signinBtn.disabled = false;
      signoutBtn.disabled = true;
    }
  });
});

checkAuthStatus();
