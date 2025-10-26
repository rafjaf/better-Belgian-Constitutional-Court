(function() {
    'use strict';

    const CLIPBOARD_IMG = "data:image/gif;base64,R0lGODlhEAAQAHcAACH5BAEAAAAALAAAAAAQABAApwEAAMaML//iYvGJHqBeJf+RMP6uVf+tR/+MK/+BE5iYmP+2UP+7Vqqwuv++WP+yTP+SMP+/Wf+kP//AWf+7Vd/g4f+vSf6tVP+0Tv/VY6d5Kv+4Uv+OLP+NLv+zTf+8Vv+4U/6tU/6sUP/EXv6tUuDf3/+3Uf+PL/+QMJ9cJPPy7ry8vLG70f+AEv/KZf+SIP+wSv+RF/+pQ/+YNJFgJf+8V/P3//+qQ//nb6yDLaqwuP/GZf/ahv/Kbf/FYf+eO/+rRf+2Uv+eOf/AVP+gPP+jP6BeJv+/WP+mQ5hrKP/fjv+5U59eJ/+wS/+lTP+dOv+bN//BW/+pQv/BWf+cOf+6VP+rRuTk5P+hPf+eOv/BXP/Pdv+zTP+HG9W6gP+/Wp1bJP6oTf/CW/+WNJ5cJf+LH/+uSP/Ve//AWv+6U//FX4eHh/+QGP/MU/+fPP///+Xl5Z9cJf+uSf+XNcCLMv/ci+Ph3Lu7wcejZp5dJfXz8P+pPf+OLv6kS/+5VP6gSP+RHN7e3P6sUv/mcf+PLo2NjQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAjoAAEIHAhAgQKCCAleKaQATkKEFd6sWaGiQkIRBgx40ROoRAk7NpIMGClQhJI2eO7oaMCSBY09SAYIJFHHRYYcdALoDJBhiAw2M3n4UINjkICjAkaMuBFDYIgzWqKIQTNlwoQjaUxIAeR0y5cIERw4CPthwQMJLwRe6MGAgh8GHxiAWMDFApUyAg3sALFhA4UqS0xggAFkTBe1NR488LAAgwcLVoo8QZFAoKAgBzLLaWJGAhYoc05UBhCmTxY3RH4ImQEBwokOHVoIdPKnQAEIBQjx4YCgN4fRADQQGG4kT5wUYMgw0SAwIAA7";

    const SAVE_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAURJREFUeNqsks1qg0AQx2erIAGhfQPBQIIXb+Kp1wbaS0++VvMWXu0hfYAcFPElUvABWu0qfndmm12ag9BI/7Af7Mz+ZnZ2GADco44wo2ma1EojjuNnXF+lXXcc54gDbNsWB1EUQZIkczxwXTdijCmITlNRFJBlmXAYxxGapgFGUc+XfN8Xa5qmsNlsoO97BdFlesMwKEBVV8AmRDBCMLAsS9jquhZ+2+0WNE2LyKjLS0hVb604xw0BfjKQNv7Foet6YHguAypA13XCn/ac18LpXD7Y71+Aaskxs77vLmoiAPRmGYW02z3MFnFtr1VmClCWJeR5DqvVShyapjkLOL2fRPrSVwDatoUwDOGvCoLgMgN6v+d5sEQ3ErBU/wP4/QNXA7CjVFMsEf3owTCMx2svYu+8Ydc+EeAWx92C4B8I+PwWYACXBK4D+SrWXwAAAABJRU5ErkJggg==";

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        body {
            margin: 0;
            overflow: hidden;
        }
        div#cc-ref-header {
            background-color: white;
            padding: 10px;
            text-align: center;
            border-bottom: 2px solid #ccc;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10000;
        }
        div#cc-ref-header img {
            cursor: pointer;
            padding-right: 10px;
            vertical-align: middle;
        }
        embed {
            display: none !important;
        }
        iframe#cc-pdf-viewer {
            position: fixed;
            top: 45px;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: calc(100% - 45px);
            border: none;
        }
    `;
    document.head.appendChild(style);

    // Extract date from PDF text
    function extractDateFromText(text, isDutch) {
        try {
            // Unified logic: use translated markers and regex
            const startMarker = isDutch ? /Arrest\s+nr\s*/i : /Arrêt\s+n\s*°/i;
            const endMarker = isDutch ? /Rolnummer/i : /Numéro\s+du\s+rôle/i;
            const startMatch = text.match(startMarker);
            const endMatch = text.match(endMarker);
            let relevantText = '';
            
            if (startMatch && endMatch) {
                const startIndex = text.indexOf(startMatch[0]);
                const endIndex = text.indexOf(endMatch[0]);
                if (startIndex < endIndex) {
                    relevantText = text.substring(startIndex, endIndex);
                } else {
                    relevantText = text.substring(endIndex, startIndex + startMatch[0].length + 100);
                }
                console.log('Relevant text for date extraction:', relevantText);
            } else if (startMatch) {
                const startIndex = text.indexOf(startMatch[0]);
                relevantText = text.substring(startIndex, startIndex + startMatch[0].length + 100);
                console.log('Relevant text for date extraction (start only):', relevantText);
            } else {
                relevantText = text;
                console.log('Relevant text for date extraction (fallback):', relevantText);
            }
            
            // Use translated date regex
            const datePattern = isDutch
                ? /van\s+(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+((?:\d\s*){4,5})/i
                : /du\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+((?:\d\s*){4,5})/i;
            const match = relevantText.match(datePattern);
            
            if (match) {
                const yearStr = match[3].replace(/\s+/g, '');
                return {
                    day: match[1],
                    month: match[2].toLowerCase(),
                    year: yearStr
                };
            }
            return null;
        } catch (error) {
            console.error('Error extracting date:', error);
            return null;
        }
    }

    async function init() {
        // Get info from URL
        const loc = window.location.href;
        const isDutch = loc.includes('nl.const-court.be/public/n/');
        const year = loc.split("/")[5];
        // Dutch: /public/n/YYYY/YYYY-NNNn.pdf, French: /public/f/YYYY/YYYY-NNNf.pdf
        let numMatch = loc.split("/")[6].match(/(\d+-)(\d+)/);
        const num = numMatch ? numMatch[2] : '';
        
        // Determine if this is an old judgment (before the court was renamed)
        // Court was "Cour d'Arbitrage" / "Arbitragehof" until 2007-05-07
        // Last C.A. judgment was n° 72/2007
        const yearInt = parseInt(year);
        const numInt = parseInt(num);
        const isOldCourt = yearInt < 2007 || (yearInt === 2007 && numInt <= 72);

        // Create header div
        const header = document.createElement("div");
        header.id = "cc-ref-header";
        header.innerHTML = `<img id='btnClipboard' src='${CLIPBOARD_IMG}'><img id='btnFilename' src='${SAVE_IMG}'>
                        <span id='refText'>Chargement du PDF...</span>`;
        document.body.insertBefore(header, document.body.firstChild);

        try {
            // Create iframe with PDF.js viewer
            const viewerUrl = chrome.runtime.getURL('web/viewer.html');
            const iframe = document.createElement('iframe');
            iframe.id = 'cc-pdf-viewer';
            iframe.src = `${viewerUrl}?file=${encodeURIComponent(loc)}`;
            document.body.appendChild(iframe);

            // Set default reference (will be updated when we get PDF text)
            let reference;
            if (isDutch) {
                const courtName = isOldCourt ? 'Arbitragehof' : 'GwH';
                reference = `${courtName} ${year}, nr. <a href='${loc}'>${parseInt(num)}/${year}</a>`;
            } else {
                const courtName = isOldCourt ? 'C.A.' : 'C.C.';
                reference = `${courtName}, ${year}, n° <a href='${loc}'>${parseInt(num)}/${year}</a>`;
            }
            document.getElementById('refText').innerHTML = reference;
            window.ccReference = reference;
            window.ccReferenceShort = isDutch 
                ? `${isOldCourt ? 'Arbitragehof' : 'GwH'}, nr. ${parseInt(num)}/${year}` 
                : `${isOldCourt ? 'C.A.' : 'C.C.'}, n° ${parseInt(num)}/${year}`;

        } catch (error) {
            document.getElementById('refText').innerHTML = isDutch ? `Fout: ${error.message}` : `Erreur: ${error.message}`;
        }

        // Button event listeners
        document.getElementById('btnClipboard').addEventListener('click', function(e) {
            const pointText = isDutch ? ", punt B." : ", point B.";
            const text = document.getElementById('refText').innerHTML + pointText;
            // Copy to clipboard
            navigator.clipboard.writeText(text.replace(/<[^>]*>/g, '')).then(() => {
                // Also copy as HTML
                const type = 'text/html';
                const blob = new Blob([text], { type });
                const data = [new ClipboardItem({ [type]: blob })];
                navigator.clipboard.write(data);
            });
            e.preventDefault();
        }, false);
        
        document.getElementById('btnFilename').addEventListener('click', function(e) {
            const a = document.createElement("a");
            a.href = loc;
            const courtAbbrev = isDutch 
                ? (isOldCourt ? 'Arbitragehof' : 'GwH')
                : (isOldCourt ? 'C.A.' : 'C.C.');
            const prefix = `${courtAbbrev} ${year}-${num}.pdf`;
            a.download = prefix;
            a.click();
            e.preventDefault();
        }, false);

        // Listen for messages from iframe (for copy hijacking and PDF text)
        window.addEventListener('message', function(event) {
            console.log('Content script received message:', event.data.type, 'from origin:', event.origin);
            
            // Verify the message is from our iframe (chrome-extension origin)
            if (!event.origin.startsWith('chrome-extension://')) {
                console.log('Message rejected - not from chrome-extension');
                return;
            }
            
            if (event.data.type === 'PDF_TEXT') {
                // Extract date from received text
                console.log('Received PDF text (first 100 chars):', event.data.text.substring(0, 100));
                const dateInfo = extractDateFromText(event.data.text, isDutch);
                
                // Update reference with extracted date
                let reference;
                const courtName = isDutch 
                    ? (isOldCourt ? 'Arbitragehof' : 'GwH')
                    : (isOldCourt ? 'C.A.' : 'C.C.');
                const courtShort = isDutch
                    ? (isOldCourt ? 'Arbitragehof' : 'GwH')
                    : (isOldCourt ? 'C.A.' : 'C.C.');
                    
                if (isDutch) {
                    if (dateInfo && dateInfo.day && dateInfo.month) {
                        reference = `${courtName} ${parseInt(dateInfo.day)} ${dateInfo.month} ${dateInfo.year}, nr. <a href='${loc}'>${parseInt(num)}/${dateInfo.year}</a>`;
                        console.log('Dutch date extracted:', dateInfo);
                    } else {
                        reference = `${courtName} ${year}, nr. <a href='${loc}'>${parseInt(num)}/${year}</a>`;
                        console.log('Dutch date extraction failed, using fallback');
                    }
                    document.getElementById('refText').innerHTML = reference;
                    window.ccReference = reference;
                    window.ccReferenceShort = `${courtShort}, nr. ${parseInt(num)}/${dateInfo ? dateInfo.year : year}`;
                } else {
                    if (dateInfo && dateInfo.day && dateInfo.month) {
                        reference = `${courtName}, ${parseInt(dateInfo.day)}${dateInfo.day == "01" ? "er" : ""} ${dateInfo.month} ${dateInfo.year}, n° <a href='${loc}'>${parseInt(num)}/${dateInfo.year}</a>`;
                        console.log('Date extracted successfully:', dateInfo);
                    } else {
                        reference = `${courtName}, ${year}, n° <a href='${loc}'>${parseInt(num)}/${year}</a>`;
                        console.log('Date extraction failed, using fallback');
                    }
                    document.getElementById('refText').innerHTML = reference;
                    window.ccReference = reference;
                    window.ccReferenceShort = `${courtShort}, n° ${parseInt(num)}/${dateInfo ? dateInfo.year : year}`;
                }
            }
            else if (event.data.type === 'COPY_TEXT') {
                console.log('Received COPY_TEXT message');
                const selectedText = event.data.text;
                if (selectedText) {
                    // Format: French: "selected text" (reference, point B.XX)
                    // Dutch: "selected text" (reference, punt B.X)
                    const refText = document.getElementById('refText').innerText;
                    let formattedText;
                    
                    if (event.data.point) {
                        if (isDutch) {
                            formattedText = `"${selectedText}" (${refText}, punt B.${event.data.point})`;
                        } else {
                            formattedText = `"${selectedText}" (${refText}, point B.${event.data.point})`;
                        }
                    } else {
                        formattedText = `"${selectedText}" (${refText})`;
                    }
                    
                    console.log('Formatted citation:', formattedText.substring(0, 100));
                    
                    // Copy as plain text
                    navigator.clipboard.writeText(formattedText).then(() => {
                        // Also copy as HTML
                        let htmlText;
                        if (event.data.point) {
                            if (isDutch) {
                                htmlText = `"${selectedText}" (${document.getElementById('refText').innerHTML}, punt B.${event.data.point})`;
                            } else {
                                htmlText = `"${selectedText}" (${document.getElementById('refText').innerHTML}, point B.${event.data.point})`;
                            }
                        } else {
                            htmlText = `"${selectedText}" (${document.getElementById('refText').innerHTML})`;
                        }
                        const type = 'text/html';
                        const blob = new Blob([htmlText], { type });
                        const data = [new ClipboardItem({ [type]: blob })];
                        navigator.clipboard.write(data);
                        console.log('Citation copied to clipboard');
                    });
                }
            }
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
