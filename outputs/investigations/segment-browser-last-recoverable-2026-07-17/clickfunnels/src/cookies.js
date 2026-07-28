function decodeCookieValue(value) {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

export function getCookie(name) {
  var pairs = document.cookie ? document.cookie.split("; ") : [];

  for (var i = 0; i < pairs.length; i += 1) {
    var pair = pairs[i];
    var separatorIndex = pair.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    var key = pair.slice(0, separatorIndex);
    var value = pair.slice(separatorIndex + 1);
    if (key === name) {
      return decodeCookieValue(value);
    }
  }

  return "";
}

export function setCookie(name, value, hours) {
  var expires = "";
  var secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (hours) {
    var date = new Date();
    date.setTime(date.getTime() + hours * 60 * 60 * 1e3);
    expires = "; expires=" + date.toUTCString();
  }

  document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax" + secure;
}

export function parseJsonCookie(name) {
  var raw = getCookie(name);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) || {};
  } catch (error) {
    try {
      return JSON.parse(decodeURIComponent(raw)) || {};
    } catch (decodeError) {
      return {};
    }
  }
}
