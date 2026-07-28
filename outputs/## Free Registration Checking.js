## Free Registration Checking

```<script>
(function () {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }

  function sha256(value, callback) {
    if (!value || !window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      callback(null);
      return;
    }

    var encoder = new TextEncoder();
    var data = encoder.encode(value);

    window.crypto.subtle.digest("SHA-256", data).then(function (hashBuffer) {
      var bytes = new Uint8Array(hashBuffer);
      var hex = "";
      var i;
      var byteHex;

      for (i = 0; i < bytes.length; i += 1) {
        byteHex = bytes[i].toString(16);
        if (byteHex.length < 2) {
          byteHex = "0" + byteHex;
        }
        hex += byteHex;
      }

      callback(hex);
    }).catch(function () {
      callback(null);
    });
  }

  function hashValues(values, callback) {
    var results = [];
    var remaining = values.length;
    var i;

    for (i = 0; i < values.length; i += 1) {
      (function (index) {
        sha256(values[index], function (hash) {
          results[index] = hash;
          remaining -= 1;

          if (remaining === 0) {
            callback(results);
          }
        });
      })(i);
    }
  }

  var waitForPopup = setInterval(function () {
    var emailInput = document.querySelector('input[name="email"]');
    var phoneInput = document.querySelector('input[name="phone"]');
    var firstNameInput = document.querySelector('input[name="first_name"]');
    var submitLink = document.querySelector('a[href="#submit-form"]');

    if (!emailInput || !phoneInput || !firstNameInput || !submitLink) {
      return;
    }

    clearInterval(waitForPopup);

    submitLink.addEventListener("click", function (event) {
      event.preventDefault();

      setTimeout(function () {
        var email = (emailInput.value || "").trim().toLowerCase();
        var phone = (phoneInput.value || "").trim().replace(/[^0-9+]/g, "");
        var firstName = (firstNameInput.value || "").trim().toLowerCase();
        var eventId = "cf_free_" + Date.now();
        var fbp = getCookie("_fbp") || "";
        var fbc = getCookie("_fbc") || "";
        var userAgent = navigator.userAgent;

        hashValues([email, phone, firstName], function (hashedFields) {
          var userData = {
            fbp: fbp,
            fbc: fbc,
            client_user_agent: userAgent
          };

          if (hashedFields[0]) {
            userData.em = hashedFields[0];
          }
          if (hashedFields[1]) {
            userData.ph = hashedFields[1];
          }
          if (hashedFields[2]) {
            userData.fn = hashedFields[2];
          }

          if (typeof fbq === "function") {
            fbq("trackCustom", "Complete Free Registration", {
              content_name: "Free BBB Challenge",
              value: 0.00,
              currency: "USD",
              eventID: eventId
            });
          }

          fetch("https://events.thebookkeepingchallenge.com", {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_name: "Complete Free Registration",
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              action_source: "website",
              user_data: userData,
              custom_data: {
                content_name: "Free BBB Challenge",
                value: 0.00,
                currency: "USD"
              }
            })
          });
        });
      }, 300);
    });
  }, 300);
})();
</script>
````


