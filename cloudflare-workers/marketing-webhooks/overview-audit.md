This code currently gets fired on funnel id = krb && funnel_step = challenge_order

```<script>
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
```
