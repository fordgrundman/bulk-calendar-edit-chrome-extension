document.getElementById("listevents").addEventListener("click", () => {
  chrome.identity.getAuthToken({ interactive: false }, function (token) {
    console.log("TOKEN: ", token);

    const headers = new Headers({
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    });

    const queryParams = { headers };

    fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      queryParams
    )
      .then((response) => response.json()) // Transform the data into json
      .then(function (data) {
        console.log("DATA: ", data);
        // do whatever you need with the data!
      });
  });
});
