const basicNumbers = [
  'kosong',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'lapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

function integerToMalayWords(value: number): string {
  const number = Math.floor(value);

  if (number < 0) {
    return `negatif ${integerToMalayWords(Math.abs(number))}`;
  }

  if (number < 12) {
    return basicNumbers[number];
  }

  if (number < 20) {
    return `${integerToMalayWords(number - 10)} belas`;
  }

  if (number < 100) {
    const tens = Math.floor(number / 10);
    const remainder = number % 10;

    return [
      `${integerToMalayWords(tens)} puluh`,
      remainder > 0
        ? integerToMalayWords(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (number < 200) {
    const remainder = number - 100;

    return [
      'seratus',
      remainder > 0
        ? integerToMalayWords(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (number < 1000) {
    const hundreds = Math.floor(number / 100);
    const remainder = number % 100;

    return [
      `${integerToMalayWords(hundreds)} ratus`,
      remainder > 0
        ? integerToMalayWords(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (number < 2000) {
    const remainder = number - 1000;

    return [
      'seribu',
      remainder > 0
        ? integerToMalayWords(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (number < 1_000_000) {
    const thousands = Math.floor(number / 1000);
    const remainder = number % 1000;

    return [
      `${integerToMalayWords(thousands)} ribu`,
      remainder > 0
        ? integerToMalayWords(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (number < 1_000_000_000) {
    const millions = Math.floor(number / 1_000_000);
    const remainder = number % 1_000_000;

    return [
      `${integerToMalayWords(millions)} juta`,
      remainder > 0
        ? integerToMalayWords(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const billions = Math.floor(number / 1_000_000_000);
  const remainder = number % 1_000_000_000;

  return [
    `${integerToMalayWords(billions)} bilion`,
    remainder > 0
      ? integerToMalayWords(remainder)
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function amountToMalayWords(amount: number): string {
  const safeAmount =
    Number.isFinite(amount) && amount >= 0
      ? amount
      : 0;

  const totalSen = Math.round(safeAmount * 100);
  const ringgit = Math.floor(totalSen / 100);
  const sen = totalSen % 100;

  const ringgitWords = integerToMalayWords(ringgit);
  const senWords = integerToMalayWords(sen);

  return [
    'RINGGIT MALAYSIA',
    ringgitWords.toUpperCase(),
    'DAN SEN',
    senWords.toUpperCase(),
    'SAHAJA',
  ].join(' ');
}