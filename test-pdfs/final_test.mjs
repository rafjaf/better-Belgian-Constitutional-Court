import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfjsLib = await import('/tmp/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

function normalize(t){return t.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').replace(/\s*-\s*/g,'-').trim();}
function normalizeForMatch(t){return t.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').replace(/\s*-\s*/g,'-').replace(/\s*[\u2018\u2019\u0027]\s*/g,"'").replace(/\s*[\u201C\u201D\u0022]\s*/g,'"').trim();}

const XREF_PRECURSOR = /(?:(?:comme|ainsi qu['\u2019]?)?\s*il est (?:dit|expos\u00e9|mentionn\u00e9|indiqu\u00e9|constat\u00e9|pr\u00e9cis\u00e9|rappel\u00e9|relev\u00e9|\u00e9nonc\u00e9|soulign\u00e9|observ\u00e9|expliqu\u00e9)\s+(?:au point|en)\s*$|(?:mentionn\u00e9e?s?|vis\u00e9e?s?|cit\u00e9e?s?|\u00e9nonc\u00e9e?s?|indiqu\u00e9e?s?|expos\u00e9e?s?|constat\u00e9e?s?|d\u00e9crite?s?|pr\u00e9vue?s?|d\u00e9finie?s?|pr\u00e9cis\u00e9e?s?|rappel\u00e9e?s?|relev\u00e9e?s?|soulign\u00e9e?s?|trait\u00e9e?s?|examin\u00e9e?s?|analys\u00e9e?s?)\s+(?:au point|aux points|en|au|sous)\s*$|(?:au(?:x)?\s+points?|les?\s+points?|du\s+point|des?\s+points?|voir\s+(?:le\s+point|les\s+points)?|voy\.\s+(?:le\s+point|les\s+points|\u00e9galement)?|cf\.\s*|du\s+point|aux?\s+points?)\s*$|(?:punt(?:en)?|zie\s+(?:punt|de\s+punt(?:en)?)?|het\s+punt|van\s+punt)\s*$|(?:dit en|est dit en|cit\u00e9 en|vis\u00e9 en|d\u00e9crit en|pr\u00e9vu en|d\u00e9fini en|mentionn\u00e9 en|indiqu\u00e9 en|expos\u00e9 en|constat\u00e9 en|pr\u00e9cis\u00e9 en|rappel\u00e9 en|relev\u00e9 en|soulign\u00e9 en|\u00e9nonc\u00e9 en|observ\u00e9 en|expliqu\u00e9 en|examin\u00e9 en)\s*$|(?:dit (?:au point|aux points|sous|au))\s*$|(?:et (?:en|au point|aux points))\s*$)/i;

function detectBPoint(normFull, normSel, matchFull, matchSel) {
    const fast = normSel.match(/^B\.\s*(\d+(?:[\s.]*\d+)*)/);
    if (fast) return fast[1].replace(/\s+/g,'').replace(/\.+/g,'.').replace(/\.$/,'');

    let pos = normFull.lastIndexOf(normSel);
    let text = normFull;
    if (pos === -1) { pos = matchFull.lastIndexOf(matchSel); text = matchFull; }
    if (pos === -1) { const w = matchSel.split(' ').slice(0,30).join(' '); pos = matchFull.lastIndexOf(w); text = matchFull; }
    if (pos === -1) { const w = matchSel.split(' ').slice(0,10).join(' '); pos = matchFull.lastIndexOf(w); text = matchFull; }
    if (pos === -1) return '';

    const before = text.substring(0, pos);
    const pp = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
    const kept = [];
    let m;
    while ((m = pp.exec(before)) !== null) {
        const clean = m[1].replace(/\s+/g,'').replace(/\.+/g,'.').replace(/\.$/,'');
        const prec = before.substring(Math.max(0, m.index - 80), m.index);
        if (!XREF_PRECURSOR.test(prec)) kept.push(clean);
    }
    return kept.length > 0 ? kept[kept.length - 1] : '';
}

async function loadPdf(file) {
    const p = join(__dirname, file);
    const data = new Uint8Array(readFileSync(p));
    const pdf = await pdfjsLib.getDocument({data}).promise;
    let ft = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const tc = await pg.getTextContent();
        ft += tc.items.map(x => x.str).join(' ') + ' ';
    }
    pdf.destroy();
    return { normalized: normalize(ft), matchNormalized: normalizeForMatch(ft) };
}

const TESTS = [
    // 032 tests (the main problem PDF)
    { file: '2026-032f.pdf', passage: "Il ressort de la jurisprudence du Conseil d'État qu'un contrat de gestion", expected: '6' },
    { file: '2026-032f.pdf', passage: "Pour le reste, contrairement à ce que soutient le Conseil des ministres", expected: '9' },
    { file: '2026-032f.pdf', passage: "La Cour est interrogée sur la compatibilité", expected: '3' },
    { file: '2026-032f.pdf', passage: "Il s'ensuit que la disposition en cause", expected: '10' },
    { file: '2026-032f.pdf', passage: "Il appartient en règle à la juridiction", expected: '4.1' },
    { file: '2026-032f.pdf', passage: "Un contrat de gestion, conclu entre l", expected: '8' },
    // 025 tests
    { file: '2026-025f.pdf', passage: "L'examen de la compatibilité d'une disposition législative avec le principe", expected: '23.1' },
    { file: '2026-025f.pdf', passage: "Les articles 1399 à 1401, 1404 et 1405 de l'ancien Code civil sont compatibles", expected: '21' },
    { file: '2026-025f.pdf', passage: "Il s'ensuit que, dans la situation évoquée dans la question préjudicielle, le patrimoine propre", expected: '10.4' },
    // 030 tests (very large document with many B-points)
    { file: '2026-030f.pdf', passage: "En l'espèce, le choix de principe de l'âge de douze ans comme l'âge", expected: '154' },
    { file: '2026-030f.pdf', passage: "Le grief est irrecevable", expected: '33' },
    // 031 tests
    { file: '2026-031f.pdf', passage: "Le quatrième moyen est irrecevable", expected: '31' },
    { file: '2026-031f.pdf', passage: "Le Conseil des ministres soutient que le quatrième moyen des parties requérantes est irrecevable", expected: '30.1' },
    { file: '2026-031f.pdf', passage: "Ainsi que l'indique le législateur dans les travaux préparatoires", expected: '13.4' },
    // 033 tests
    { file: '2026-033f.pdf', passage: "Il ressort des travaux préparatoires de l'amendement à l'origine des articles 150", expected: '4' },
    { file: '2026-033f.pdf', passage: "Afin de garantir le paiement du droit de condamnation", expected: '3' },
    // 035 tests
    { file: '2026-035f.pdf', passage: "La Cour doit néanmoins veiller à ce que la mesure en cause ne porte pas", expected: '7.1' },
    { file: '2026-035f.pdf', passage: "C'est ainsi qu'il convient de constater que le débiteur qui ne dispose pas", expected: '6' },
    { file: '2026-035f.pdf', passage: "Il résulte de ce qui précède que le législateur a estimé que le débiteur", expected: '5' },
    // 034 tests
    { file: '2026-034f.pdf', passage: "La Cour examine la question préjudicielle", expected: '' }, // discovery
];

// Load all needed PDFs
const pdfCache = {};
const neededFiles = [...new Set(TESTS.map(t => t.file))];
for (const f of neededFiles) {
    try { pdfCache[f] = await loadPdf(f); }
    catch(e) { console.log('ERROR loading', f, e.message); }
}

// Run tests
let passed = 0, failed = 0, info = 0;
console.log('========== COMPREHENSIVE TEST RESULTS ==========\n');
for (const t of TESTS) {
    const d = pdfCache[t.file];
    if (!d) { console.log(`SKIP ${t.file}`); continue; }
    const ns = normalize(t.passage);
    const ms = normalizeForMatch(t.passage);
    const result = detectBPoint(d.normalized, ns, d.matchNormalized, ms);
    if (t.expected === '') {
        console.log(`INFO ${t.file}: "${t.passage.substring(0,50)}..." => B.${result || '(none)'}`);
        info++;
    } else if (result === t.expected) {
        console.log(`PASS ${t.file} B.${t.expected}: "${t.passage.substring(0,50)}..."`);
        passed++;
    } else {
        console.log(`FAIL ${t.file}: expected B.${t.expected}, got B.${result || '(none)'}: "${t.passage.substring(0,50)}..."`);
        failed++;
    }
}

console.log(`\n========== SUMMARY: ${passed} PASSED, ${failed} FAILED, ${info} INFO ==========`);
if (failed > 0) process.exit(1);
