var PACIFIC_TIME_ZONE = "America/Los_Angeles";

var SHA256_INITIAL_STATE = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
];

var SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotateRight(value, shift) {
  return (value >>> shift) | (value << (32 - shift));
}

function toUtf8Bytes(value) {
  return new TextEncoder().encode(String(value || ""));
}

function padSha256Message(bytes) {
  var messageLength = bytes.length;
  var paddedLength = Math.ceil((messageLength + 9) / 64) * 64;
  var padded = new Uint8Array(paddedLength);
  var view = new DataView(padded.buffer);
  var bitLength = messageLength * 8;

  padded.set(bytes);
  padded[messageLength] = 0x80;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  return padded;
}

function toHex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

export function sha256Hex(value) {
  var message = padSha256Message(toUtf8Bytes(value));
  var state = SHA256_INITIAL_STATE.slice();
  var words = new Uint32Array(64);
  var view = new DataView(message.buffer);
  var offset;

  for (offset = 0; offset < message.length; offset += 64) {
    var index;

    for (index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + (index * 4));
    }

    for (index = 16; index < 64; index += 1) {
      var previous15 = words[index - 15];
      var previous2 = words[index - 2];
      var sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      var sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);

      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    var a = state[0];
    var b = state[1];
    var c = state[2];
    var d = state[3];
    var e = state[4];
    var f = state[5];
    var g = state[6];
    var h = state[7];

    for (index = 0; index < 64; index += 1) {
      var sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      var choice = (e & f) ^ (~e & g);
      var temporary1 = (h + sum1 + choice + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0;
      var sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      var majority = (a & b) ^ (a & c) ^ (b & c);
      var temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  return state.map(toHex).join("");
}

function decodeHtmlEntities(value) {
  var namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return String(value || "").replace(/&(#x[0-9a-f]+|#[0-9]+|amp|apos|gt|lt|nbsp|quot);/gi, function(match, entity) {
    var normalizedEntity = entity.toLowerCase();
    var codePoint;

    if (namedEntities[normalizedEntity] !== void 0) {
      return namedEntities[normalizedEntity];
    }

    codePoint = normalizedEntity.indexOf("#x") === 0
      ? parseInt(normalizedEntity.slice(2), 16)
      : parseInt(normalizedEntity.slice(1), 10);

    if (!Number.isFinite(codePoint)) {
      return match;
    }

    return String.fromCodePoint(codePoint);
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeProductName(value) {
  return decodeHtmlEntities(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePaymentMethodId(value) {
  value = String(value || "").trim();

  if (!/^pm_[A-Za-z0-9]+$/.test(value)) {
    return "";
  }

  return value;
}

export function getPacificEventDate(value) {
  var date = value instanceof Date ? value : new Date(value);
  var dateParts = {};
  var formatter;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  formatter.formatToParts(date).forEach(function(part) {
    dateParts[part.type] = part.value;
  });

  return [dateParts.year, dateParts.month, dateParts.day].join("-");
}

export function getPacificPurchaseDate(value) {
  return getPacificEventDate(value);
}

export function createFormSubmissionEventId(details) {
  details = details || {};

  var email = normalizeEmail(details.email);
  var registrationType = String(details.registrationType || "")
    .trim()
    .toLowerCase();
  var submissionDate = String(details.submissionDate || "").trim();

  if (
    !email
    || !registrationType
    || !/^\d{4}-\d{2}-\d{2}$/.test(submissionDate)
  ) {
    return "";
  }

  return "form_submission_" + sha256Hex([
    email,
    registrationType,
    submissionDate,
  ].join("|"));
}

export function createPurchaseEventId(details) {
  details = details || {};

  var email = normalizeEmail(details.email);
  var productName = normalizeProductName(details.productName);
  var paymentMethodId = normalizePaymentMethodId(details.paymentMethodId);
  var purchaseDate = String(details.purchaseDate || "").trim();

  if (!email || !productName || !paymentMethodId || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    return "";
  }

  return "purchase_" + sha256Hex([
    email,
    productName,
    paymentMethodId,
    purchaseDate,
  ].join("|"));
}

export function createPaymentEventId(paymentIntentId) {
  var normalizedId = String(paymentIntentId || "").trim();

  if (!/^pi_[A-Za-z0-9]+$/.test(normalizedId)) {
    return "";
  }

  return "purchase_" + normalizedId;
}
