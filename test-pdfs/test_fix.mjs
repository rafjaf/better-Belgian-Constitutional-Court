import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfjsLib = await import('/tmp/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

// ============================================================
// IMPROVED detectBPoint logic — candidate for viewer-inject.js
// ============================================================

// Cross-reference patterns in Belgian Constitutional Court judgments.
// These are the FULL phrases that precede an inline "B.X" cross-reference.
// We match the 80-char window before the "B." and test its tail.
// Key insight: section headings always start a new sentence (preceded by ". " or
// by a line break rendered as whitespace). Cross-references always appear mid-sentence
// following connecting phrases.
//
// Pattern: match full connector phrases, not bare articles.
const XREF_PRECURSOR = /(?:(?:comme|ainsi qu'?)?\s*il est (?:dit|exposé|mentionné|indiqué|constaté|précisé|rappelé|relevé|énoncé|souligné|observé|expliqué)\s+(?:au point|en)\s*$|(?:mentionnée?s?|visée?s?|citée?s?|énoncée?s?|indiquée?s?|exposée?s?|constatée?s?|décrite?s?|prévue?s?|définie?s?|précisée?s?|rappelée?s?|relevée?s?|soulignée?s?|traitée?s?|examinée?s?|analysée?s?)\s+(?:au point|aux points|en|au|sous)\s*$|(?:au(?:x)?\s+points?|les?\s+points?|du\s+point|des?\s+points?|voir\s+(?:le\s+point|les\s+points)?|voy\.\s+(?:le\s+point|les\s+points|également)?|cf\.\s*|du\s+point|aux?\s+points?)\s*$|(?:punt(?:en)?|zie\s+(?:punt|de\s+punt(?:en)?)?|het\s+punt|van\s+punt)\s*$|(?:dit en|est dit en|cité en|visé en|décrit en|prévu en|défini en|mentionné en|indiqué en|exposé en|constaté en|précisé en|rappelé en|relevé en|souligné en|énoncé en|observé en|expliqué en|examiné en)\s*$|(?:dit (?:au point|aux points|sous|au))\s*$|(?:et (?:en|au point|aux points))\s*$)/i;

function normalize(text) {
    return text
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, '-')
        .trim();
}

// Extra normalization for matching selection against PDF text:
// PDF.js often renders curly quotes with spaces around them: "d ' État" instead of "d'État"
// Normalize both sides to handle this
function normalizeForMatch(text) {
    return text
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, '-')
        // Normalize curly/smart quotes to ASCII with no surrounding spaces
        .replace(/\s*[\u2018\u2019\u0027]\s*/g, "'")
        // Also normalize regular quotes
        .replace(/\s*[\u201C\u201D\u0022]\s*/g, '"')
        .trim();
}

function detectBPoint(normalizedFullText, normalizedSelection, matchNormalizedFullText, matchNormalizedSelection) {
    // Fast path: selection starts with "B.X"
    const fastMatch = normalizedSelection.match(/^B\.\s*(\d+(?:[\s.]*\d+)*)/);
    if (fastMatch) return { result: fastMatch[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '') };

    // Try to find selection in text:
    // 1. First try exact match in the fully normalized text
    // 2. Then try quote-normalized match
    // 3. Then try word-truncated fallbacks
    let pos = normalizedFullText.lastIndexOf(normalizedSelection);
    let textForBefore = normalizedFullText;
    
    if (pos === -1) {
        // Try with quote-normalized versions
        pos = matchNormalizedFullText.lastIndexOf(matchNormalizedSelection);
        textForBefore = matchNormalizedFullText;
    }
    if (pos === -1) {
        const w30 = matchNormalizedSelection.split(' ').slice(0, 30).join(' ');
        pos = matchNormalizedFullText.lastIndexOf(w30);
    }
    if (pos === -1) {
        const w10 = matchNormalizedSelection.split(' ').slice(0, 10).join(' ');
        pos = matchNormalizedFullText.lastIndexOf(w10);
    }
    if (pos === -1) return { result: '', debug: 'Selection not found' };

    const before = textForBefore.substring(0, pos);
    const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
    const kept = [];
    const skipped = [];
    let m;
    while ((m = pointPattern.exec(before)) !== null) {
        const clean = m[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
        const preceding = before.substring(Math.max(0, m.index - 80), m.index);
        if (XREF_PRECURSOR.test(preceding)) {
            skipped.push({ number: clean, pos: m.index, preceding: preceding.slice(-40) });
        } else {
            kept.push({ number: clean, pos: m.index, preceding: preceding.slice(-40) });
        }
    }
    const result = kept.length > 0 ? kept[kept.length - 1].number : '';
    return { result, kept, skipped, selPos: pos };
}

// ============================================================
// Test infrastructure
// ============================================================
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
    return fullText;
}

// ============================================================
// Load PDFs and run tests
// ============================================================
const pdfDir = __dirname;
const pdfs = {};
const files = ['2026-025f.pdf', '2026-026f.pdf', '2026-027f.pdf', '2026-028f.pdf',
               '2026-029f.pdf', '2026-030f.pdf', '2026-031f.pdf', '2026-032f.pdf',
               '2026-033f.pdf', '2026-034f.pdf', '2026-035f.pdf'];

for (const f of files) {
    const p = join(pdfDir, f);
    try { readFileSync(p); } catch { continue; }
    const raw = await extractNormalized(p);
    pdfs[f] = {
        normalized: normalize(raw),
        matchNormalized: normalizeForMatch(raw)
    };
    console.log(`Loaded ${f} (${pdfs[f].normalized.length} chars)`);
}

// First: show all B-point occurrences in each PDF: kept vs filtered
console.log('\n\n========== B-POINT ANALYSIS ==========\n');

for (const [file, data] of Object.entries(pdfs)) {
    const text = data.normalized;
    const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
    let m;
    const headings = [];
    while ((m = pointPattern.exec(text)) !== null) {
        const clean = m[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
        const prec = text.substring(Math.max(0, m.index - 80), m.index);
        headings.push({ number: clean, pos: m.index, xref: XREF_PRECURSOR.test(prec), prec: prec.slice(-50) });
    }
    const real = headings.filter(h => !h.xref);
    const filtered = headings.filter(h => h.xref);
    console.log(`${file}: ${headings.length} total, ${real.length} headings, ${filtered.length} xrefs`);
    console.log(`  Headings: ${real.map(h => 'B.' + h.number).join(', ')}`);
    if (filtered.length) {
        console.log(`  Xrefs: ${filtered.map(h => 'B.' + h.number + '=' + JSON.stringify(h.prec.slice(-30))).join(', ')}`);
    }
}

// ============================================================
// Test cases
// ============================================================
const TESTS = [
    // 032 tests
    { file: '2026-032f.pdf', passage: "Il ressort de la jurisprudence du Conseil d'État qu'un contrat de gestion", expected: '6', label: '032 B.6' },
    { file: '2026-032f.pdf', passage: "Pour le reste, contrairement à ce que soutient le Conseil des ministres", expected: '9', label: '032 B.9' },
    { file: '2026-032f.pdf', passage: "La Cour est interrogée sur la compatibilité", expected: '3', label: '032 B.3' },
    { file: '2026-032f.pdf', passage: "Il s'ensuit que la disposition en cause", expected: '10', label: '032 B.10' },
    { file: '2026-032f.pdf', passage: "Il appartient en règle à la juridiction", expected: '4.1', label: '032 B.4.1' },
    { file: '2026-032f.pdf', passage: "Un contrat de gestion, conclu entre l", expected: '8', label: '032 B.8' },
    // 025 tests
    { file: '2026-025f.pdf', passage: "La Cour doit vérifier", expected: '', label: '025 passage (to find)' },
    // 030 tests  
    { file: '2026-030f.pdf', passage: "La Cour doit vérifier", expected: '', label: '030 passage (to find)' },
    // 031 tests
    { file: '2026-031f.pdf', passage: "La Cour doit vérifier", expected: '', label: '031 passage (to find)' },
    // 033 tests
    { file: '2026-033f.pdf', passage: "La Cour doit vérifier", expected: '', label: '033 passage (to find)' },
    // 035 tests
    { file: '2026-035f.pdf', passage: "La Cour doit vérifier", expected: '', label: '035 passage (to find)' },
];

console.log('\n\n========== RUNNING TESTS ==========\n');

let passed = 0, failed = 0, skippedCount = 0;
for (const t of TESTS) {
    const data = pdfs[t.file];
    if (!data) { console.log(`SKIP ${t.label}: PDF not loaded`); skippedCount++; continue; }
    
    const normSel = normalize(t.passage);
    const matchNormSel = normalizeForMatch(t.passage);
    
    const r = detectBPoint(data.normalized, normSel, data.matchNormalized, matchNormSel);
    
    if (t.expected === '') {
        // Just show result for discovery
        console.log(`INFO ${t.label}: got B.${r.result || '(none)'}, selPos=${r.selPos}`);
        if (r.selPos === undefined) console.log(`  (selection not found)`);
        skippedCount++;
        continue;
    }
    
    const ok = r.result === t.expected;
    if (ok) {
        console.log(`PASS ${t.label}`);
        passed++;
    } else {
        console.log(`FAIL ${t.label}: expected B.${t.expected}, got B.${r.result || '(none)'}`);
        console.log(`  selPos: ${r.selPos}`);
        if (r.kept) console.log(`  kept: ${r.kept.map(k => 'B.' + k.number).join(', ')}`);
        if (r.skipped) console.log(`  skipped: ${r.skipped.map(s => 'B.' + s.number + '=' + JSON.stringify(s.preceding.slice(-30))).join(', ')}`);
        failed++;
    }
}

console.log(`\nRESULTS: ${passed} passed, ${failed} failed, ${skippedCount} skipped/info`);
