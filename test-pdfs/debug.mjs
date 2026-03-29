import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfjsLib = await import('/tmp/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

async function extractNormalized(pdfPath) {
    const data = new Uint8Array(readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        fullText += tc.items.map(i => i.str).join(' ') + ' ';
    }
    pdf.destroy();
    return fullText
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, '-')
        .trim();
}

const text032 = await extractNormalized(join(__dirname, '2026-032f.pdf'));

// Check what text is around position of "Il ressort"
const simpleSearch = "Il ressort de la jurisprudence du Conseil";
const pos = text032.indexOf(simpleSearch);
console.log("Simple search 'Il ressort de la jurisprudence du Conseil':", pos);

// Check for curly quotes
const search2 = "Il ressort de la jurisprudence du Conseil d";
const pos2 = text032.indexOf(search2);
console.log("Partial search:", pos2);
if (pos2 !== -1) {
    // Show the 20 chars after this match
    console.log("Chars after 'd': ", JSON.stringify(text032.substring(pos2 + search2.length, pos2 + search2.length + 20)));
    // Show char codes
    const snippet = text032.substring(pos2 + search2.length, pos2 + search2.length + 5);
    for (let i = 0; i < snippet.length; i++) {
        console.log(`  char[${i}]: '${snippet[i]}' = U+${snippet.charCodeAt(i).toString(16).padStart(4, '0')}`);
    }
}

// Also check "Il s'ensuit" for B.10
const search3 = "Il s";
// Find all occurrences near position 29000+
let p3 = text032.indexOf(search3, 29000);
while (p3 !== -1 && p3 < 30000) {
    const ctx = text032.substring(p3, p3 + 60);
    console.log(`\n"Il s..." at ${p3}: ${JSON.stringify(ctx)}`);
    const char = text032[p3 + 4];
    console.log(`  char after "Il s": '${char}' = U+${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
    p3 = text032.indexOf(search3, p3 + 1);
}

// Show the B.3 heading context
console.log("\n\n--- B.3 heading context ---");
const b3pos = text032.indexOf("B.3.");
if (b3pos !== -1) {
    console.log("B.3 at pos", b3pos);
    console.log("80 chars before B.3:", JSON.stringify(text032.substring(b3pos - 80, b3pos)));
    console.log("After B.3:", text032.substring(b3pos, b3pos + 80));
}
