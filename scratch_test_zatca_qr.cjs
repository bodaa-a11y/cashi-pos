const crypto = require('crypto');

function generateZatcaString(sellerName, vatNumber, dateStr, total, vatAmount) {
  let normalizedDate = dateStr;
  try {
    const d = new Date(dateStr);
    const pad = (n) => n.toString().padStart(2, '0');
    normalizedDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
  } catch (e) {
    normalizedDate = dateStr.split('.')[0] + 'Z';
  }

  const getTlv = (tag, val) => {
    const valBuf = Buffer.from(val, 'utf-8');
    const tagBuf = Buffer.from([tag]);
    const lenBuf = Buffer.from([valBuf.length]);
    return Buffer.concat([tagBuf, lenBuf, valBuf]);
  };

  const tlv1 = getTlv(1, sellerName);
  const tlv2 = getTlv(2, vatNumber);
  const tlv3 = getTlv(3, normalizedDate);
  const tlv4 = getTlv(4, total.toFixed(2));
  const tlv5 = getTlv(5, vatAmount.toFixed(2));

  const combined = Buffer.concat([tlv1, tlv2, tlv3, tlv4, tlv5]);
  return combined.toString('base64');
}

// Now let's try to decode a generated base64 string!
function decodeZatcaString(base64Str) {
  const buf = Buffer.from(base64Str, 'base64');
  let offset = 0;
  const tags = {};
  
  while (offset < buf.length) {
    const tag = buf[offset];
    const len = buf[offset + 1];
    const val = buf.slice(offset + 2, offset + 2 + len).toString('utf-8');
    tags[tag] = val;
    offset += 2 + len;
  }
  return tags;
}

const seller = "مؤسسة مقبوله مران غازي الهفيل للتجارة";
const vat = "311798679800003";
const date = "2026-07-11T14:41:29Z";
const total = 10.00;
const vatAmount = 1.30;

const base64 = generateZatcaString(seller, vat, date, total, vatAmount);
console.log("Generated Base64:", base64);

const decoded = decodeZatcaString(base64);
console.log("Decoded Tags:");
console.log("Tag 1 (Seller):", decoded[1]);
console.log("Tag 2 (VAT):", decoded[2]);
console.log("Tag 3 (Date):", decoded[3]);
console.log("Tag 4 (Total):", decoded[4]);
console.log("Tag 5 (VAT Amount):", decoded[5]);

if (decoded[1] === seller && decoded[2] === vat && decoded[3] === date && Number(decoded[4]) === total && Number(decoded[5]) === vatAmount) {
  console.log("SUCCESS: TLV base64 matches perfectly!");
} else {
  console.log("FAILURE: Mismatch in decoded values!");
}
