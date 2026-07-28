export function mergeObjects(base, override) {
  var output = {};
  var key;

  base = base || {};
  override = override || {};

  for (key in base) {
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      output[key] = base[key];
    }
  }

  for (key in override) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      output[key] = override[key];
    }
  }

  return output;
}

export function stableStringify(value) {
  if (value === null || value === void 0) {
    return "";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }

  return "{" + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ":" + stableStringify(value[key]);
  }).join(",") + "}";
}

export function getNestedObject(source, key) {
  if (!source || typeof source !== "object") {
    return {};
  }

  var value = source[key];
  if (!value || typeof value !== "object") {
    return {};
  }

  return value;
}

export function copyFirstTraitValue(output, sources, outputName, sourceNames) {
  if (output[outputName]) {
    return;
  }

  for (var i = 0; i < sources.length; i += 1) {
    var source = sources[i];
    if (!source || typeof source !== "object") {
      continue;
    }

    for (var j = 0; j < sourceNames.length; j += 1) {
      var value = source[sourceNames[j]];
      if (value === null || value === void 0 || value === "") {
        continue;
      }

      output[outputName] = String(value).trim();
      return;
    }
  }
}

export function firstAttributionValue(source, names) {
  source = source || {};

  for (var i = 0; i < names.length; i += 1) {
    var value = source[names[i]];
    if (value === null || value === void 0 || value === "") {
      continue;
    }

    return String(value).trim();
  }

  return null;
}
