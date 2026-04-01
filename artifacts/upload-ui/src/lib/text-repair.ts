const MOJIBAKE_SIGNATURE =
  /(Ã.|Â.|Ä.|Æ.|Ð.|Ñ.|Ø.|Þ.|ß.|áº|á»|â€™|â€œ|â€|Ä|Æ°|Æ¡|Ä©)/;
const MOJIBAKE_TOKEN = /Ã|Â|Ä|Æ|Ð|Ñ|Ø|Þ|ß|áº|á»|â€™|â€œ|â€|Ä|Æ°|Æ¡|Ä©/g;

const getMojibakeScore = (value: string) =>
  value.match(MOJIBAKE_TOKEN)?.length ?? 0;

const decodeLatin1AsUtf8 = (value: string) => {
  const bytes = Uint8Array.from(
    Array.from(value),
    (char) => char.charCodeAt(0) & 0xff,
  );
  return new TextDecoder("utf-8").decode(bytes);
};

export const repairMojibakeText = (value: string) => {
  if (!MOJIBAKE_SIGNATURE.test(value)) return value;

  const repaired = decodeLatin1AsUtf8(value);
  return getMojibakeScore(repaired) < getMojibakeScore(value)
    ? repaired
    : value;
};

export const repairNullableText = (value: string | null | undefined) => {
  if (value == null) return value ?? null;
  return repairMojibakeText(value);
};
