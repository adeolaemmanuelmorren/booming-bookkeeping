function decodedHtml(expression) {
  return `replace(
    replace(
      replace(
        replace(
          replace(
            replace(coalesce(${expression}, ''), '&amp;', '&'),
            '&quot;',
            '"'
          ),
          '&#39;',
          "'"
        ),
        '&apos;',
        "'"
      ),
      '&nbsp;',
      ' '
    ),
    '&#44;',
    ','
  )`;
}

function normalizedProduct(expression) {
  return `nullif(
    trim(
      regexp_replace(
        lower(${decodedHtml(expression)}),
        r'\\s+',
        ' '
      )
    ),
    ''
  )`;
}

module.exports = {
  decodedHtml,
  normalizedProduct,
};
