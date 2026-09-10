// Quick test: can sharp read a Sony ARW file?
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";

const testFile = "C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA\\DSC00460.ARW";

console.log("Testing ARW → JPEG conversion with sharp...");
try {
  const buf = readFileSync(testFile);
  console.log(`ARW file size: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  const result = await sharp(buf)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  writeFileSync("C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA\\test-output.jpg", result);
  console.log(`✅ SUCCESS — output: ${(result.length / 1024).toFixed(0)} KB`);
} catch (err) {
  console.error(`❌ FAILED: ${err.message}`);
}
process.exit(0);
