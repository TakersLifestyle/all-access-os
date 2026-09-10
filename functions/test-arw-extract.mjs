// Extract largest embedded JPEG from Sony ARW binary
import { readFileSync, writeFileSync } from "fs";

const testFile = "C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA\\DSC00460.ARW";
const buf = readFileSync(testFile);

console.log(`ARW size: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
console.log("Scanning for embedded JPEG markers...");

// Find all JPEG start markers (FF D8 FF) in the binary
const jpegSOI = [0xFF, 0xD8, 0xFF];
const jpegEOI = [0xFF, 0xD9];
const found = [];

for (let i = 0; i < buf.length - 3; i++) {
  if (buf[i] === 0xFF && buf[i+1] === 0xD8 && buf[i+2] === 0xFF) {
    // Found a JPEG start — now find its end
    let end = -1;
    for (let j = i + 2; j < buf.length - 1; j++) {
      if (buf[j] === 0xFF && buf[j+1] === 0xD9) {
        end = j + 2;
        break;
      }
    }
    if (end > i) {
      const size = end - i;
      found.push({ start: i, end, size });
      console.log(`  JPEG at offset ${i}: ${(size / 1024).toFixed(0)} KB`);
    }
    // Skip ahead
    i += 100;
  }
}

if (found.length === 0) {
  console.log("❌ No embedded JPEGs found");
  process.exit(1);
}

// Extract the LARGEST embedded JPEG (full-res preview)
found.sort((a, b) => b.size - a.size);
const best = found[0];
console.log(`\nLargest JPEG: offset ${best.start}, size ${(best.size/1024).toFixed(0)} KB`);

const jpegBuf = buf.slice(best.start, best.end);
const outFile = "C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA\\test-extracted.jpg";
writeFileSync(outFile, jpegBuf);
console.log(`✅ Extracted to: ${outFile}`);

process.exit(0);
