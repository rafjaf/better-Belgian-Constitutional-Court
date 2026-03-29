import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfjsLib = await import('/tmp/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

function normalize(t) { return t.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').replace(/\s*-\s*/g,'-').trim(); }
function normalizeForMatch(t) { return t.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').replace(/\s*-\s*/g,'-').replace(/\s*[\u2018\u2019\u0027]\s*/g,"'").replace(/\s*[\u201C\u201D\u0022]\s*/g,'"').trim(); }

async function extractNormalized(p) {
    const data = new Uint8Array(readFileSync(p));
    const pdf = await pdfjsLib.getDocument({data}).promise;
    let ft='';
    for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();ft+=tc.items.map(x=>x.str).join(' ')+' ';}
    pdf.destroy();
    return ft;
}

// For each PDF, find the text around the highest B-point headings to get good test passages
const XREF = /(?:(?:comme|ainsi qu'?)?\s*il est (?:dit|exposé|mentionné|indiqué|constaté|précisé|rappelé|relevé|énoncé|souligné|observé|expliqué)\s+(?:au point|en)\s*$|(?:mentionnée?s?|visée?s?|citée?s?|énoncée?s?|indiquée?s?|exposée?s?|constatée?s?|décrite?s?|prévue?s?|définie?s?|précisée?s?|rappelée?s?|relevée?s?|soulignée?s?|traitée?s?|examinée?s?|analysée?s?)\s+(?:au point|aux points|en|au|sous)\s*$|(?:au(?:x)?\s+points?|les?\s+points?|du\s+point|des?\s+points?|voir\s+(?:le\s+point|les\s+points)?|voy\.\s+(?:le\s+point|les\s+points|également)?|cf\.\s*|du\s+point|aux?\s+points?)\s*$|(?:punt(?:en)?|zie\s+(?:punt|de\s+punt(?:en)?)?|het\s+punt|van\s+punt)\s*$|(?:dit en|est dit en|cité en|visé en|décrit en|prévu en|défini en|mentionné en|indiqué en|exposé en|constaté en|précisé en|rappelé en|relevé en|souligné en|énoncé en|observé en|expliqué en|examiné en)\s*$|(?:dit (?:au point|aux points|sous|au))\s*$|(?:et (?:en|au point|aux points))\s*$)/i;

const files = {
    '2026-025f.pdf': 'B.17 or B.18',
    '2026-030f.pdf': 'B.47 or B.70',
    '2026-031f.pdf': 'B.20 or B.25',
    '2026-033f.pdf': 'B.4 or B.5',
    '2026-035f.pdf': 'B.6 or B.7',
};

for (const [file, target] of Object.entries(files)) {
    const p = join(__dirname, file);
    try { readFileSync(p); } catch { continue; }
    const raw = await extractNormalized(p);
    const text = normalizeForMatch(raw);
    
    console.log(`\n============ ${file} (${target}) ============`);
    
    // Find the highest-numbered real B headings
    const pp = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
    let m;
    const headings = [];
    while ((m = pp.exec(text)) !== null) {
        const clean = m[1].replace(/\s+/g,'').replace(/\.+/g,'.').replace(/\.$/,'');
        const prec = text.substring(Math.max(0,m.index-80),m.index);
        if (!XREF.test(prec)) {
            headings.push({number:clean, pos:m.index});
        }
    }
    
    // Pick a few interesting headings (high numbers, diverse)
    const targets = [];
    const seen = new Set();
    // Pick the ones with highest main number
    const sorted = [...headings].sort((a,b) => {
        const na = parseInt(a.number);
        const nb = parseInt(b.number);
        return nb - na;
    });
    for (const h of sorted) {
        const main = parseInt(h.number);
        if (!seen.has(main) && targets.length < 3) {
            seen.add(main);
            targets.push(h);
        }
    }
    // Also pick a mid-range one
    const midTarget = headings[Math.floor(headings.length / 2)];
    if (midTarget && !seen.has(parseInt(midTarget.number))) {
        targets.push(midTarget);
    }
    
    for (const t of targets) {
        // Show 15 words after the heading
        const afterStart = t.pos + 2 + t.number.length + 2; // "B." + number + ". "
        const afterText = text.substring(afterStart, afterStart + 200);
        const words = afterText.split(' ').slice(0, 15).join(' ');
        console.log(`  B.${t.number} at pos ${t.pos}:`);
        console.log(`    "${words}"`);
    }
}
