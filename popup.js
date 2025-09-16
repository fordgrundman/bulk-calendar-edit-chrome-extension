document.getElementById("signin").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "AUTH" }, (response) => {
    const output = document.getElementById("output");

    if (response.error) {
      output.textContent = "Auth failed: " + response.error;
      return;
    }

    const token = response.token;
    output.textContent = "Got token: " + token;

    //Example API CALL: list calendars
    fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => {
        output.textContent +=
          "\n\nCalendars:\n" + JSON.stringify(data, null, 2);
      })
      .catch((err) => {
        output.textContent += "\n\nError calling API: " + err;
      });
  });
});
