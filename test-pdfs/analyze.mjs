import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pdfjsLib;
try {
    pdfjsLib = await import('/tmp/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
} catch(e) {
    console.error('Could not load pdfjs-dist:', e.message);
    process.exit(1);
}

async function extractNormalized(pdfPath) {
    const data = new Uint8Array(readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const pageText = tc.items.map(i => i.str).join(' ');
        fullText += pageText + ' ';
    }
    const normalized = fullText
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, '-')
        .trim();
    pdf.destroy();
    return normalized;
}

// Analyze 032
const targetPath = join(__dirname, '2026-032f.pdf');
const text032 = await extractNormalized(targetPath);

console.log('========== 2026-032f.pdf ==========\n');

// Find ALL B.X occurrences with context
const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
let m;
while ((m = pointPattern.exec(text032)) !== null) {
    const clean = m[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
    const start = Math.max(0, m.index - 80);
    const before = text032.substring(start, m.index);
    const after = text032.substring(m.index, m.index + m[0].length + 40);
    console.log(`[pos ${m.index}] B.${clean}`);
    console.log(`  BEFORE: ...${before}`);
    console.log(`  MATCH+: ${after}`);
    console.log();
}

// Locate two test passages
const passages = [
    { label: 'passage1 (should be B.6)', text: "Il ressort de la jurisprudence du Conseil" },
    { label: 'passage2 (should be B.9)', text: "Pour le reste, contrairement" },
];

for (const p of passages) {
    const norm = p.text.replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
    const pos = text032.lastIndexOf(norm);
    console.log(`--- ${p.label} ---`);
    console.log(`Position: ${pos}`);
    if (pos !== -1) {
        const before = text032.substring(Math.max(0, pos - 300), pos);
        console.log(`300 chars before:\n...${before}\n`);
    }
}
