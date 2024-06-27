// Inside:    document.addEventListener('selectionchange

// Also see: function highlightSelection(color) {        (where "cancelola" was)


// There was a problem with this (not )

function highlightSelection(color) {
    const selection = window.getSelection();
    let range, textNodes;

    if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
        adjustRangeOffsets(range);
        textNodes = collectTextNodes(range);
    }

    // If no valid text nodes found in the initial selection, use .temp-underline
    if (!textNodes || textNodes.length === 0) {
        const tempUnderline = document.querySelector('.temp-underline');
        if (tempUnderline) {
            range = document.createRange();
            range.selectNodeContents(tempUnderline);
            textNodes = getTextNodesFromElement(tempUnderline);
        } else {
            console.log("No temp-underline element found, returning");
            return;
        }
    }

    // Failsafe in case the selection ends up being too large.
    if (textNodes.length > 40) {
        alert("Something went wrong. Either your selection was too large or there was another error. Please try another way.");
        return; // Stop the highlighting process
    }

    let highestHnid = getHighestHnid(); // Get the highest hnid
    let hnid = (highestHnid + 1).toString(); // Increment the highest hnid

    // Store the hnid in the note input's dataset
    const noteInput = document.querySelector('.note-input');
    noteInput.dataset.hnid = hnid;

    // Perform check for deletion if color is hl-delete
    if (color === 'delete highlight') {
        if (!checkForNotesBeforeDelete(range, textNodes)) {
            return false; // User canceled the deletion
        }
    }

    console.log("Data is now (textNodes, range, color, hnid):", textNodes, range, color, hnid);
    // Process all text nodes within the range, regardless of their parent elements
    highlightTextNodes(textNodes, range, color, hnid);

    // Clear the selection and hide the modal
    selection.removeAllRanges();
    const hmodal = document.getElementById('highlightModal');
    if (hmodal) {
        hmodal.style.display = 'none';
    }

    handleHighlightMerges(hnid, color);
}

function getTextNodesFromElement(element) {
    let textNodes = [];
    function getTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
        } else {
            for (let child = node.firstChild; child; child = child.nextSibling) {
                getTextNodes(child);
            }
        }
    }
    getTextNodes(element);
    return textNodes;
}



// REMEMBER, this is the corrected version

// Add or update an element in highlights
function saveHighlightsToLocalStorage(rootElement) {
    if (!rootElement) return; // Ensure rootElement is valid

    let highlights = JSON.parse(localStorage.getItem('highlights')) || {};

    if (!highlights[bookId]) {
        highlights[bookId] = {};
    }

    // Strip highlight spans from the element
    function stripHighlightSpans(element) {
        let highlightSpans = element.querySelectorAll('.highlight-span');
        highlightSpans.forEach(span => {
            let parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
        });
    }

    // Process the element and update highlights
    function processElement(element) {
        let cleanedElement = element.cloneNode(true);
        stripHighlightSpans(cleanedElement);
        let cleanedHTML = cleanedElement.outerHTML;
        let originalHTML = element.outerHTML;

        // Find a suitable pid ancestor element for the current element
        let pidElement = element.closest('[id^="p"]');
        if (!pidElement) {
            console.warn("No suitable pid ancestor found for the current element.");
            return;
        }
        let pid = pidElement.id;

        if (!highlights[bookId][pid]) {
            highlights[bookId][pid] = {
                cleanedHTML: cleanedHTML,
                highlightedHTML: originalHTML,
                hnids: []
            };
        } else {
            highlights[bookId][pid].cleanedHTML = cleanedHTML;
            highlights[bookId][pid].highlightedHTML = originalHTML;
        }

        let currentHnids = Array.from(element.querySelectorAll('.highlight-span'))
            .map(span => span.getAttribute('data-hnid'));

        highlights[bookId][pid].hnids = Array.from(new Set(currentHnids));
        // Convert hnids to numbers
        highlights[bookId][pid].hnids = highlights[bookId][pid].hnids.map(hnid => parseInt(hnid));
    }

    if (rootElement.querySelector('.highlight-span')) {
        processElement(rootElement);
    }

    localStorage.setItem('highlights', JSON.stringify(highlights));
}
