
// HIGHLIGHT FUNCTIONALITY
let ignoreNextClick = false;

let selectedText = null;

document.addEventListener('mouseup', function() {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
        selectedText = selection.getRangeAt(0).cloneRange(); // Preserve the selection
        showHighlightModal(selection);
        ignoreNextClick = true; // Set flag to ignore the next click
        setTimeout(() => { ignoreNextClick = false; }, 200); // Reset the flag after 200ms
    }
});

document.addEventListener('mousedown', function(event) {
    const hmodal = document.getElementById('highlightModal');
    if (hmodal && hmodal.contains(event.target)) {
        event.preventDefault(); // Prevents the text from being unselected when clicking inside the modal
    }
});

document.addEventListener('keydown', function(event) {
    const hmodal = document.getElementById('highlightModal');
    if (event.key === "Escape" && hmodal.style.display === 'block') {
        hmodal.style.display = 'none';
    }
});

window.addEventListener('resize', function() {
    const hmodal = document.getElementById('highlightModal');
    if (hmodal) {
        hmodal.style.display = 'none';
    }
});

document.addEventListener('selectionchange', function() {
    let hmodal = document.getElementById('highlightModal');
    if (!hmodal) {
        hmodal = document.createElement('div');
        hmodal.id = 'highlightModal';
        hmodal.innerHTML = '<div class="highlight-modal-content">Content will go here</div>';
        hmodal.style.pointerEvents = 'none';
        hmodal.style.display = 'none'; // Ensure the modal is initially hidden
        document.body.appendChild(hmodal);
    }

    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range && !range.collapsed) {
        const rect = range.getBoundingClientRect();
        const modalWidth = 300; // Assuming max-width is 300px
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const leftPosition = (window.innerWidth - modalWidth - scrollbarWidth) / 2;

        hmodal.style.top = `${rect.bottom + window.scrollY}px`;
        hmodal.style.left = `${leftPosition + window.scrollX}px`;
        hmodal.style.display = 'block';
        hmodal.focus();
    } else {
        hmodal.style.display = 'none';
    }
});

// Ensure the modal is created and listeners are attached only once
let hmodal = document.getElementById('highlightModal');
if (!hmodal) {
    hmodal = document.createElement('div');
    hmodal.id = 'highlightModal';
    hmodal.className = 'highlight-modal';
    hmodal.innerHTML = `
        <div class="highlight-modal-content">
            <div class="color-selection">
                <div class="color-circle" style="background-color: #FFEE58;" title="Yellow"></div>
                <div class="color-circle" style="background-color: #FF8A80;" title="Pink"></div>
                <div class="color-circle" style="background-color: #A5D6A7;" title="Green"></div>
                <div class="color-circle" style="background-color: #90CAF9;" title="Blue"></div>
                <div class="color-circle" style="background-color: #CE93D8;" title="Purple"></div>
                <div class="color-circle notes-placeholder" title="Add Note">+</div>
            </div>
        </div>
    `;
    document.body.appendChild(hmodal);

    document.querySelectorAll('.color-circle').forEach(circle => {
        circle.addEventListener('click', function(event) {
            event.stopPropagation(); // Ensure the click event is not interfered with
            if (!this.classList.contains('notes-placeholder')) {
                highlightSelection(this.style.backgroundColor);
            }
        });
    });

    hmodal.style.pointerEvents = 'auto'; // Ensure the modal is interactive
}

function showHighlightModal(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const modalWidth = 300; // Assuming max-width is 300px
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const leftPosition = (window.innerWidth - modalWidth - scrollbarWidth) / 2;

    hmodal.style.top = `${rect.bottom + window.scrollY}px`;
    hmodal.style.left = `${leftPosition + window.scrollX}px`;
    hmodal.style.display = 'block';
    hmodal.focus();
}

let highlightId = 0; // Global highlight ID

// Add a new highlight and recalculate indexes
function highlightSelection(color) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        let range = selection.getRangeAt(0);
        adjustRangeOffsets(range);

        const textNodes = collectTextNodes(range);
        let selectedText = normalizeText(range.toString());
        let matchIndex = calculateMatchIndex(textNodes, selectedText, range);

        let selectedContent = highlightTextNodes(textNodes, range, color);
        highlightId++;

        saveHighlightData(selectedContent, color, matchIndex);

        recalculateIndexes(JSON.parse(localStorage.getItem('highlights')));

        selection.removeAllRanges();
        const hmodal = document.getElementById('highlightModal');
        if (hmodal) {
            hmodal.style.display = 'none';
        }
    }
}

function adjustRangeOffsets(range) {
    let startContainer = range.startContainer;
    let endContainer = range.endContainer;
    let startOffset = range.startOffset;
    let endOffset = range.endOffset;

    // Adjust the start and end offsets to ensure whole words are highlighted
    if (startContainer.nodeType === Node.TEXT_NODE) {
        while (startOffset > 0 && !/\s/.test(startContainer.textContent[startOffset - 1])) {
            startOffset--;
        }
    }

    if (endContainer.nodeType === Node.TEXT_NODE) {
        while (endOffset < endContainer.textContent.length && !/\s/.test(endContainer.textContent[endOffset])) {
            endOffset++;
        }
    }

    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
}

function calculateMatchIndex(textNodes, selectedText, range) {
    let matchIndex = 0;
    let currentMatchIndex = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;

    console.log('Starting walker iteration...');
    while ((node = walker.nextNode())) {
        const nodeText = normalizeText(node.textContent);
        console.log(`Node text: "${nodeText}"`);

        let startPos = 0;
        while ((startPos = nodeText.indexOf(selectedText, startPos)) !== -1) {
            console.log(`Match found at position ${startPos} in node text: "${nodeText}"`);

            if (node === range.startContainer && startPos === range.startOffset) {
                matchIndex = currentMatchIndex;
                console.log(`Match index set to ${matchIndex}`);
                break;
            }
            startPos += selectedText.length;
            currentMatchIndex++;
        }

        if (node === range.startContainer) break;
    }

    console.log(`Final match index: ${matchIndex}`);
    return matchIndex;
}

function highlightTextNodes(textNodes, range, color) {
    if (textNodes.length === 1) {
        return highlightSingleTextNode(textNodes[0], range, color);
    } else if (textNodes.length > 1) {
        return highlightMultipleTextNodes(textNodes, range, color);
    }
    return [];
}

function highlightSingleTextNode(node, range, color) {
    const text = node.textContent;
    const before = text.slice(0, range.startOffset);
    const highlight = text.slice(range.startOffset, range.endOffset);
    const after = text.slice(range.endOffset);

    const wrapper = createSpanWrapper(color);
    wrapper.textContent = highlight;

    const parent = node.parentNode;
    const referenceNode = node.nextSibling; // Store the next sibling to insert before it

    // Remove the original text node
    parent.removeChild(node);

    // Insert nodes in the correct order
    if (before) {
        parent.insertBefore(document.createTextNode(before), referenceNode);
    }
    parent.insertBefore(wrapper, referenceNode);
    if (after) {
        parent.insertBefore(document.createTextNode(after), referenceNode);
    }

    // Return the highlighted text as an array
    return [highlight];
}

function highlightMultipleTextNodes(textNodes, range, color) {
    const startNode = textNodes[0];
    const endNode = textNodes[textNodes.length - 1];
    let selectedContent = [];

    const startText = startNode.textContent;
    const startBefore = startText.slice(0, range.startOffset);
    const startHighlight = startText.slice(range.startOffset);

    const endText = endNode.textContent;
    const endHighlight = endText.slice(0, range.endOffset);
    const endAfter = endText.slice(range.endOffset);

    const startWrapper = createSpanWrapper(color);
    startWrapper.textContent = startHighlight;

    const endWrapper = createSpanWrapper(color);
    endWrapper.textContent = endHighlight;

    // Replace start node
    const startParent = startNode.parentNode;
    const startAfterNode = document.createTextNode(startBefore);
    startParent.replaceChild(startAfterNode, startNode);
    startParent.insertBefore(startWrapper, startAfterNode.nextSibling);

    // Replace end node
    const endParent = endNode.parentNode;
    const endAfterNode = document.createTextNode(endAfter);
    endParent.replaceChild(endAfterNode, endNode);
    endParent.insertBefore(endWrapper, endAfterNode);

    // Concatenate the highlighted text parts to selectedContent
    selectedContent.push(startHighlight);

    // Wrap intervening nodes and add their text content to selectedContent
    if (textNodes.length > 2) {
        const interveningNodes = textNodes.slice(1, -1);
        interveningNodes.forEach(node => {
            const wrapper = createSpanWrapper(color);
            wrapper.textContent = node.textContent;

            node.parentNode.replaceChild(wrapper, node);
            selectedContent.push(node.textContent);
        });
    }

    // Add the text from the end node to selectedContent
    selectedContent.push(endHighlight);

    return selectedContent;
}

// Modify saveHighlightData to include matchIndex
function saveHighlightData(selectedContent, color, matchIndex) {
    const highlights = JSON.parse(localStorage.getItem('highlights')) || [];
    highlights.push({
        id: `highlight-${highlightId}`,
        text: selectedContent, // This should now be an array of substrings
        color: color,
        index: matchIndex
    });

    localStorage.setItem('highlights', JSON.stringify(highlights));
    console.log('Highlights saved to LocalStorage', highlights);
}

// Function to manually collect text nodes within the range
function collectTextNodes(range) {
    const textNodes = [];
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
        textNodes.push(startContainer);
    } else {
        let currentNode = startContainer;
        let endNodeReached = false;

        while (currentNode && !endNodeReached) {
            if (currentNode.nodeType === Node.TEXT_NODE) {
                textNodes.push(currentNode);
            }
            if (currentNode === endContainer) {
                endNodeReached = true;
            }
            currentNode = nextNode(currentNode);
        }
    }

    return textNodes;
}

// Helper function to get the next node in the DOM
function nextNode(node) {
    if (node.firstChild) return node.firstChild;
    while (node) {
        if (node.nextSibling) return node.nextSibling;
        node = node.parentNode;
    }
    return null;
}

// Recursive function to wrap text nodes within an element
function wrapTextNodes(nodes, color) {
    for (let node of nodes) {
        const wrapper = createSpanWrapper(color);
        node.parentNode.replaceChild(wrapper, node);
        wrapper.appendChild(node);
    }
}

// Helper function to create a span wrapper
function createSpanWrapper(color) {
    const spanWrapper = document.createElement('span');
    spanWrapper.style.backgroundColor = color;
    spanWrapper.className = 'highlight-span';
    return spanWrapper;
}

// REAPPLY HIGHLIGHTS ON PAGE LOAD
function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

// Reapply highlights on page load
function reapplyHighlights() {
    const highlights = JSON.parse(localStorage.getItem('highlights'));
    console.log("Retrieved highlights from Local Storage:", highlights);
    if (!highlights) return;

    recalculateIndexes(highlights);

    highlights.forEach(highlight => {
        applyHighlight(highlight);
    });

    console.log("Highlights reapplied from LocalStorage");
}


function applyHighlight(highlight) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    let matchFound = false;
    let currentMatchIndex = 0;

    const highlightText = normalizeText(highlight.text[0]);

    while ((node = walker.nextNode())) {
        const nodeText = normalizeText(node.textContent);

        // Check if the node contains the highlight text
        if (nodeText.includes(highlightText)) {
            let startPos = 0;

            while ((startPos = nodeText.indexOf(highlightText, startPos)) !== -1) {
                if (currentMatchIndex === highlight.index) {
                    const range = document.createRange();
                    range.setStart(node, startPos);
                    range.setEnd(node, startPos + highlightText.length);

                    const wrapper = createSpanWrapper(highlight.color);
                    range.surroundContents(wrapper);

                    matchFound = true;
                    break;
                }
                startPos += highlightText.length;
                currentMatchIndex++;
            }
        }

        if (matchFound) break;
    }

    if (!matchFound) {
        console.warn(`Failed to reapply highlight: ${highlight.text}`);
    }
}

function extractTextNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodes = [];

    while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
        }
    }

    return textNodes;
}

function countTextOccurrences(textNodes, highlightText) {
    let occurrences = 0;

    for (const node of textNodes) {
        const nodeText = normalizeText(node.textContent);
        let startPos = 0;

        while ((startPos = nodeText.indexOf(highlightText, startPos)) !== -1) {
            occurrences++;
            startPos += highlightText.length;
        }
    }

    return occurrences;
}

function determineHighlightIndex(textNodes, highlightText, startContainer, startOffset) {
    let matchIndex = 0;
    let currentMatchIndex = 0;

    for (const node of textNodes) {
        const nodeText = normalizeText(node.textContent);
        let startPos = 0;

        while ((startPos = nodeText.indexOf(highlightText, startPos)) !== -1) {
            if (node === startContainer && startPos === startOffset) {
                matchIndex = currentMatchIndex;
                return matchIndex;
            }
            startPos += highlightText.length;
            currentMatchIndex++;
        }
    }

    return matchIndex;
}

function recalculateIndexes() {
    const highlights = JSON.parse(localStorage.getItem('highlights'));
    if (!highlights) return;

    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

    // Collect all text nodes
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    console.log("Text nodes extracted for recalculating indexes:", textNodes);

    highlights.forEach(highlight => {
        let currentIndex = 0;
        let matchIndex = 0;
        const normalizedHighlightText = normalizeText(highlight.text[0]);

        textNodes.forEach(node => {
            const normalizedNodeText = normalizeText(node.textContent);
            let startPos = 0;

            while ((startPos = normalizedNodeText.indexOf(normalizedHighlightText, startPos)) !== -1) {
                if (currentIndex === highlight.index) {
                    highlight.index = matchIndex;
                    break;
                }
                startPos += normalizedHighlightText.length;
                matchIndex++;
            }
        });
    });

    localStorage.setItem('highlights', JSON.stringify(highlights));
    console.log('Indexes recalculated and highlights saved to LocalStorage', highlights);
}


let highlightsReapplied = false;

function observeDOMChangesOnce() {
    if (highlightsReapplied) {
        console.log("Highlights have already been reapplied.");
        return;
    }

    let timeoutId;

    const observer = new MutationObserver((mutationsList, observer) => {
        // Clear the previous timeout to prevent multiple calls
        clearTimeout(timeoutId);

        // Set a new timeout to reapply highlights after 250ms
        timeoutId = setTimeout(() => {
            console.log("Reapplying highlights...");
            reapplyHighlights();
            observer.disconnect(); // Stop observing after highlights are reapplied
            highlightsReapplied = true; // Set the flag to indicate highlights have been reapplied
            console.log("Observer disconnected and highlightsReapplied set to true.");
        }, 250);
    });

    // Observe changes to the entire document body
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    // Initial call to reapply highlights when the script is first run
    console.log("Initial call to reapply highlights.");
    recalculateIndexes();
    reapplyHighlights();
}

// Call observeDOMChangesOnce on window load
window.addEventListener('load', observeDOMChangesOnce);

// LOGIC FOR CROSS-NODE HIGHLIGHTS
function processHighlight(highlights) {
    highlights.forEach(highlight => {
        const highlightsArr = highlight.text;
        const color = highlight.color;
        const matchIndex = highlight.index;

        const matchesArr = findInitialMatches(highlightsArr[0]);

        if (matchesArr.length > 0) {
            const validMatch = validateMatches(matchesArr, highlightsArr);
            if (validMatch) {
                highlightText(validMatch, color);
            }
        }
    });
}

function findInitialMatches(firstString) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const matchesArr = [];

    while ((node = walker.nextNode())) {
        const nodeText = normalizeText(node.textContent);
        let startPos = 0;

        while ((startPos = nodeText.indexOf(firstString, startPos)) !== -1) {
            const range = document.createRange();
            range.setStart(node, startPos);
            range.setEnd(node, startPos + firstString.length);
            matchesArr.push(range);
            startPos += firstString.length;
        }
    }
    return matchesArr;
}

function validateMatches(matchesArr, highlightsArr) {
    for (let match of matchesArr) {
        let valid = true;
        let currentNode = match.endContainer;
        let currentOffset = match.endOffset;
        let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

        // Move the walker to the current node
        walker.currentNode = currentNode;

        for (let i = 1; i < highlightsArr.length; i++) {
            let nextString = highlightsArr[i];
            let found = false;

            while ((currentNode = walker.nextNode())) {
                let nodeText = normalizeText(currentNode.textContent);
                let matchPos = nodeText.indexOf(nextString, currentOffset);

                if (matchPos !== -1) {
                    // Update the current offset and break out of the loop
                    currentOffset = matchPos + nextString.length;
                    found = true;
                    break;
                } else {
                    // Reset the current offset for the next node
                    currentOffset = 0;
                }
            }

            if (!found) {
                valid = false;
                break;
            }
        }

        if (valid) {
            return match;
        }
    }
    return null;
}

function highlightText(validMatch, color) {
    const startNode = validMatch.startContainer;
    const endNode = validMatch.endContainer;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

    console.log(`Highlighting text from "${startNode.textContent}" to "${endNode.textContent}" with color ${color}`);

    let currentNode = startNode;
    let insideHighlight = false;

    while (currentNode) {
        if (currentNode === startNode) {
            const startText = currentNode.textContent.slice(validMatch.startOffset);
            const startWrapper = createSpanWrapper(color);
            startWrapper.textContent = startText;
            currentNode.textContent = currentNode.textContent.slice(0, validMatch.startOffset);
            currentNode.parentNode.insertBefore(startWrapper, currentNode.nextSibling);
            insideHighlight = true;
        } else if (currentNode === endNode) {
            const endText = currentNode.textContent.slice(0, validMatch.endOffset);
            const endWrapper = createSpanWrapper(color);
            endWrapper.textContent = endText;
            currentNode.textContent = currentNode.textContent.slice(validMatch.endOffset);
            currentNode.parentNode.insertBefore(endWrapper, currentNode);
            insideHighlight = false;
            break;
        } else if (insideHighlight) {
            const wrapper = createSpanWrapper(color);
            wrapper.textContent = currentNode.textContent;
            currentNode.parentNode.replaceChild(wrapper, currentNode);
        }

        currentNode = walker.nextNode();
    }
}

// END OF HIGHLIGHT FUNCTIONALITY