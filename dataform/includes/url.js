function urlParameter(urlExpression, parameterName) {
  return `(
    select nullif(trim(split(parameter, '=')[safe_offset(1)]), '')
    from unnest(split(split(coalesce(${urlExpression}, ''), '?')[safe_offset(1)], '&')) as parameter
    where lower(split(parameter, '=')[safe_offset(0)]) = lower('${parameterName}')
    limit 1
  )`;
}

function urlHost(urlExpression) {
  return `nullif(lower(net.host(${urlExpression})), '')`;
}

function normalizedSource(sourceExpression) {
  return `case
    when lower(${sourceExpression}) in ('fb', 'ig', 'facebook', 'instagram', 'meta', 'an', 'th', 'msg')
      then 'meta'
    when lower(${sourceExpression}) in ('google', 'adwords')
      then 'google'
    when lower(${sourceExpression}) in ('tiktok', 'tt')
      then 'tiktok'
    else nullif(lower(trim(${sourceExpression})), '')
  end`;
}

module.exports = {
  normalizedSource,
  urlHost,
  urlParameter,
};
