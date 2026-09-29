const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
const svg = (pad) => {
  const s = 512, c = s / 2, r = 150 * (1 - pad), sw = 44 * (1 - pad);
  const circ = 2 * Math.PI * r;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#0e1116"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#262b33" stroke-width="${sw}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#8db7de" stroke-width="${sw}" stroke-linecap="round"
    stroke-dasharray="${circ * 0.72} ${circ}" transform="rotate(-90 ${c} ${c})"/>
  <path d="M${c - 52 * (1 - pad)} ${c + 4} l${36 * (1 - pad)} ${36 * (1 - pad)} l${70 * (1 - pad)} ${-78 * (1 - pad)}" fill="none" stroke="#eceef1" stroke-width="${30 * (1 - pad)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);
};
(async () => {
  await sharp(svg(0)).resize(512).png().toFile('public/icon-512.png');
  await sharp(svg(0)).resize(192).png().toFile('public/icon-192.png');
  await sharp(svg(0)).resize(180).png().toFile('public/apple-touch-icon.png');
  await sharp(svg(0.22)).resize(512).png().toFile('public/icon-maskable-512.png');
  console.log('icons ok');
})();
