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
```

<script>
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
        var payload = {
          event: "free_registration",
          eventId: eventId,
          content_name: "Free BBB Challenge",
          value: 0.00,
          currency: "USD"
        };

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(payload);
        console.log("[pushed] pushed", payload);

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

<script>
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
        var payload = {
          event: "free_registration",
          eventId: eventId,
          content_name: "Free BBB Challenge",
          value: 0.00,
          currency: "USD"
        };

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(payload);
        console.log("[pushed] pushed", payload);

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

<script>
(function () {
  function sha256(value, callback) {
    if (!value || !window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      callback("");
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
      callback("");
    });
  }

  function hashValues(values, callback) {
    var results = [];
    var remaining = values.length;
    var i;

    if (!remaining) {
      callback(results);
      return;
    }

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

  var krcVipPaid47WaitForButton = setInterval(function () {
    var btn = document.querySelector('a[href="#submit-form"], button[type="submit"]');
    var fullName = document.querySelector('input[name="name"]');
    var email = document.querySelector('input[name="email"]');
    var phone = document.querySelector('input[name="phone"]');
    var city = document.querySelector('input[name="shipping_city"]');
    var state = document.querySelector('input[name="shipping_state"]');
    var zip = document.querySelector('input[name="shipping_zip"]');
    var country = document.querySelector('select[name="shipping_country"]');

    if (!btn || !fullName || !email || !phone) {
      return;
    }

    clearInterval(krcVipPaid47WaitForButton);

    btn.addEventListener("click", function () {
      var nameVal = fullName.value.trim();
      var nameParts = nameVal.split(" ");
      var firstNameRaw = nameParts.shift() || "";
      var firstName = firstNameRaw.toLowerCase();
      var lastName = nameParts.join(" ").toLowerCase() || "";
      var emailVal = email.value.trim().toLowerCase();
      var phoneVal = phone.value.trim().replace(/\D/g, "");
      var cityVal = city && city.value ? city.value.trim().toLowerCase() : "";
      var stateVal = state && state.value ? state.value.trim().toLowerCase() : "";
      var zipVal = zip && zip.value ? zip.value.trim() : "";
      var countryVal = country && country.value ? country.value.trim().toLowerCase() : "";
      var fbp;
      var fbc;
      var eventId;
      var externalId;

      if (!firstName || !lastName || emailVal.indexOf("@") === -1 || phoneVal.length < 6) {
        return;
      }

      fbp = (document.cookie.match(/_fbp=([^;]+)/) || [])[1] || "";
      fbc = (document.cookie.match(/_fbc=([^;]+)/) || [])[1] || "";
      eventId = "btvip_" + Date.now();
      externalId = "external_" + Date.now();

      hashValues([emailVal, phoneVal, firstName, lastName], function (hashedFields) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "bt_krc_vip_paid_47",
          email: hashedFields[0],
          phone: hashedFields[1],
          first_name: hashedFields[2],
          last_name: hashedFields[3],
          city: cityVal,
          state: stateVal,
          zip: zipVal,
          country: countryVal,
          external_id: externalId,
          fbp: fbp,
          fbc: fbc,
          event_id: eventId,
          content_type: "krc-paid-vip",
          value: 47.0,
          currency: "USD"
        });
      });
    });
  }, 300);
})();
</script>

<script>
(function () {
  function sha256(value, callback) {
    if (!value || !window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      callback("");
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
      callback("");
    });
  }

  function hashValues(values, callback) {
    var results = [];
    var remaining = values.length;
    var i;

    if (!remaining) {
      callback(results);
      return;
    }

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

  var krbBbb997WaitForButton = setInterval(function () {
    var button = document.querySelector('a[href="#submit-form"], button[type="submit"]');
    var fullName = document.querySelector('input[name="name"]');
    var email = document.querySelector('input[name="email"]');
    var phone = document.querySelector('input[name="phone"]');
    var city = document.querySelector('input[name="city"]');
    var state = document.querySelector('input[name="state"]');
    var zip = document.querySelector('input[name="zip"]');
    var country = document.querySelector('select[name="country"]');

    if (!button || !fullName || !email || !phone) {
      return;
    }

    clearInterval(krbBbb997WaitForButton);

    button.addEventListener("click", function () {
      var nameValue = fullName.value.trim();
      var nameParts = nameValue.split(" ");
      var firstName = (nameParts.shift() || "").toLowerCase();
      var lastName = nameParts.join(" ").toLowerCase();
      var emailValue = email.value.trim().toLowerCase();
      var phoneValue = phone.value.trim().replace(/\D/g, "");
      var cityValue = city && city.value ? city.value.trim().toLowerCase() : "";
      var stateValue = state && state.value ? state.value.trim().toLowerCase() : "";
      var zipValue = zip && zip.value ? zip.value.trim() : "";
      var countryValue = country && country.value ? country.value.trim().toLowerCase() : "";
      var fbp;
      var fbc;
      var eventId;
      var externalId;

      if (!firstName || !lastName || emailValue.indexOf("@") === -1 || phoneValue.length < 6) {
        return;
      }

      fbp = (document.cookie.match(/_fbp=([^;]+)/) || [])[1] || "";
      fbc = (document.cookie.match(/_fbc=([^;]+)/) || [])[1] || "";
      eventId = "bbb_997" + Date.now();
      externalId = "external_" + Date.now();

      hashValues([emailValue, phoneValue, firstName, lastName], function (hashedFields) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "bbb_997",
          email: hashedFields[0],
          phone: hashedFields[1],
          first_name: hashedFields[2],
          last_name: hashedFields[3],
          city: cityValue,
          state: stateValue,
          zip: zipValue,
          country: countryValue,
          external_id: externalId,
          fbp: fbp,
          fbc: fbc,
          event_id: eventId,
          content_type: "bbb-paid",
          value: 4997.00,
          currency: "USD"
        });
      });
    });
  }, 300);
})();
</script>
