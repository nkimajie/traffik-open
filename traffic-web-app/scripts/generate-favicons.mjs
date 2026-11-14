import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svg = path.join(root, "app/icon.svg");
const appDir = path.join(root, "app");
const tmpDir = path.join(root, ".tmp-favicons");

fs.mkdirSync(tmpDir, { recursive: true });

const sizes = [16, 32];
const pngPaths = sizes.map((size) => {
  const pngPath = path.join(tmpDir, `favicon-${size}.png`);
  execSync(`rsvg-convert -w ${size} -h ${size} "${svg}" -o "${pngPath}"`);
  return pngPath;
});

execSync(
  `rsvg-convert -w 180 -h 180 "${svg}" -o "${path.join(appDir, "apple-icon.png")}"`,
);

function pngToIco(pngFiles, outPath) {
  const pngs = pngFiles.map((file) => fs.readFileSync(file));
  const count = pngs.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const chunks = [header];

  for (const png of pngs) {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const entry = Buffer.alloc(dirEntrySize);

    entry[0] = width >= 256 ? 0 : width;
    entry[1] = height >= 256 ? 0 : height;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);

    chunks.push(entry);
    offset += png.length;
  }

  chunks.push(...pngs);
  fs.writeFileSync(outPath, Buffer.concat(chunks));
}

pngToIco(pngPaths, path.join(appDir, "favicon.ico"));
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("Generated app/favicon.ico and app/apple-icon.png from app/icon.svg");
