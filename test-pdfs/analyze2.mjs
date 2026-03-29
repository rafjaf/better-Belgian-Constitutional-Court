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

const XREF_PRECURSOR = /(?:points?\s+|punten?\s+|au\s+|aux\s+|du\s+|de\s+|le\s+|la\s+|les\s+|en\s+|voir\s+|cf\.\s*|het\s+|in\s+|van\s+|zie\s+|paragraphes?\s+|paragraaf\s+|numéros?\s+|n°\s*)$/i;

function detectBPoint(normalizedFullText, normalizedSelection) {
    // Fast path
    const fastMatch = normalizedSelection.match(/^B\.\s*(\d+(?:[\s.]*\d+)*)/);
    if (fastMatch) return fastMatch[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');

    let pos = normalizedFullText.lastIndexOf(normalizedSelection);
    if (pos === -1) {
        const w30 = normalizedSelection.split(' ').slice(0, 30).join(' ');
        pos = normalizedFullText.lastIndexOf(w30);
    }
    if (pos === -1) {
        const w10 = normalizedSelection.split(' ').slice(0, 10).join(' ');
        pos = normalizedFullText.lastIndexOf(w10);
    }
    if (pos === -1) return { result: '', debug: 'Selection not found' };

    const before = normalizedFullText.substring(0, pos);
    const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
    const kept = [];
    const skipped = [];
    let m;
    while ((m = pointPattern.exec(before)) !== null) {
        const clean = m[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
        const preceding = before.substring(Math.max(0, m.index - 60), m.index);
        if (XREF_PRECURSOR.test(preceding)) {
            skipped.push({ number: clean, pos: m.index, preceding: preceding.slice(-30) });
        } else {
            kept.push({ number: clean, pos: m.index, preceding: preceding.slice(-30) });
        }
    }
    const result = kept.length > 0 ? kept[kept.length - 1].number : '';
    return { result, kept, skipped, selPos: pos };
}

// ====== TEST SUITE ======
const files = ['2026-032f.pdf', '2026-025f.pdf', '2026-026f.pdf', '2026-027f.pdf',
               '2026-028f.pdf', '2026-029f.pdf', '2026-030f.pdf', '2026-031f.pdf',
               '2026-033f.pdf', '2026-034f.pdf', '2026-035f.pdf'];

// First, find some test passages from each PDF
for (const file of files) {
    const path = join(__dirname, file);
    try { readFileSync(path); } catch { continue; }
    const text = await extractNormalized(path);
    
    console.log(`\n============ ${file} ============`);
    
    // Find all B-point headings (those NOT preceded by XREF words)
    const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
    let m;
    const headings = [];
    while ((m = pointPattern.exec(text)) !== null) {
        const clean = m[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
        const preceding = text.substring(Math.max(0, m.index - 60), m.index);
        const isXref = XREF_PRECURSOR.test(preceding);
        headings.push({ number: clean, pos: m.index, xref: isXref, preceding: preceding.slice(-40) });
    }
    
    const realHeadings = headings.filter(h => !h.xref);
    const xrefHeadings = headings.filter(h => h.xref);
    
    console.log(`Total B.X occurrences: ${headings.length}`);
    console.log(`Real headings: ${realHeadings.map(h => 'B.' + h.number).join(', ')}`);
    if (xrefHeadings.length > 0) {
        console.log(`Filtered cross-refs: ${xrefHeadings.map(h => 'B.' + h.number + ' (..."' + h.preceding.slice(-20) + '")').join(', ')}`);
    }
    
    // Check for potential false positives in filtering (real headings that got filtered)
    // Real headings usually have the pattern: end-of-sentence punctuation + space + B.X
    // Cross-references have connector words before B.X
    for (const h of xrefHeadings) {
        // Check if this might actually be a heading (preceding ends with ". " or similar)
        if (/[.!?)]\s*$/.test(h.preceding) && !/\b(?:en|de|du|le|la|les|au|aux|voir|point|punt|cf)\s*$/i.test(h.preceding)) {
            console.log(`  WARNING: possibly false-filtered B.${h.number} (preceding: ..."${h.preceding}")`);
        }
    }
}

// ====== SPECIFIC TESTS FOR 032 ======
console.log('\n\n========== SPECIFIC TESTS for 032 ==========\n');
const text032 = await extractNormalized(join(__dirname, '2026-032f.pdf'));

const tests032 = [
    {
        label: 'B.6 passage',
        passage: "Il ressort de la jurisprudence du Conseil d\u2019\u00C9tat qu\u2019un contrat de gestion peut contenir des clauses de nature r\u00E9glementaire",
        expected: '6'
    },
    {
        label: 'B.9 passage',
        passage: "Pour le reste, contrairement \u00E0 ce que soutient le Conseil des ministres, une proc\u00E9dure de droit commun",
        expected: '9'
    },
    {
        label: 'B.3 passage',
        passage: "La Cour est interrog\u00E9e sur la compatibilit\u00E9",
        expected: '3'
    },
    {
        label: 'B.10 passage',
        passage: "Il s\u2019ensuit que la disposition en cause",
        expected: '10'
    },
];

for (const t of tests032) {
    const norm = t.passage.replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
    const result = detectBPoint(text032, norm);
    const pass = result.result === t.expected;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${t.label}: expected B.${t.expected}, got B.${result.result || '(none)'}`);
    if (!pass) {
        console.log(`  Selection at pos: ${result.selPos}`);
        console.log(`  Kept headings: ${(result.kept||[]).map(k => 'B.' + k.number).join(', ')}`);
        console.log(`  Skipped xrefs: ${(result.skipped||[]).map(s => 'B.' + s.number + '(..."' + s.preceding + '")').join(', ')}`);
    }
}
