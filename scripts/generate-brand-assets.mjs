// Gera os ativos estáticos da marca (logo pública, favicon e ícones do navegador) com a mesma
// geometria do componente LogoPDVTEC, mantendo tudo sincronizado.
// Uso: node scripts/generate-brand-assets.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  PATH_AUTOMACAO,
  PATH_COMERCIAL,
  PATH_PDV,
  PATH_TEC,
} from "../src/components/layout/logo-pdvtec-paths.ts";

const r2 = (n) => Math.round(n * 100) / 100;

function signedArea(subpath) {
  const pts = [...subpath.matchAll(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return area;
}

const outerContours = (d) => d.split(/(?=M)/).filter((sub) => signedArea(sub) > 0).join("");

function globe(id, cx, cy, r) {
  const beamY = r2(cy + r * 0.08);
  const sw = r2(r * 0.012);
  const parallels = [-0.66, -0.34, 0, 0.34, 0.66]
    .map((k) => {
      const y = r2(cy + r * k);
      const half = r * Math.sqrt(1 - k * k);
      const bend = k === 0 ? 0 : r * 0.1 * Math.sign(k);
      return `<path d="M${r2(cx - half)} ${y}Q${cx} ${r2(y + bend)} ${r2(cx + half)} ${y}"/>`;
    })
    .join("");
  const meridians = [0.28, 0.58, 0.86]
    .map((k) => `<ellipse cx="${cx}" cy="${cy}" rx="${r2(r * k)}" ry="${r}"/>`)
    .join("");

  return `<defs>
<radialGradient id="${id}-base" cx="${cx}" cy="${r2(cy - r * 0.12)}" r="${r}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#22A6E2"/><stop offset="0.55" stop-color="#0A8ACB"/><stop offset="0.85" stop-color="#0275B7"/><stop offset="1" stop-color="#035A8F"/>
</radialGradient>
<linearGradient id="${id}-gloss" x1="0" y1="${cy - r}" x2="0" y2="${r2(cy - r * 0.1)}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="0.45" stop-color="#BFEAFB" stop-opacity="0.35"/><stop offset="1" stop-color="#7DD3FC" stop-opacity="0"/>
</linearGradient>
<radialGradient id="${id}-beam" cx="${cx}" cy="${beamY}" r="${r2(r * 0.95)}" gradientTransform="matrix(1 0 0 0.3 0 ${r2(beamY * 0.7)})" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#E0F7FF" stop-opacity="0.85"/><stop offset="0.35" stop-color="#67E8F9" stop-opacity="0.45"/><stop offset="1" stop-color="#38BDF8" stop-opacity="0"/>
</radialGradient>
<clipPath id="${id}-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
</defs>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-base)"/>
<g clip-path="url(#${id}-clip)">
<g fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="${sw}"><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/>${meridians}${parallels}</g>
<ellipse cx="${cx}" cy="${beamY}" rx="${r2(r * 0.95)}" ry="${r2(r * 0.3)}" fill="url(#${id}-beam)"/>
<ellipse cx="${cx}" cy="${r2(cy - r * 0.55)}" rx="${r2(r * 0.78)}" ry="${r2(r * 0.45)}" fill="url(#${id}-gloss)"/>
</g>
<circle cx="${cx}" cy="${cy}" r="${r2(r * 0.994)}" fill="none" stroke="#035A8F" stroke-width="${sw}"/>`;
}

function lettering(id, d, fill, stroke, strokeWidth, offset) {
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="134"><rect width="220" height="134" fill="#FFFFFF"/><path d="${outerContours(d)}" fill="#000000"/></mask></defs>
<g mask="url(#${id})"><path d="${d}" fill="#062338" fill-opacity="0.55" transform="translate(${offset} ${offset * 1.3})"/></g>
<path d="${d}" fill="${fill}" fill-opacity="1" fill-rule="nonzero" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke"/>`;
}

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 134" role="img" aria-label="PDVTEC Automação Comercial">
${globe("pl", 59.5, 67, 58)}
${lettering("pl-pdv", PATH_PDV, "#FFFFFF", "#0B3A5C", 0.7, 1)}
${lettering("pl-tec", PATH_TEC, "#0284C7", "#062338", 0.7, 1)}
${lettering("pl-aut", PATH_AUTOMACAO, "#FFFFFF", "#0B3A5C", 0.35, 0.5)}
${lettering("pl-com", PATH_COMERCIAL, "#0284C7", "#062338", 0.35, 0.5)}
</svg>
`;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${globe("pi", 32, 32, 30)}
</svg>
`;

/** ICO com imagens PNG embutidas (formato aceito por todos os navegadores atuais). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const renderIcon = (size) => sharp(Buffer.from(iconSvg), { density: 72 * (size / 64) * 4 }).resize(size, size).png().toBuffer();

await writeFile("public/logo-pdvtec.svg", logoSvg);
await writeFile("src/app/icon.svg", iconSvg);

// Apple não aceita transparência: o globo vai sobre o fundo off-white da aplicação.
const appleInner = await renderIcon(160);
await writeFile(
  "src/app/apple-icon.png",
  await sharp({ create: { width: 180, height: 180, channels: 4, background: "#F4F6F8" } })
    .composite([{ input: appleInner, top: 10, left: 10 }])
    .png()
    .toBuffer(),
);

const icoSizes = [16, 32, 48];
await writeFile(
  "src/app/favicon.ico",
  buildIco(await Promise.all(icoSizes.map(async (size) => ({ size, data: await renderIcon(size) })))),
);

console.log("Ativos da marca gerados: public/logo-pdvtec.svg, src/app/{icon.svg,apple-icon.png,favicon.ico}");
