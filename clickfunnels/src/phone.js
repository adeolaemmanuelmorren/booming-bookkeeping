export function normalizePhoneNumber(value) {
  var raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  var digits = raw.replace(/[^0-9]/g, "");

  if (raw.indexOf("+00") === 0 || raw.indexOf("00") === 0) {
    digits = digits.slice(2);
  }

  if (digits.length === 10) {
    digits = "1" + digits;
  }

  if (digits.length < 11 || digits.length > 15) {
    return "";
  }

  return "+" + digits;
}

export function normalizePhoneTraits(source) {
  source = source || {};

  var output = {};
  var key;

  for (key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      output[key] = source[key];
    }
  }

  var phone = findNormalizedPhone([source]);

  delete output.phone;
  delete output.phone_number;

  if (!phone) {
    return output;
  }

  output.phone = phone;
  output.phone_number = phone;

  return output;
}

export function findNormalizedPhone(sources) {
  var names = ["phone_number", "phone", "mobile"];

  for (var i = 0; i < sources.length; i += 1) {
    var source = sources[i] || {};

    for (var j = 0; j < names.length; j += 1) {
      var phone = normalizePhoneNumber(source[names[j]]);

      if (phone) {
        return phone;
      }
    }
  }

  return "";
}
