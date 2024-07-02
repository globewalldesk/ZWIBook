// Declare variables globally
fullLoadingApproved = false;
let hlnotesDataFound = false;
const urlParams = new URLSearchParams(window.location.search);
const bookId = urlParams.get('bookId');
console.log(`Opening book Project Gutenberg number: ${bookId}`)
let currentBookId = bookId;
let bookshelfData = null;
let bookContentDiv;
let currentBookMetadata;
let resourceMap = {};
let zwiData;
let buffer;
let saveInterval;

function isElementVisible(element) {
    return element && element.style.display !== 'none' && element.offsetWidth > 0 && element.offsetHeight > 0;
}

function loadFont() {
    // Load the font choice from local storage
    const selectedFont = localStorage.getItem('selectedFont') || 'Liberation Serif';  // Default font

    // If there's a font saved, apply it
    document.body.style.fontFamily = selectedFont;
}

async function fetchData() {
    try {
        bookshelfData = await window.electronAPI.requestBookshelfData();
        const backBtnInvoked = localStorage.getItem('backBtnInvoked') === 'true';

        buffer = await window.electronAPI.fetchZWI(currentBookId);
        if (!buffer) {
            console.error('Failed to load book: no buffer.');
            document.getElementById('body').innerHTML = '<p style="width: 400px; font-size: 36px; margin: 50px auto;">Failed to load book. Is the thumb drive inserted? Have you moved the book files, or deleted the file for this particular book?</p>';
            fullLoadingApproved = false;
            return; // Stop further execution in this function
        }
        zwiData = new Uint8Array(buffer);

        const bookMetadata = await window.electronAPI.fetchBookMetadata(currentBookId);
        if (bookMetadata) {
            currentBookMetadata = bookMetadata;
            localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));
            window.electronAPI.updateBookshelf({ bookMetadata, action: 'addViewed' });
        } else {
            console.error("Book metadata not found for ID:", bookId);
        }

        // Ensure notes and highlights are initialized
        localStorage.setItem('highlights', localStorage.getItem('highlights') || JSON.stringify({}));
        localStorage.setItem('notes', localStorage.getItem('notes') || JSON.stringify({}));

        fullLoadingApproved = true;
    } catch (error) {
        console.error('Failed to fetch book data:', error);
        fullLoadingApproved = false;
    }
}

function saveHlnotesDataOnInterval(bookId) {
    const saveData = async () => {
        const highlights = JSON.parse(localStorage.getItem('highlights')) || {};
        const notes = JSON.parse(localStorage.getItem('notes')) || {};
        if (!highlights[bookId] && !notes[bookId]) return; // No need to save if nothing exists for the book

        highlights[bookId] = highlights[bookId] || {};
        notes[bookId] = notes[bookId] || {};

        const data = { highlights, notes };
        await window.electronAPI.saveHlnotesData(bookId, data);
    };

    saveData();

    saveInterval = setInterval(saveData, 60000);

    window.addEventListener('beforeunload', () => clearInterval(saveInterval));
}

///////////////////////////////////
// YE OLDE BIGGE DOM CONTENT LOADED
document.addEventListener('DOMContentLoaded', async () => {
    loadFont();

    // Preload data before manipulating DOM
    try {
        await fetchData();
    } catch (error) {
        console.error('Error during book fetching:', error);
    }

    if (!fullLoadingApproved) {
        console.error('Book loading not approved. Halting further initialization.');
        document.body.innerHTML = '<p style="width: 400px; font-size: 36px; margin: 50px auto;">Failed to load book. Is the thumb drive inserted? Have you moved the book files, or deleted the file for this particular book?</p>';
        return; // Exit if book loading is not approved
    }

    // Clear existing highlights and notes from local storage after fetching data
    localStorage.removeItem('highlights');
    localStorage.removeItem('notes');

    // Load highlights and notes data from disk
    const hlnotesData = await window.electronAPI.loadHlnotesData(currentBookId);
    if (hlnotesData) {
        // Ensure the structure includes the currentBookId
        const highlights = { [currentBookId]: {} };
        highlights[currentBookId] = hlnotesData.highlights || {};
        const notes = { [currentBookId]: {} };
        notes[currentBookId] = hlnotesData.notes || {};
        if (Object.keys(highlights[currentBookId]).length === 0 && Object.keys(notes[currentBookId]).length === 0) {
            hlnotesDataFound = false;
        } else {
            hlnotesDataFound = true;
        }

        localStorage.setItem('highlights', JSON.stringify(highlights));
        localStorage.setItem('notes', JSON.stringify(notes));
    } else {
        hlnotesDataFound = false;
        // If no data is returned, initialize with empty objects
        const highlights = { [currentBookId]: {} };
        const notes = { [currentBookId]: {} };

        localStorage.setItem('highlights', JSON.stringify(highlights));
        localStorage.setItem('notes', JSON.stringify(notes));
    }
    
    // Send the current book title and author to the main process
    // Used when asking Bing Copilot to comment on selection
    window.electronAPI.sendBookInfo({
        title: currentBookMetadata.Title,
        author: currentBookMetadata.CreatorNames[0]
    });

    // Now the DOM is fully loaded and we can safely interact with it
    bookContentDiv = document.getElementById('book-content');
    if (!buffer) {
        bookContentDiv.textContent = 'Failed to load book: no buffer.';
        return;
    }

    // Back button logic
    function manageNavigationOnLoad() {
        const navCounter = parseInt(localStorage.getItem('navCounter'), 10);
        const shouldDisplay = navCounter > 1 || (history.length > 1 && localStorage.getItem('lastAddress') !== window.location.pathname);
        displayBackButton(shouldDisplay);
    }

    function displayBackButton(shouldDisplay) {
        const backBtn = document.getElementById('backBtn');
        backBtn.style.display = shouldDisplay ? 'block' : 'none';
    }

    manageNavigationOnLoad();

    // Event listener for the back button
    document.getElementById('backBtn').addEventListener('click', function (event) {
        event.preventDefault();
        let navCounter = parseInt(localStorage.getItem('navCounter'), 10);
        navCounter -= 2;
        localStorage.setItem('navCounter', navCounter.toString());
        localStorage.setItem('backBtnInvoked', true);
        history.back();
    });
    // End back button block


    const bookshelfAddRemove = document.querySelector('#bookshelfAddRemove');

    bookshelfAddRemove.style.display = 'flex';

    async function showSavedState(bookId) {
        const icon = bookshelfAddRemove.querySelector('img');
        // If the book is in the savedBooks list, show the right icon.
        if (bookshelfData.savedBooks.some(book => book.PG_ID === currentBookId)) {
            bookshelfAddRemove.classList.add("bi-journal-minus");
            bookshelfAddRemove.classList.remove("bi-journal-plus");
            icon.src = "images/icons/remove-book.svg";
        } else {
            bookshelfAddRemove.classList.remove("bi-journal-minus");
            bookshelfAddRemove.classList.add("bi-journal-plus");
            icon.src = "images/icons/add-book.svg";
        }
    }

    // Ensure fetchData has completed and bookshelfData is available
    await showSavedState(bookId); // Initially loads saved state

    // Listener for adding or removing a book from saved list
    bookshelfAddRemove.addEventListener("click", async () => {
        // Determine the action based on the current class
        let isAdding = bookshelfAddRemove.classList.contains('bi-journal-plus');
        let action = isAdding ? 'addSaved' : 'removeSaved';

        // Update the bookshelf with the appropriate action
        await window.electronAPI.updateBookshelf({ bookMetadata: currentBookMetadata, action: action });

        // Re-fetch the updated bookshelf data to ensure the UI can correctly reflect the new state
        bookshelfData = await window.electronAPI.requestBookshelfData();
        console.log(bookshelfData);

        // Show the updated saved state based on the newly fetched data
        showSavedState(currentBookId);
    });

    // Function to update the button positions and set title on hover
    const updateButtonPositions = () => {
        const bookContentRect = bookContentDiv.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const headerHeight = document.getElementById('header').offsetHeight;

        const styleString = `calc(50% - ${bookContentDiv.offsetWidth / 1.99}px)`;
        prevPage.style.left = styleString;
        nextPage.style.right = styleString;

        document.addEventListener('mousemove', (event) => {
            const { left, right } = bookContentRect;
            if (event.clientX < left + 70 && event.clientX > left - 70) {
                prevPage.style.display = 'flex';
                prevPage.style.visibility = 'visible';
                updateReadPercentageTitle(); // Update title on hover
            } else {
                prevPage.style.display = 'none';
                prevPage.style.visibility = 'hidden';
            }

            if (event.clientX > right - 70 && event.clientX < right + 70) {
                nextPage.style.display = 'flex';
                nextPage.style.visibility = 'visible';
                updateReadPercentageTitle(); // Update title on hover
            } else {
                nextPage.style.display = 'none';
                nextPage.style.visibility = 'hidden';
            }
        });

        prevPage.addEventListener('mouseover', () => {
            window.addEventListener('scroll', throttledUpdateReadPercentageTitle);
            updateReadPercentageTitle(); // Initial update on hover
        });
        nextPage.addEventListener('mouseover', () => {
            window.addEventListener('scroll', throttledUpdateReadPercentageTitle);
            updateReadPercentageTitle(); // Initial update on hover
        });

        // Remove scroll listener when not hovering
        prevPage.addEventListener('mouseout', () => {
            window.removeEventListener('scroll', throttledUpdateReadPercentageTitle);
        });
        nextPage.addEventListener('mouseout', () => {
            window.removeEventListener('scroll', throttledUpdateReadPercentageTitle);
        });

        prevPage.addEventListener('mouseover', () => {
            prevPageImg.src = 'images/icons/previous-filled.svg';
        });

        prevPage.addEventListener('mouseout', () => {
            prevPageImg.src = 'images/icons/previous-unfilled.svg';
        });

        nextPage.addEventListener('mouseover', () => {
            nextPageImg.src = 'images/icons/next-filled.svg';
        });

        nextPage.addEventListener('mouseout', () => {
            nextPageImg.src = 'images/icons/next-unfilled.svg';
        });
    };

    document.body.addEventListener('click', function (e) {
        // Use closest to find the nearest ancestor that is an <a> tag with an href attribute starting with "#"
        let target = e.target.closest('a[href^="#"]');

        if (target) {
            e.preventDefault(); // Prevent default anchor click behavior

            const targetId = target.getAttribute('href');
            if (targetId == '#') {
                return;
            }
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Calculate the corrected scroll position considering the fixed header
                const headerHeight = 100; // Adjust if your header height changes
                const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - headerHeight;

                window.scrollTo({
                    top: offsetPosition
                });

                history.pushState(null, null, targetId);
            }
        }
    });

    // Everything above this loads, regardless of whether the book
    if (!fullLoadingApproved) {
        return;
    }


    function processText(text) {  // KJV load: 45ms
        // Split the text into parts by HTML tags
        const parts = text.split(/(<[^>]*>)/);

        // Process the parts without HTML tags
        const processedParts = parts.map(part => {
            // If the part is an HTML tag, return it as is
            if (part.startsWith('<') && part.endsWith('>')) {
                return part;
            }
            // Otherwise, process the text to replace underscores, allowing multi-line processing
            return part.replace(/_([^_]{1,100}?)_/gs, '<i>$1</i>');
        });

        // Join the processed parts back together
        return processedParts.join('');
    }

    function extractAuthor() {
        let creatorNames = currentBookMetadata.CreatorNames;
        const suffixes = ["Ph.D.", "PhD", "Ph. D.", "D.Phil.", "DPhil", "Doctor", "D.D.", "D. D.", "Jr.", "Junior", "Sr.", "Senior", "II", "III", "IV", "V", "Esq.", "Esquire", "MD", "M.D.", "Dr.", "Doctor", "RN", "R.N.", "DO", "D.O.", "DDS", "D.D.S.", "DVM", "D.V.M.", "JD", "J.D.", "LLD", "LL.D.", "EdD", "Ed.D.", "PharmD", "Pharm.D.", "MBA", "M.B.A.", "CPA", "C.P.A.", "DMD", "D.M.D.", "DC", "D.C.", "OD", "O.D.", "PA", "P.A.", "P.A.-C", "MA", "M.A.", "MS", "M.S.", "MSc", "M.Sc.", "MPH", "M.P.H.", "BSc", "B.Sc.", "BA", "B.A.", "BS", "B.S.", "MFA", "M.F.A.", "MPhil", "M.Phil.", "PsyD", "Psy.D.", "EdS", "Ed.S.", "MSW", "M.S.W.", "BFA", "B.F.A.", "MSEd", "M.S.Ed.", "MSE", "M.S.E.", "DPT", "D.P.T.", "DPA", "D.P.A.", "ScD", "Sc.D.", "EngD", "Eng.D.", "ASN", "A.S.N."];

        // Clean creator names by removing square brackets and anything inside them
        let cleanedNames = creatorNames.map(name => name.replace(/\s*\[.*?\]\s*/g, '').trim());

        // Continue with extracting the first author's formatted name
        if (cleanedNames.length > 0) {
            const firstAuthorRegex = /^([^,]+),\s*([^,]+)/;
            let match = cleanedNames[0].match(firstAuthorRegex);

            if (match) {
                let lastName = match[1].trim();
                let firstName = match[2].trim();

                // Handle suffixes
                let suffix = suffixes.find(s => firstName.endsWith(s));
                if (suffix) {
                    firstName = firstName.replace(new RegExp(`\\s*${suffix}$`), ''); // Remove suffix from first name
                }

                // Reformat name from "Lastname, Firstname" to "Firstname Lastname"
                let formattedName = `${firstName} ${lastName}`;

                if (suffix) {
                    formattedName += `, ${suffix}`; // Append suffix if present
                }
                return formattedName;
            } else {
                return "No valid author data found.";
            }
        } else {
            return "No creator names available.";
        }
    }

    // "poetrySwitch" logic (user sets separate vs. merged lines)
    function addSwitch() {
        // Create the switch element as an object
        const switchElement = document.createElement('div');
        switchElement.innerHTML = `
            <div class="switchContainer">
                <label class="poetrySwitch">
                    <span class="switchLabel leftLabel">Merge<br/>lines</span>
                    <input type="checkbox" id="separateLinesSwitch">
                    <span class="slider round"></span>
                    <span class="switchLabel rightLabel">Separate<br/>lines</span>
                </label>
            </div>
        `;
        return switchElement.innerHTML; // Return the HTML to be added
    }

    function prepPlainText(text, isPoetry) {   // Luther Works load: 30.4ms
        const lines = text.split(/\r\n|\r|\n/);
        const paragraphs = [];
        let paragraphIndex = 0;
        let singleLineFlag = false;

        // Extract and format author name
        const formattedAuthorName = extractAuthor();
        const title = currentBookMetadata.Title;

        let tempParagraph = [];
        function flushParagraph() {
            if (tempParagraph.length > 0) {
                let combinedText = tempParagraph.join(' ').replace(/ {2,}/g, ' ');
                combinedText = combinedText.replace(/(\w)  (\w)/g, '$1 $2');
                paragraphs.push(`
                    <div class="bm-paragraph" id="p${paragraphIndex}">
                        <img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${paragraphIndex}" onclick="toggleBookmark(${paragraphIndex})">
                        <p>${combinedText}</p>
                    </div>
                `);
                paragraphIndex++;
                tempParagraph = [];
            }
        }

        // PREPROCESS LINES INDIVIDUALLY
        let titleProcessed = false;
        let authorProcessed = false;
        lines.forEach((line, index) => {
            const modifiedLine = line.replace(/^(\s+)/, match => match.replace(/ /g, '&nbsp;').replace(/\t/g, '&nbsp;&nbsp;&nbsp;'));

            // Check for title or author in the line
            if (!titleProcessed && line.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') === title.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')) {
                paragraphs.push(`<h1 class="center">${line}</h1>`);
                titleProcessed = true;
            } else if (titleProcessed && !authorProcessed && line.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').startsWith('by') && percentageMatch(line.substring(3).toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ''), formattedAuthorName.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')) >= 50) {
                paragraphs.push(`<h2 class="center">${line}</h2>`);
                authorProcessed = true;
            } else if (isPoetry || /^\s+/.test(line)) {
                if (modifiedLine.trim() === '') {
                    paragraphs.push('<p class="single-spaced">&nbsp;</p>');
                } else {
                    paragraphs.push(`<div class="paragraph single-spaced" id="p${paragraphIndex}">
                        <img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${paragraphIndex}" onclick="toggleBookmark(${paragraphIndex})">
                        <p>${modifiedLine}</p>
                    </div>`);
                    paragraphIndex++;
                }
            } else {
                if (modifiedLine.trim() === '') {
                    flushParagraph();
                    if (singleLineFlag) {
                        paragraphs.push('<p class="single-spaced">&nbsp;</p>');
                    }
                    singleLineFlag = true;
                } else {
                    tempParagraph.push(modifiedLine);
                    singleLineFlag = false;
                }
            }
        });

        flushParagraph();
        const separateSwitch = addSwitch();
        paragraphs.unshift(separateSwitch);

        return paragraphs.join('');
    }

    // Helper function to calculate the percentage match between two strings
    function percentageMatch(str1, str2) {
        const words1 = str1.split(/\s+/);
        const words2 = new Set(str2.split(/\s+/));
        const matches = words1.filter(word => words2.has(word));
        return (matches.length / words1.length) * 100;
    }

    fflate.unzip(zwiData, async (err, unzipped) => {   // KJV load 2465.3ms
        console.time("Load");

        if (err) {
            bookContentDiv.textContent = 'Failed to unzip book. Error: ' + err.message;
            console.error('Unzip error:', err);
            return;
        }

        const primaryFilename = currentBookMetadata.Primary;
        if (!primaryFilename || !unzipped[primaryFilename]) {
            bookContentDiv.textContent = 'Error loading book. Try again.';
            console.error('Error: Primary file missing or not found in unzipped content.', primaryFilename);
            return;
        }

        const rawContent = unzipped[primaryFilename];
        const preliminaryContent = new TextDecoder("utf-8").decode(rawContent).substring(0, 5000).toLowerCase();

        const encodingMap = {
            "utf-8": "utf-8",
            "language: russian": "cp1251",
            "language: serbian": "cp1251",
            "iso-8859-1": "iso88591",
            "iso-8859-2": "iso88592",
            "unicode": "utf-8",
            "language: chinese": "utf-8"
        };

        let decoder = new TextDecoder("iso88591"); // Default decoder
        for (const [key, value] of Object.entries(encodingMap)) {
            if (preliminaryContent.includes(key)) {
                decoder = new TextDecoder(value);
                break;
            }
        }

        let bookContent = decoder.decode(rawContent);

        // Remove weird PG tic: double-double quotes in titles
        bookContent = bookContent.replace(/(?<!=[ ]?)""/g, '"');
        // Convert underscore-for-italics into italics
        bookContent = processText(bookContent);

        const pattern = /poet(?:s)?|poem(?:s)?|poète(?:s)?|poème(?:s)?|dichter(?:s)?|gedicht(?:e|er)?|poeta(?:s)?|poema(?:s)?|dikt(?:er)?|поэт(?:ы|ов)?|стих(?:и|ов)?|诗人|诗|song(?:s)?|canzone(?:i)?|lied(?:er|je)?|canción(?:es)?|canto(?:s)?|sång(?:er)?|песня(?:и|ей)?|歌|lyric(?:s)?|lyrique(?:s)?|lyrik(?:en)?|lirica(?:s)?|lyrik(?:er)?|лир(?:ика|ы)?|诗歌/i;

        let isPoetry = pattern.test(currentBookMetadata.Title);
        let separateLines = JSON.parse(localStorage.getItem('separateLines')) || {};
        let separateLinesSetting = separateLines[bookId];

        if (separateLinesSetting !== undefined) {
            isPoetry = separateLinesSetting === 'true';
        } else if (isPoetry) {
            separateLines[bookId] = 'true';
            localStorage.setItem('separateLines', JSON.stringify(separateLines));
        }

        bookContentDiv.innerHTML = primaryFilename.endsWith(".txt") ? prepPlainText(bookContent, isPoetry) : bookContent;

        const firstPre = bookContentDiv.querySelector('pre');
        if (firstPre) {
            const showLink = document.createElement('a');
            showLink.textContent = 'show front-matter';
            showLink.className = 'toggle-front-matter show-link';

            const hideLink = document.createElement('a');
            hideLink.textContent = 'hide front-matter';
            hideLink.className = 'toggle-front-matter hide-link hidden-bits';

            firstPre.classList.add('hidden-front-matter');
            firstPre.parentNode.insertBefore(showLink, firstPre);
            firstPre.parentNode.insertBefore(hideLink, firstPre);

            const frontMatterStateKey = 'pgFrontMatterState';
            const frontMatterState = localStorage.getItem(frontMatterStateKey);

            if (frontMatterState === 'shown') {
                firstPre.classList.remove('hidden-front-matter');
                showLink.classList.add('hidden-bits');
                hideLink.classList.remove('hidden-bits');
            } else {
                firstPre.classList.add('hidden-front-matter');
                showLink.classList.remove('hidden-bits');
                hideLink.classList.add('hidden-bits');
            }

            showLink.addEventListener('click', () => {
                firstPre.classList.remove('hidden-front-matter');
                showLink.classList.add('hidden-bits');
                hideLink.classList.remove('hidden-bits');
                localStorage.setItem(frontMatterStateKey, 'shown');
            });

            hideLink.addEventListener('click', () => {
                firstPre.classList.add('hidden-front-matter');
                showLink.classList.remove('hidden-bits');
                hideLink.classList.add('hidden-bits');
                localStorage.setItem(frontMatterStateKey, 'hidden');
            });
        }

        // Function to preprocess <a> and <img> tags by removing <i>, </i> and updating refs
        function preprocessDocumentElements() {
            const anchors = document.querySelectorAll('a');
            const images = document.querySelectorAll('img');

            anchors.forEach(anchor => {
                let hasChanged = false;
                ['name', 'id', 'href'].forEach(attr => {
                    if (anchor.hasAttribute(attr)) {
                        let value = anchor.getAttribute(attr);
                        // Remove <i> and </i> tags
                        let newValue = value.replace(/<\/?i>/g, '_')
                                            .replace(/(noteref|note|page|fnote|fnanchor)(\d+)/ig, (_, p1, p2) => `${p1}_${p2}`);

                        // Ensure IDs and hrefs do not start with a digit
                        if ((attr === 'id' || attr === 'name') && /^\d/.test(newValue)) {
                            newValue = `id_${newValue}`;
                        } else if (attr === 'href' && newValue.startsWith('#')) {
                            newValue = newValue.replace(/#(noteref|note|page)(\d+)/ig, (_, p1, p2) => `#${p1}_${p2}`);
                            if (/^#\d/.test(newValue)) {
                                newValue = `#id_${newValue.slice(1)}`;
                            }
                        }

                        if (value !== newValue) {
                            anchor.setAttribute(attr, newValue);
                            hasChanged = true;
                        }
                    }
                });

                // Add target="_blank" to external links
                const href = anchor.getAttribute('href');
                if (href && (href.startsWith('http:') || href.startsWith('https:'))) {
                    anchor.setAttribute('target', '_blank');
                }

                // Check if there is a 'name' attribute without a corresponding 'id'
                if (anchor.hasAttribute('name') && !anchor.hasAttribute('id')) {
                    let nameValue = anchor.getAttribute('name');
                    // Ensure 'id' does not start with a digit
                    if (/^\d/.test(nameValue)) {
                        nameValue = `id_${nameValue}`;
                    }
                    anchor.setAttribute('id', nameValue);
                }
            });

            images.forEach(img => {
                if (img.hasAttribute('src')) {
                    let src = img.getAttribute('src');
                    // Remove <i> and </i> tags from src
                    let newSrc = src.replace(/<\/?i>/g, '_');
                    if (src !== newSrc) {
                        img.setAttribute('src', newSrc);
                    }
                }
            });
        }

        preprocessDocumentElements();

        // WORD COUNT LOGIC
        // Function to strip HTML tags and get plain text content
        function getTextContent(htmlContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.textContent || tempDiv.innerText || '';
        }

        // Function to count words in a given text
        function countWords(text) {
            return text.split(/\s+/).filter(Boolean).length;
        }

        // Get the plain text content and count the words
        const plainTextContent = getTextContent(bookContentDiv.innerHTML);
        const wordCount = countWords(plainTextContent);
        const pageCount = Math.ceil(wordCount / 300);

        // Move inline centering to class.
        const relevantTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'tr', 'figcaption', 'aside', 'address', 'details', 'summary'];
        // Iterate over each relevant tag and process elements with inline centering
        relevantTags.forEach(tag => {
            bookContentDiv.querySelectorAll(`${tag}[style*="text-align: center"], ${tag}[align="center"]`).forEach(element => {
                if (element.style.textAlign === 'center') {
                    element.style.textAlign = ''; // Remove the inline style
                }
                element.removeAttribute('align'); // Remove the align attribute if present
                element.classList.add('center'); // Add the center class
            });
        });

        // Check if the switch exists
        const poetrySwitch = document.querySelector('.poetrySwitch input');
        if (poetrySwitch) {
            let separateLines = JSON.parse(localStorage.getItem('separateLines')) || {};

            // Adding event listener to the switch
            poetrySwitch.addEventListener('change', function () {
                separateLines[bookId] = this.checked ? 'true' : 'false';
                localStorage.setItem('separateLines', JSON.stringify(separateLines));
                setTimeout(() => {
                    location.reload();
                }, 800);
            });

            // Set the switch position based on the latest setting
            poetrySwitch.checked = separateLines[bookId] === 'true';
        }

        function addBookmarkIcon(element, index) {
            // Add bookmark icon
            const bookmarkIcon = document.createElement('img');
            bookmarkIcon.src = "images/icons/bookmark.svg";
            bookmarkIcon.className = "bookmark-icon";
            bookmarkIcon.id = `bookmark-${index}`;
            bookmarkIcon.onclick = () => toggleBookmark(index);

            // Check if the element is already wrapped in a <div> with the 'bm-paragraph' class
            const parentDiv = element.closest('div.bm-paragraph');

            if (parentDiv) {
                // If already wrapped, just insert the bookmark icon before the element
                parentDiv.insertBefore(bookmarkIcon, element);
            } else {
                // Create a new wrapper element
                const wrapper = document.createElement('div');
                wrapper.className = 'bm-paragraph';
                wrapper.id = element.id;

                // Preserve the original class of the paragraph
                const newElement = document.createElement(element.tagName);
                newElement.className = element.className;
                newElement.innerHTML = element.innerHTML;

                // Add bookmark icon and the original element to the wrapper
                wrapper.appendChild(bookmarkIcon);
                wrapper.appendChild(newElement);

                // Replace the original element with the wrapper
                element.parentNode.replaceChild(wrapper, element);
            }
        }

        function assignIDsToContentElements(content) {
            let paragraphIndex = 0;
            const elements = content.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, figcaption, aside, address, details, summary');

            elements.forEach(element => {
                if (!element.id && ((element.tagName === 'DIV' && !element.querySelector('p') && element.textContent.trim().length > 0) || element.tagName !== 'DIV')) {
                    element.id = `p${paragraphIndex}`;
                    addBookmarkIcon(element, paragraphIndex);
                    paragraphIndex++;
                }
            });

            return content;
        }

        // Usage after setting the innerHTML for bookContentDiv
        if (primaryFilename.endsWith(".html") || primaryFilename.endsWith(".htm")) {
            assignIDsToContentElements(bookContentDiv);
        }

        async function applyBookmarks() {
            try {
                const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
                bookmarks.forEach(bookmarkId => {
                    const elem = document.getElementById(bookmarkId);
                    if (elem) {
                        const icon = elem.querySelector('.bookmark-icon');
                        if (icon && !icon.classList.contains('filled')) {
                            icon.classList.add('filled');
                            icon.src = 'images/icons/bookmark-fill.svg';
                            icon.style.visibility = 'visible'; // Ensure it is always visible
                        }
                    } else {
                        console.log('Element not found for bookmark:', bookmarkId); // Log missing elements
                    }
                });
                setTimeout(restoreScrollPosition, 250); // This is placed here simply because this function takes longest.
            } catch (error) {
                console.error('Error fetching bookmarks:', error);
            }
        }

        applyBookmarks();

        // Function to clean up file paths
        function cleanPath(path) {
            return path.replace(/<\/?[^>]+>/gi, ''); // Strip out HTML tags
        }

        const filenameMap = {}; // New hashmap to store Blob URLs and their original filenames
        // When creating Blob URLs and storing them in the resourceMap:
        Object.keys(unzipped).forEach(filename => {
            if (filename !== primaryFilename && (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.gif'))) {
                const fileBlob = new Blob([unzipped[filename]], { type: 'image/' + filename.split('.').pop() });
                const fileUrl = URL.createObjectURL(fileBlob);
                const normalizedFilename = cleanPath(filename.replace('data/media/images/', ''));
                resourceMap[normalizedFilename] = fileUrl;
                filenameMap[fileUrl] = normalizedFilename; // Store the mapping from Blob URL to original filename
            }
        });

        document.querySelectorAll('#book-content img').forEach(img => {
            const originalSrc = img.getAttribute('src');

            if (!originalSrc.startsWith('images/icons/')) {
                const normalizedSrc = cleanPath(originalSrc.replace('data/media/images/', ''));
                if (resourceMap[normalizedSrc]) {
                    img.setAttribute('src', resourceMap[normalizedSrc]);
                    img.setAttribute('data-original-path', originalSrc);
                } else {
                    console.log('No Blob URL found for:', originalSrc);
                }
            }
        });

        document.addEventListener('click', function(event) {
            const target = event.target.closest('img');
            if (target && target.getAttribute('data-original-path')) {
                event.preventDefault();
                const modal = document.getElementById('imageModal');
                const modalImg = document.getElementById('modalImage');
                const captionText = document.getElementById('caption');
                modal.style.display = "block";
                modalImg.src = target.src;
                captionText.innerHTML = target.alt;
            }
        });

        document.addEventListener('click', function(event) {
            const anchor = event.target.closest('a');
            if (anchor && anchor.getAttribute('href').endsWith('.jpg')) { // Adjust as needed for other image types
                event.preventDefault();
                const imagePath = anchor.getAttribute('href').replace('data/media/images/', '');
                const blobUrl = resourceMap[imagePath];

                if (blobUrl) {
                    const originalFilename = filenameMap[blobUrl] || 'downloaded_image'; // Look up the original filename
                    console.log('onDownloadImageRequest received:', { imageUrl: blobUrl, originalFilename });
                    // Create a temporary link element to trigger the download
                    const downloadLink = document.createElement('a');
                    downloadLink.href = blobUrl;
                    downloadLink.download = originalFilename;
                    console.log('Triggering download with filename:', downloadLink.download);
                    downloadLink.click();
                } else {
                    console.error('Blob URL not found for:', imagePath);
                }
            }
        });


        // Close the image modal that was just created
        // Get the <span> element that closes the modal
        var span = document.getElementsByClassName("close-this")[0];
        // When the user clicks on <span> (x), close the modal
        span.onclick = function () {
            var modal = document.getElementById('imageModal');
            modal.style.display = "none";
        }
        document.addEventListener('keydown', function (event) {
            if (event.key === "Escape") {  // Check if the key pressed is 'Escape'
                var modal = document.getElementById('imageModal');
                if (modal.style.display === "block") {  // Check if the modal is currently displayed
                    modal.style.display = "none";  // Hide the modal
                }
            }
        });

        // Utility function to get the basename from a path or URL
        function getBasename(url) {
            return url.split('/').pop().split('#')[0].split('?')[0];
        }

        // Support direct <a href> links to images (for direct download)
        function handleImageDownload(event) {
            const anchor = event.target.closest('a');
            if (anchor && anchor.getAttribute('href').endsWith('.jpg')) { // Adjust as needed for other image types
                event.preventDefault();
                const imagePath = anchor.getAttribute('href').replace('data/media/images/', '');
                const blobUrl = resourceMap[imagePath];

                if (blobUrl) {
                    window.electronAPI.onDownloadImageRequest({ imageUrl: blobUrl });
                } else {
                    console.error('Blob URL not found for:', imagePath);
                }
            }
        }

        // Add event listener to the document for intercepting link clicks
        document.addEventListener('click', handleImageDownload);

        // WORD COUNT DISPLAY
        // Create a container for both the word count and the "About" link
        const footerDiv = document.createElement('div');
        footerDiv.classList.add('footer-container');

        // Create the "About" link
        const aboutLinkWrapper = document.createElement('div');
        aboutLinkWrapper.classList.add('about-link-wrapper-reader');
        aboutLinkWrapper.innerHTML = `<a href="about.html#book-reader">About this<br>reader software</a>`;

        // Create the word count div
        const wordCountDiv = document.createElement('div');
        wordCountDiv.classList.add('word-count');
        wordCountDiv.innerHTML = `<i>Word count: ${wordCount.toLocaleString()}<br>(${pageCount.toLocaleString()} average pages)</i>`;

        // Create the word count hover-over popup
        const countPopup = document.createElement('div');
        countPopup.classList.add('count-popup');
        countPopup.innerHTML = `<i>Word count: ${wordCount.toLocaleString()}<br>(${pageCount.toLocaleString()} average pages)</i>`;
        document.body.appendChild(countPopup);

        // Append the "About" link and word count div to the container
        footerDiv.appendChild(aboutLinkWrapper);
        footerDiv.appendChild(wordCountDiv);

        // Append the container to the bottom of #book-content
        document.getElementById('book-content').appendChild(footerDiv);


        // Add event listeners to #headTitle
        const headTitle = document.getElementById('headTitle');
        headTitle.addEventListener('mouseover', function (event) {
            countPopup.style.display = 'block';
            countPopup.style.left = event.pageX + 'px';
            countPopup.style.top = event.pageY + 'px';
        });

        headTitle.addEventListener('mousemove', function (event) {
            countPopup.style.left = event.pageX + 'px';
            countPopup.style.top = event.pageY + 'px';
        });

        headTitle.addEventListener('mouseout', function () {
            countPopup.style.display = 'none';
        });
        console.timeEnd("Load");

    }); // END of fflate

    // Helper for title-setter
    function setMoretext(more, headTitle, wholeTitle, truncatedTitle, space) {
        more.addEventListener('click', function (event) {
            event.preventDefault();
            if (more.textContent === "more") {
                headTitle.textContent = wholeTitle; // Expand to show full title
                more.textContent = "less"
                headTitle.appendChild(space);
                headTitle.appendChild(more);
            } else {
                headTitle.textContent = truncatedTitle;
                more.textContent = "more";
                headTitle.appendChild(space);
                headTitle.appendChild(more);
            }
        });
    }

    function setTitle() {
        if (!currentBookMetadata?.Title) return;

        let headTitle = document.getElementById('headTitle');

        let wholeTitle = currentBookMetadata.Title;
        wholeTitle = wholeTitle.replace(/\"\"/g, '"'); // Remove weird PG tic: double-double quotes in titles
        let truncatedTitle = wholeTitle;
        let more = document.createElement('a');
        more.classList.add("more");
        const space = document.createTextNode(" ");

        // Determine truncation length based on viewport width
        const viewportWidth = window.innerWidth;
        let truncationLength = 65; // Default truncation length for large screens
        if (viewportWidth > 675 && viewportWidth <= 850) {
            truncationLength = 55; // Truncate more for middle-sized viewports
        } else if (viewportWidth > 530 && viewportWidth <= 675) {
            truncationLength = 45;
        } else if (viewportWidth <= 530) {
            truncationLength = 37;
        }

        // Adjust the title display based on actual length
        const moreText = "… more";
        if (wholeTitle.length > truncationLength) {
            truncatedTitle = wholeTitle.substring(0, truncationLength - moreText.length) + "…";
            more.textContent = "more";
            more.href = "#";
            setMoretext(more, headTitle, wholeTitle, truncatedTitle, space);
        } else {
            truncatedTitle = wholeTitle; // Use the full title if no truncation is needed
            more.style.display = 'none'; // Optionally hide the 'more' link if not needed
        }

        headTitle.textContent = truncatedTitle;
        headTitle.appendChild(space);
        headTitle.appendChild(more);
    }

    setTitle();
    window.addEventListener('resize', () => {
        setTitle();
    });

    try {
        const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
        bookmarks.forEach(bookmarkId => {
            const elem = document.getElementById(bookmarkId);
            if (elem) {
                const icon = elem.querySelector('.bookmark-icon');
                icon.classList.add('filled');
                icon.src = 'images/icons/bookmark-fill.svg';
                icon.style.visibility = 'visible'; // Ensure it is always visible
            }

        });
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
    }

    const bookmarksBtn = document.getElementById('bookmarksBtn');
    const bookmarksDropdown = document.getElementById('bookmarksDropdown');

    bookmarksBtn.addEventListener('click', function (event) {
        event.preventDefault();
        const isDisplayed = bookmarksDropdown.style.display === 'flex';
        bookmarksDropdown.style.display = isDisplayed ? 'none' : 'flex';

        if (!isDisplayed) {
            displayBookmarks();
        }
    });

    // Ensure bookmark modal is closed on 'Escape' key press
    document.addEventListener('keydown', function (event) {
        if (event.key === "Escape") {
            if (bookmarksDropdown && bookmarksDropdown.style.display === 'flex') {
                bookmarksDropdown.style.display = 'none';
            }
        }
    });

    document.addEventListener('click', function (event) {
        if (!bookmarksDropdown.contains(event.target) && !bookmarksBtn.contains(event.target)) {
            bookmarksDropdown.style.display = 'none';
        }
    });

    // Prevent clicks inside the dropdown from propagating
    bookmarksDropdown.addEventListener('click', function (event) {
        event.stopPropagation();
    });

    async function displayBookmarks() {
        try {
            const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
            const docHeight = document.documentElement.scrollHeight;
            if (bookmarks && bookmarks.length > 0) {
                const bookmarksWithPosition = bookmarks.map(id => {
                    const paragraphElement = document.getElementById(id);
                    let position = paragraphElement ? (paragraphElement.offsetTop / docHeight) * 100 : 0;
                    return { id, position };
                });

                bookmarksWithPosition.sort((a, b) => a.position - b.position);

                const bookmarksHtml = bookmarksWithPosition.map(bookmark => {
                    const paragraphElement = document.getElementById(bookmark.id);
                    let snippet = paragraphElement ? paragraphElement.textContent.slice(0, 150) + '...' : 'No preview available';
                    let position = bookmark.position.toFixed(0); // Format to 0 decimal places
                    return `
                    <div class="dropdown-btn bookmark-item" data-bookmark-id="${bookmark.id}">
                        <div class="bookmark-column" onclick='goToBookmark("${bookmark.id}");'>
                            <img src="images/icons/bookmark-fill.svg">
                            <div class="bookmark-percentage">${position}%</div>
                        </div>
                        <span class="bookmark-snippet" onclick='goToBookmark("${bookmark.id}");'>${snippet}</span>
                        <img src="images/icons/trash.svg" class="delete-bookmark" onclick="deleteBookmark('${bookmark.id}')" title="Delete">
                    </div>
                    `;
                }).join('');
                bookmarksDropdown.innerHTML = bookmarksHtml;
            } else {
                bookmarksDropdown.innerHTML = '<i>No bookmarks yet.<br>To add some, click next to a paragraph.</i>';
            }
            // Ensure the dropdown remains visible
            bookmarksDropdown.style.display = 'flex';
        } catch (error) {
            console.error('Failed to fetch bookmarks:', error);
            bookmarksDropdown.innerHTML = '<i>Error loading bookmarks.</i>';
            // Ensure the dropdown remains visible even on error
            bookmarksDropdown.style.display = 'flex';
        }
    }

    /////////////////////////////
    // Find on page functionality
    const inputField = document.getElementById('searchText');
    const findButton = document.getElementById('findButton');
    const modal = document.getElementById('findOnPage');

    const performSearch = () => window.electronAPI.performFind(inputField.value.trim());

    const realText = "";

    // Modify the keypress listener to use the search counter
    inputField.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent form submission
            inputField.setAttribute("inert", "");
            performSearch();
            setTimeout(() => {
                inputField.removeAttribute("inert");
                inputField.focus();
            }, 100); // Refocus after a delay
        }
    });

    // Reset the search counter explicitly when the "Find" button is clicked
    findButton.addEventListener('click', performSearch);

    // This function listens for the toggle command from the main process
    window.electronAPI.onToggleFindModal(() => {
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        if (modal.style.display === 'block') {
            inputField.focus();  // Automatically focus on the input when the modal is shown
        }
    });

    // Handling closing modal when clicking outside the modal
    window.onclick = function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        } else if (event.target === fontModal) {
            closeFontModal(); // Close the modal if the click was outside the modal content
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function (event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
        }
    };

    function updateBooksViewed() {
        try {
            // First, check if book metadata is correctly loaded
            if (!currentBookMetadata) {
                console.error("No current book metadata available.");
                return;
            }

            // Retrieve the viewed books list from local storage
            const viewedBooks = JSON.parse(localStorage.getItem('booksViewed')) || [];

            // Find if the current book is already in the viewed books list
            const existingIndex = viewedBooks.findIndex(book => book.PG_ID === currentBookMetadata.PG_ID);

            // If it exists, remove it to avoid duplicates and to update its position
            if (existingIndex > -1) {
                viewedBooks.splice(existingIndex, 1);
            }

            // Add the current book to the front of the list
            viewedBooks.unshift(currentBookMetadata);

            // Update local storage with the new viewed books list
            localStorage.setItem('booksViewed', JSON.stringify(viewedBooks));

            // Update the bookshelf in the backend via IPC
            window.electronAPI.updateBookshelf({ bookMetadata: currentBookMetadata, action: 'addViewed' });

        } catch (e) {
            console.error("Error updating Books Viewed: ", e);
        }
    }


    updateBooksViewed();

    // Listen for the 'export-zwi' message from the main process
    window.electronAPI.startZWIExport(() => {
        console.log("Received 'export-zwi' message in reader.js");
        console.log(`Exporting ZWI for book ID: ${currentBookId}`);
        window.electronAPI.finishZwiExport(currentBookId);  // This should now work as intended
    });


    // Definition of the exportZwiFunction, which handles exporting a ZWI file
    function exportZwiFunction(bookId) {
        console.log(`Initiating export for book ID: ${bookId}`);
        // Send the book ID back to the main process for exporting the ZWI
        window.electronAPI.finishZwiExport(bookId);
    }

    // BEGIN left-right navigation buttons
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    const prevPageImg = prevPage.querySelector('img');
    const nextPageImg = nextPage.querySelector('img');

    // Throttle function to limit the frequency of calls
    function throttlePercentageRead(fn, wait) {
        let time = Date.now();
        return function() {
            if ((time + wait - Date.now()) < 0) {
                fn();
                time = Date.now();
            }
        };
    }

    // Function to calculate the percentage read based on scroll position
    const calculateReadPercentage = () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        const percentage = Math.min(Math.max((scrollTop / (scrollHeight - clientHeight)) * 100, 0), 100);
        return Math.round(percentage);
    };

    // Function to update the title attribute with the read percentage
    const updateReadPercentageTitle = () => {
        const percentage = calculateReadPercentage();
        prevPage.title = `${percentage}% read`; // Set title for previous page button
        nextPage.title = `${percentage}% read`; // Set title for next page button
    };

    // Throttled version of updateReadPercentageTitle
    const throttledUpdateReadPercentageTitle = throttlePercentageRead(updateReadPercentageTitle, 500);

    if (fullLoadingApproved) {
        // Highlights and notes are applied after everything else is set up
        setTimeout(reapplyHighlightsNotes, 250);

        // Start saving highlight and notes data at regular intervals
        setTimeout(saveHlnotesDataOnInterval(currentBookId)), 500;
    }

    // Function to calculate the scroll amount and handle the page navigation
    const scrollPage = (direction) => {
        const viewportHeight = window.innerHeight;
        const headerHeight = document.getElementById('header').offsetHeight;

        if (direction === 'next') {
            document.documentElement.scrollBy({
                top: viewportHeight - headerHeight - 125
            });
        } else if (direction === 'prev') {
            document.documentElement.scrollBy({
                top: - viewportHeight + headerHeight + 125
            });
        }

        setTimeout(() => {
            console.log('New scroll position:', bookContentDiv.scrollTop);
        }, 250); // Wait a bit for the scroll action to complete
    };

    // Ensure button positions are updated after the DOM is fully rendered
    
    setTimeout(updateButtonPositions, 500); // Adding a delay of 100ms

    // Attach click event listeners to the navigation buttons
    nextPage.addEventListener('click', () => scrollPage('next'));
    prevPage.addEventListener('click', () => scrollPage('prev'));

    window.addEventListener('resize', updateButtonPositions);
    // END of left-right nav button logic


    // Save Current Position for Current Book
    function saveCurrentPosition() {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPosition = window.scrollY;
        let percentageThrough = (scrollPosition / totalHeight) * 100;
        percentageThrough = isNaN(percentageThrough) ? 0 : percentageThrough; // Default to 0 if calculation fails

        // console.log(`Attempting to save position: ${percentageThrough.toFixed(2)}% for bookId: ${currentBookId}`);

        if (percentageThrough >= 0 && percentageThrough <= 100) {
            window.electronAPI.sendLastReadPosition({
                bookId: currentBookId,
                position: percentageThrough.toFixed(2)  // Make sure to use 'position' as the key
            });
        } else {
            console.error(`Invalid scroll percentage: ${percentageThrough.toFixed(2)}%`);
        }
    }

    // Throttle position saving
    function throttlePosition(func, initialDelay, interval) {
        let timeout;
        let lastExec = 0;

        return function () {
            const context = this;
            const args = arguments;
            const elapsed = Date.now() - lastExec;

            const execute = function () {
                func.apply(context, args);
                lastExec = Date.now();
            };

            clearTimeout(timeout);

            if (elapsed > interval) {
                // If sufficient time has elapsed, execute immediately
                execute();
            } else {
                // Otherwise, delay the execution
                timeout = setTimeout(execute, initialDelay);
            }
        };
    }

    // Usage of the updated throttle function
    window.addEventListener('scroll', throttlePosition(saveCurrentPosition, 500, 2000));

    // Menu management
    window.electronAPI.updateGutenbergMenu(currentBookId);
    window.electronAPI.refreshMenu();
});

async function deleteBookmark(bookmarkId) {
    // Remove bookmark visually from the dropdown
    const bookmarkElement = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmarkId}"]`);
    if (bookmarkElement) {
        bookmarkElement.remove();
    }

    // Update the filled icon to the empty state if the bookmark is currently visible
    const bookmarkIcon = document.getElementById(`bookmark-${bookmarkId.split('p')[1]}`);
    if (bookmarkIcon && bookmarkIcon.classList.contains('filled')) {
        bookmarkIcon.classList.remove('filled');
        bookmarkIcon.src = 'images/icons/bookmark.svg';
    }

    // Send the update to the main process to update the storage
    await window.electronAPI.sendBookmarkUpdate({
        bookId: currentBookId,
        bookmarkId: bookmarkId,
        isAdd: false // Set to false to indicate removal
    });
}

function toggleBookmark(index) {
    const bookmarkIcon = document.getElementById(`bookmark-${index}`);
    const isAdding = !bookmarkIcon.classList.contains('filled');

    if (isAdding) {
        bookmarkIcon.classList.add('filled');
        bookmarkIcon.src = 'images/icons/bookmark-fill.svg';
    } else {
        bookmarkIcon.classList.remove('filled');
        bookmarkIcon.src = 'images/icons/bookmark.svg';
    }

    window.electronAPI.sendBookmarkUpdate({
        bookId: currentBookId,
        bookmarkId: `p${index}`,
        isAdd: isAdding
    });
}

// This function might be defined to scroll to the specific paragraph
function goToBookmark(paragraphId) {
    const element = document.getElementById(paragraphId);
    console.log("element:", element);
    if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' });
        window.scrollBy(0, -120);
    }
}

//////////////////////
// Font modal logic
const fontModal = document.getElementById('fontModal');

// Function to toggle the font chooser modal
function toggleFontModal() {
    const fontModal = document.getElementById('fontModal');
    fontModal.style.display = (fontModal.style.display === 'block' ? 'none' : 'block');
}

function setFont(fontName) {
    // Apply the font to the body or specific element
    document.body.style.fontFamily = fontName;

    // Save the font choice to local storage
    localStorage.setItem('selectedFont', fontName);
}

function applyFont(fontName) {
    const contentArea = document.body;
    contentArea.style.fontFamily = fontName;  // Apply the font
    setFont(fontName);
    closeFontModal();  // Close the modal
}

function closeFontModal() {
    fontModal.style.display = 'none';
}

// Listen for the choose-font event to toggle the modal
electronAPI.onChooseFont(() => {
    toggleFontModal(); // Call function to toggle the font modal
});


// Keydown event to close modal on pressing the Escape key or toggle with CmdOrCtrl+Alt+F
window.onkeydown = function (event) {
    const fontModal = document.getElementById('fontModal');
    if (event.key === "Escape" && fontModal.style.display === 'block') {
        fontModal.style.display = 'none';
    }
    // Optionally, add toggling with CmdOrCtrl+Alt+F if it needs to be handled directly here
};


// Restore Last Read Position for Current Book, defined globally
function restoreScrollPosition() {
    if (bookshelfData) {
        const lastReadData = bookshelfData.readingPositions.find(pos => pos.PG_ID === currentBookId);
        const lastReadPercentage = lastReadData ? parseFloat(lastReadData.lastReadPosition) : null;

        if (lastReadPercentage) {
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPosition = (lastReadPercentage / 100) * totalHeight;
            window.scrollTo(0, scrollPosition);
        }
    } else {
        console.log("bookshelfData is not loaded yet");
    }
}

document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
        event.preventDefault();
        window.electronAPI.zoom(event.deltaY);
    }
});



///////////////////////////
// HIGHLIGHT FUNCTIONALITY

// Global variables for highlight and note functionality
let ignoreNextClick = false;
let selectedText = null;
let highlightCounter = 0;
let defaultNoteOpen = true;
let mostRecentColor = 'yellow'; // Default color

// Initialize highlight modal and its event listeners
function initializeHighlightAndNoteModal() {
    let hmodal = document.getElementById('highlightModal');
    if (!hmodal) {
        hmodal = document.createElement('div');
        hmodal.id = 'highlightModal';
        hmodal.className = 'highlight-modal';
        hmodal.innerHTML = `
            <div class="highlight-modal-content">
                <div class="color-selection">
                    <div class="color-circle" title="Yellow"></div>
                    <div class="color-circle" title="Pink"></div>
                    <div class="color-circle" title="Green"></div>
                    <div class="color-circle" title="Blue"></div>
                    <div class="color-circle" title="Purple"></div>
                    <div class="color-circle" title="White"></div>
                    <div class="color-circle delete-circle" title="Delete Highlight"></div>
                    <div class="color-circle edit-note" title="Edit Note (select+'n')"><img src="images/icons/edit-note.svg"></div>
                </div>
                <textarea class="note-input" style="display: none;"></textarea>
            </div>
        `;
        document.body.appendChild(hmodal);

        // Attach event listeners to color circles
        document.querySelectorAll('.color-circle').forEach(circle => {
            circle.addEventListener('click', function (event) {
                event.stopPropagation(); // Prevent interference with the click event
                if (!this.classList.contains('edit-note')) {
                    mostRecentColor = this.title.toLowerCase(); // Update the most recent color
                    let returnValue = true; // Becomes false if deletion is canceled.
                    returnValue = highlightSelection(mostRecentColor);
                } else if (this.classList.contains('edit-note')) {
                    toggleNoteInput();
                }
            });
        });

        hmodal.style.pointerEvents = 'auto'; // Make the modal interactive
    }
}

// Event listener to store the most recently-used highlight color
document.querySelectorAll('.color-circle').forEach(circle => {
    circle.addEventListener('click', function (event) {
        event.stopPropagation(); // Prevent interference with the click event
        if (!this.classList.contains('edit-note')) {
            mostRecentColor = this.title.toLowerCase();
            console.log("Most recent color set to:", mostRecentColor);
            highlightSelection(mostRecentColor);
        } else {
            toggleNoteInput();
        }
    });
});


// Function to show the highlight modal on text selection
function showHighlightModal(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const hmodal = document.getElementById('highlightModal');
    if (hmodal) {
        designHighlightModal(hmodal, rect.bottom);
    }
}

// Function to show the highlight modal on highlight click
function showHighlightModalOnHighlightClick(hnid, boundingRects) {
    const hmodal = document.getElementById('highlightModal');
    if (hmodal) {
        let bottomPosition = 0;
        let leftMost = Number.MAX_VALUE;
        let rightMost = Number.MIN_VALUE;

        for (let rect of boundingRects) {
            const bottom = rect.top + rect.height;
            if (bottom > bottomPosition) {
                bottomPosition = bottom;
            }
            if (rect.left < leftMost) {
                leftMost = rect.left;
            }
            if (rect.right > rightMost) {
                rightMost = rect.right;
            }
        }

        designHighlightModal(hmodal, bottomPosition);

        const noteInput = hmodal.querySelector('.note-input');
        noteInput.dataset.hnid = hnid;

        const notes = JSON.parse(localStorage.getItem('notes')) || {};
        if (!notes[bookId] || Object.keys(notes[bookId]).length === 0) notes[bookId] = {};
        if (notes[bookId] && notes[bookId].hnids && notes[bookId].hnids[hnid]) {
            defaultNoteOpen = true;
            noteInput.style.display = 'block';
            noteInput.value = notes[bookId].hnids[hnid];
            hmodal.style.width = '500px'; // Expand modal width when note is present
            snapModalToTopAndAdjustHeight();
        } else {
            defaultNoteOpen = false;
            noteInput.style.display = 'none';
            noteInput.value = '';
            hmodal.style.width = '350px'; // Reset modal width
        }

        centerHighlightModal(hmodal); // Center the modal based on the updated width
    }
}

// Function to design and position the modal
function designHighlightModal(hmodal, bottomPosition) {
    setTimeout(() => {
        hmodal.style.top = `${bottomPosition + window.scrollY}px`;
        hmodal.style.display = 'block';
        snapModalToTopAndAdjustHeight();
    }, 40); // Delay execution by 100ms
}

function toggleNoteInput() {
    console.log("togglin'");
    const noteInput = document.querySelector('.note-input');
    const hmodal = document.getElementById('highlightModal');
    if (noteInput && hmodal) {
        if (noteInput.style.display === 'none') {
            noteInput.style.display = 'block';
            hmodal.style.width = '500px';
            snapModalToTopAndAdjustHeight();
        } else {
            noteInput.style.display = 'none';
            hmodal.style.width = '350px';
            hmodal.style.height = 'auto'; // Reset modal height
        }
    }
    centerHighlightModal(hmodal);
}

// Adjusts top position of color modal when (a) clicking a highlight;
// (b) toggling note input; or (c) scrolling; and only if a note is
// on the long side.
function snapModalToTopAndAdjustHeight() {
    const hmodal = document.getElementById('highlightModal');
    const noteInput = document.querySelector('.note-input');

    // Calculate available height for the modal
    const maxHeight = window.innerHeight - 180;
    noteInput.style.height = 'auto';

    // Calculate the initial height of the modal based on the input content
    let inputHeight = noteInput.scrollHeight;
    if (inputHeight > maxHeight) {
        inputHeight = maxHeight - 40;
    }

    // Set the height of the note input (and thus the modal)
    noteInput.style.height = `${inputHeight + 5}px`;

    // Check if the input height is greater than 37% of the viewport height
    if (inputHeight > window.innerHeight * 0.37) {
        // Determine the position of the highlight element relative to the document
        const hmodalRect = hmodal.getBoundingClientRect();
        const highlightTopRelativeToDocument = hmodalRect.top + window.scrollY;

        // Calculate the desired scroll position
        const desiredScrollPosition = highlightTopRelativeToDocument - 120;

        // Scroll the document to the calculated position
        window.scrollTo(0, desiredScrollPosition);
    }

    // Ensure the viewport always shows the typing area
    const noteInputRect = noteInput.getBoundingClientRect();
    const distanceFromBottom = window.innerHeight - noteInputRect.bottom;

    if (distanceFromBottom < 40) {
        const hmodalRect = hmodal.getBoundingClientRect();
        const highlightTopRelativeToDocument = hmodalRect.top + window.scrollY;
        const desiredScrollPosition = highlightTopRelativeToDocument - 120;
        window.scrollTo(0, desiredScrollPosition);
    }
}

const hmodal = document.getElementById('highlightModal');
if (hmodal) {
    hmodal.addEventListener('resize', snapModalToTopAndAdjustHeight);
}

function centerHighlightModal(hmodal) {
    const modalWidth = parseInt(hmodal.style.width, 10);
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const leftPosition = (window.innerWidth - modalWidth - (scrollbarWidth * 2.5)) / 2;
    hmodal.style.left = `${leftPosition + window.scrollX}px`;
}

// Initialize the highlight modal when the script loads
initializeHighlightAndNoteModal();

// Event listener to handle keydown events
document.addEventListener('keydown', function (event) {
    const hmodal = document.getElementById('highlightModal');
    const noteInput = document.querySelector('.note-input');
    if (event.key === "Escape" && hmodal.style.display === 'block') {
        hmodal.style.display = 'none';
        hmodal.style.width = '350px'; // Reset modal width to default when closed
        // Remove the .temp-underline class from all spans
        const spans = document.querySelectorAll('span');
        spans.forEach(span => {
            span.classList.remove('temp-underline');
        });
        if (noteInput) {
            if (noteInput.value.trim() === '') {
                const hnid = noteInput.dataset.hnid;
                document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`).forEach(span => {
                    span.classList.remove('note-attached');
                });
            }
            noteInput.style.display = 'none'; // Ensure the note input is also hidden
            noteInput.dataset.hnid = ''; // Clear the dataset.hnid
            noteInput.value = ''; // Clear the note input value
        }
    }
});

// Event listener for keydown events
document.addEventListener('keydown', function (event) {
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const hmodal = document.getElementById('highlightModal');
    const noteInput = document.querySelector('.note-input');
    if (range && !range.collapsed && document.activeElement !== noteInput) {
        switch (event.key.toLowerCase()) {
            case 'n':
                // Trigger the functionality of the .edit-note button
                const editNoteButton = document.querySelector('.edit-note');
                if (editNoteButton) {
                    editNoteButton.click();
                }
                event.preventDefault();
                break;
            case 'y':
                highlightSelection('yellow');
                event.preventDefault();
                break;
            case 'r':
                highlightSelection('pink');
                event.preventDefault();
                break;
            case 'g':
                highlightSelection('green');
                event.preventDefault();
                break;
            case 'b':
                highlightSelection('blue');
                event.preventDefault();
                break;
            case 'p':
                highlightSelection('purple');
                event.preventDefault();
                break;
            case ('w'):
                highlightSelection('white');
                event.preventDefault();
                break;
            default:
                break;
        }
    } else if (hmodal.style.display === 'block' && document.activeElement !== noteInput) {
        switch (event.key) {
            case 'y':
                highlightSelection('yellow');
                event.preventDefault();
                break;
            case 'r':
                highlightSelection('pink');
                event.preventDefault();
                break;
            case 'g':
                highlightSelection('green');
                event.preventDefault();
                break;
            case 'b':
                highlightSelection('blue');
                event.preventDefault();
                break;
            case 'p':
                highlightSelection('purple');
                event.preventDefault();
                break;
            case ('w'):
                highlightSelection('white');
                event.preventDefault();
                break;
            case 'n':
                console.log("case 2");
                const nbutton = document.querySelector('.edit-note');
                const noteInput = document.querySelector('.note-input');
                if (noteInput.style.display === 'none') {
                    nbutton.click();
                }
                selection.removeAllRanges();
                document.activeElement.blur();
                noteInput.focus();
                event.preventDefault();
                break;
            case 'Backspace':
            case 'Delete':
                const deleteHighlightButton = document.querySelector('.delete-circle');
                if (deleteHighlightButton) {
                    deleteHighlightButton.click();
                }
                event.preventDefault();
                break;
            default:
                break;
        }
    }
});

// Event listener for mouseup to trigger highlight modal
document.addEventListener('mouseup', function (event) {
    const selection = window.getSelection();
    const hmodal = document.getElementById('highlightModal');

    // Check if the modal is already displayed or if the selection is empty
    if (selection.toString().length > 0 && hmodal.style.display === 'none') {
        selectedText = selection.getRangeAt(0).cloneRange(); // Preserve the selection
        showHighlightModal(selection);
        ignoreNextClick = true; // Set flag to ignore the next click
        setTimeout(() => { ignoreNextClick = false; }, 200); // Reset the flag after 200ms
    }

    // Re-enable pointer events for color circles (after drag-to-select)
    document.querySelectorAll('.color-circle').forEach(circle => {
        circle.style.pointerEvents = 'auto';
    });
});

// Event listener to handle mousedown events
document.addEventListener('mousedown', function (event) {
    const hmodal = document.getElementById('highlightModal');
    const noteInput = document.querySelector('.note-input');
    const highlightSpan = event.target.closest('.highlight-span');

    if (hmodal?.contains(event.target)) {
        if (noteInput && event.target !== noteInput) {
            event.preventDefault(); // Prevents text from being unselected when clicking inside the modal
        }
    } else {
        hmodal.style.display = 'none';
        hmodal.style.width = '350px'; // Reset modal width to default when closed
        if (noteInput) {
            if (noteInput.value.trim() === '') {
                const hnid = noteInput.dataset.hnid;
                document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`).forEach(span => {
                    span.classList.remove('note-attached');
                });
            }
            noteInput.style.display = 'none'; // Ensure the note input is also hidden
            noteInput.dataset.hnid = ''; // Clear the dataset.hnid
            noteInput.value = ''; // Clear the note input value
        }
    }
});

// Handles case when user starts typing in note without first highlighting.
// Function to handle the click event on the edit-note button
function handleEditNoteClick() {
    const selection = window.getSelection();
    const hmodal = document.getElementById('highlightModal');
    hmodal.style.pointerEvents = 'auto';

    if (selection.rangeCount > 0 && selection.toString().length > 0) {
        if (mostRecentColor == "delete highlight") { mostRecentColor = 'yellow'; }
        highlightSelection(mostRecentColor);

        // Retrieve the newly created hnid from the note input's dataset
        const noteInput = document.querySelector('.note-input');
        const hnid = noteInput.dataset.hnid;

        // Find all the highlight spans that were just created
        const allSpans = document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`);
        let boundingRects = [];

        allSpans.forEach(span => {
            let rect = span.getBoundingClientRect();
            boundingRects.push(rect);
            // Apply the temporary styling
            span.classList.add('temp-underline');
        });

        // Call the showHighlightModalOnHighlightClick function to reopen the modal
        showHighlightModalOnHighlightClick(hnid, boundingRects);

        // Ensure the textarea is displayed and focused
        noteInput.style.display = 'block';
        noteInput.focus();

        // Adjust the modal width to 500px
        hmodal.style.width = '500px';
        centerHighlightModal(hmodal);
    } else {
        console.log("No selection to highlight.");
    }
}

// Attach event listener to the edit-note button
document.querySelector('.edit-note').addEventListener('click', function (event) {
    event.stopPropagation(); // Prevent interference with the click event
    handleEditNoteClick();
});

// Note input grows with height of input, up to max (set in CSS)
let inputHeight = 0;
document.querySelector('.note-input').addEventListener('input', function (event) {
    const noteInput = document.querySelector('.note-input');
    if (inputHeight !== noteInput.scrollHeight) {
        noteInput.style.height = 'auto';
        inputHeight = noteInput.scrollHeight;
        noteInput.style.height = `${inputHeight + 5}px`;

        // Call snapModalToTopAndAdjustHeight to ensure the modal's position is adjusted if needed
        snapModalToTopAndAdjustHeight();
    };
});

// Color-and-note modal snaps when scrolled off bottom.
window.addEventListener('scroll', function () {
    const hmodal = document.getElementById('highlightModal');

    if (hmodal.style.display === 'block') {
        const modalRect = hmodal.getBoundingClientRect();
        const distanceFromBottom = window.innerHeight - modalRect.bottom;

        if (distanceFromBottom < 40) {
            snapModalToTopAndAdjustHeight();
        }
    }
});

// Make highlights clickable; listener added to elements with the class 'highlight-span'.
// For deletion and notes.
document.addEventListener('click', function (event) {
    const highlightSpan = event.target;

    // Ensure the clicked element has the class 'highlight-span'.
    if (highlightSpan.classList.contains('highlight-span')) {
        const hnid = highlightSpan.dataset.hnid;
        const allSpans = document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`);
        let boundingRects = [];

        allSpans.forEach(span => {
            let rect = span.getBoundingClientRect();
            boundingRects.push(rect);
            // Apply the temporary styling
            span.classList.add('temp-underline');
        });

        // Show and place the highlight modal
        showHighlightModalOnHighlightClick(hnid, boundingRects);
    }
});

// Event listener to handle selection changes
document.addEventListener('selectionchange', function () {
    // Don't interfere with functionality of note input
    if (document.activeElement === document.querySelector('.note-input')) return;

    const hmodal = document.getElementById('highlightModal');
    if (!hmodal) return;

    hmodal.style.pointerEvents = 'none'; // Disable pointer events during selection
    // Disable pointer events for color circles during selection
    document.querySelectorAll('.color-circle').forEach(circle => {
        circle.style.pointerEvents = 'none';
    });

    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range && !range.collapsed) {
        const rect = range.getBoundingClientRect();
        const modalWidth = 350; // Assuming max-width is 350px
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const leftPosition = (window.innerWidth - modalWidth - (scrollbarWidth * 2.5)) / 2;

        hmodal.style.top = `${rect.bottom + window.scrollY}px`;
        hmodal.style.left = `${leftPosition + window.scrollX}px`;
        hmodal.style.display = 'block';
    } else {
        hmodal.style.display = 'none'; // Hide the modal if no valid range is
        // Remove the .temp-underline class from all spans
        const spans = document.querySelectorAll('span');
        spans.forEach(span => {
            span.classList.remove('temp-underline');
        });
    }
});

// Event listener to handle window resize events
window.addEventListener('resize', function () {
    const hmodal = document.getElementById('highlightModal');
    centerHighlightModal(hmodal);
});

// Handle changes to the selection and display the highlight modal
function handleSelectionChange() {
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
        const modalWidth = 350; // Assuming max-width is 350px
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const leftPosition = (window.innerWidth - modalWidth - scrollbarWidth) / 2;

        hmodal.style.top = `${rect.bottom + window.scrollY}px`;
        hmodal.style.left = `${leftPosition + window.scrollX}px`;
        hmodal.style.display = 'block';
    } else {
        hmodal.style.display = 'none';
    }
}


// HIGHLIGHT SELECTION AND ADJUSTMENT

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
        window.electronAPI.showAlertDialog("Something went wrong. Either your selection was too large or there was another error. Please try another way.");
        return; // Stop the highlighting process
    }

    let highestHnid = getHighestHnid(); // Get the highest hnid
    let hnid = (highestHnid + 1).toString(); // Increment the highest hnid

    // Store the hnid in the note input's dataset
    const noteInput = document.querySelector('.note-input');
    noteInput.dataset.hnid = hnid;

    // Perform check for deletion if color is hl-delete
    //
    if (color === 'delete highlight') {
        if (!checkForNotesBeforeDelete(range, textNodes)) {
            selection.removeAllRanges();
            const hmodal = document.getElementById('highlightModal');
            if (hmodal) {
                hmodal.style.display = 'block';
                document.activeElement.blur()
                hmodal.focus();
            }
            return false; // User canceled the deletion
        }
    }

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

// Collects all text nodes within the range
function collectTextNodes(range) {
    const textNodes = [];
    const startContainer = range.startContainer;
    let endContainer = range.endContainer;

    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
        textNodes.push(startContainer);
    } else {
        let currentNode = startContainer;
        let endNodeReached = false;

        while (currentNode && !endNodeReached) {
            if (currentNode.nodeType === Node.TEXT_NODE && currentNode.textContent.trim() !== '') {
                textNodes.push(currentNode);
            }
            if (currentNode === endContainer) {
                endNodeReached = true;
            }
            currentNode = nextNode(currentNode);
        }
    }

    // Filter out text nodes that are only whitespace
    return textNodes.filter(node => node.textContent.trim() !== '');
}

// Helper function to collect hnids from text nodes
function collectHnidsFromTextNodes(textNodes) {
    let hnidSet = new Set();
    textNodes.forEach(node => {
        let parentElement = node.parentNode;
        while (parentElement) {
            if (parentElement.classList && parentElement.classList.contains('highlight-span')) {
                let hnid = parentElement.dataset.hnid;
                hnidSet.add(hnid);
                break;
            }
            parentElement = parentElement.parentNode;
        }
    });
    return hnidSet;
}

// Helper function to check for notes, prompt user, and delete notes if confirmed
function checkForNotesBeforeDelete(range, textNodes) {
    let notes = JSON.parse(localStorage.getItem('notes')) || {};
    if (!notes[bookId] || Object.keys(notes[bookId]).length === 0) notes[bookId] = {};
    let spansInRange = [];
    let hnidSet = new Set();

    // Collect spans within the text nodes range
    textNodes.forEach(node => {
        let parentElement = node.parentNode;
        while (parentElement) {
            if (parentElement.classList && parentElement.classList.contains('highlight-span')) {
                spansInRange.push(parentElement);
                hnidSet.add(parentElement.dataset.hnid);
                break;
            }
            parentElement = parentElement.parentNode;
        }
    });

    let notedHnids = [];

    // Check if any of the hnids in the set have attached notes in the notes object
    hnidSet.forEach(hnid => {
        if (notes[bookId] && notes[bookId].hnids && notes[bookId].hnids[hnid]) {
            notedHnids.push(hnid);
        }
    });

    // If there are notes to be deleted, prepare and display the confirmation prompt
    if (notedHnids.length > 0) {
        let promptMessage = '';

        if (notedHnids.length === 1) {
            let noteSnippet = notes[bookId].hnids[notedHnids[0]].substring(0, 100);
            promptMessage = `There is a note attached:\n\n"${noteSnippet}"\n\nDelete?`;
        } else {
            promptMessage = `There are ${notedHnids.length} notes attached:\n\n`;
            notedHnids.forEach(hnid => {
                let noteSnippet = notes[bookId].hnids[hnid].substring(0, 25);
                promptMessage += `→ ${noteSnippet}\n\n`;
            });
            promptMessage += 'Delete ALL notes? Cannot be undone.';
        }

        // Must use an Electron confirm() substitute because the usual one loses focus.
        let userResponse = window.electronAPI.showConfirmDialog(promptMessage);
        console.log("userResponse:", userResponse);
        if (userResponse) {
            // Remove .note-attached class from spans in the DOM
            spansInRange.forEach(span => {
                span.classList.remove('note-attached');
            });

            // Delete notes from localStorage
            notedHnids.forEach(hnid => {
                delete notes[bookId].hnids[hnid];
            });

            // Save the updated notes object to localStorage
            localStorage.setItem('notes', JSON.stringify(notes));
        }
        return userResponse; // Returns true if user confirms, false if user cancels
    }

    return true; // No notes attached or user confirms deletion
}


// Function to handle existing notes before merging
function handleExistingNotesBeforeMerge(newHnid, matchingSpans, color) {
    let hnidSet = new Set();
    let notedHnids = [];
    let combinedNoteContent = '';

    // Traverse up to find existing highlights
    matchingSpans.forEach(span => {
        let parentElement = span.parentNode;
        while (parentElement) {
            if (parentElement.classList && parentElement.classList.contains('highlight-span')) {
                let hnid = parentElement.dataset.hnid;
                hnidSet.add(hnid);
                break;
            }
            parentElement = parentElement.parentNode;
        }
    });

    let notes = JSON.parse(localStorage.getItem('notes')) || {};
    if (!notes[bookId] || Object.keys(notes[bookId]).length === 0) notes[bookId] = {};

    // Check for existing notes and collect them
    hnidSet.forEach(hnid => {
        if (notes[bookId] && notes[bookId].hnids && notes[bookId].hnids[hnid]) {
            notedHnids.push(hnid);
            combinedNoteContent += (notes[bookId].hnids[hnid] + '\n'); // Append notes with a newline for separation
        }
    });

    // If more than one hnid has an associated note, merge the notes
    if (notedHnids.length > 1) {
        window.electronAPI.showAlertDialog("Merged highlights with multiple notes attached. Notes have been combined.");

        // Remove old note records
        notedHnids.forEach(hnid => {
            delete notes[bookId].hnids[hnid];
        });

        // Ensure hnids object exists
        if (!notes[bookId].hnids) {
            notes[bookId].hnids = {};
        }

        // Create new note record with combined content
        notes[bookId].hnids[newHnid] = combinedNoteContent.trim(); // Trim to remove trailing newline
        // Update localStorage
        localStorage.setItem('notes', JSON.stringify(notes));
    } else if (notedHnids.length === 1) {
        const noteContent = notes[bookId].hnids[notedHnids[0]];
        // Delete old note record
        delete notes[bookId].hnids[notedHnids[0]];
        // Ensure hnids object exists
        if (!notes[bookId].hnids) {
            notes[bookId].hnids = {};
        }
        // Create new note record
        notes[bookId].hnids[newHnid] = noteContent;
        // Update localStorage
        localStorage.setItem('notes', JSON.stringify(notes));
    }

    // Return the notedHnid if only one hnid has an associated note, otherwise return null
    return notedHnids.length === 1 ? notedHnids[0] : null;
}

// Change and merge highlight colors (with support for notes)
function handleHighlightMerges(hnid, color) {
    console.log("I be here");
    let matchingSpans = document.querySelectorAll(`.highlight-span[data-hnid='${hnid}']`);

    // Check for existing notes before merging
    let notedHnid = handleExistingNotesBeforeMerge(hnid, matchingSpans, color);

    // To track affected parent elements
    let affectedParents = new Set();

    // Discover and log the enclosing span for each matching span
    matchingSpans.forEach(span => {
        // Initialize the enclosingSpan variable
        let enclosingSpan = null;

        // Traverse up the DOM to find the enclosing .highlight-span
        let parentElement = span.parentNode;
        while (parentElement) {
            if (parentElement.classList && parentElement.classList.contains('highlight-span')) {
                enclosingSpan = parentElement;
                break;
            }
            parentElement = parentElement.parentNode;
        }

        // Identify and add the saveable parent element for the overlapping span
        let overlappingParent = getRelevantParentElement(span);
        if (overlappingParent) {
            affectedParents.add(overlappingParent);
        }

        // If an enclosing span is found, find all adjacent spans with the same hnid
        if (enclosingSpan) {
            let enclosingHnid = enclosingSpan.dataset.hnid;

            // Initialize an array to store all confederate spans
            let confederateSpans = [enclosingSpan];

            // Get all spans with the same hnid as the enclosing span
            let allSpansWithSameHnid = document.querySelectorAll(`.highlight-span[data-hnid='${enclosingHnid}']`);

            allSpansWithSameHnid.forEach(confederateSpan => {
                // Ensure we don't include the same enclosing span twice
                if (confederateSpan !== enclosingSpan) {
                    confederateSpans.push(confederateSpan);
                }
            });

            // Remove the inner spans
            while (span.firstChild) {
                enclosingSpan.insertBefore(span.firstChild, span);
            }
            span.remove();

            // Assign the new hnid and color to the confederate spans
            confederateSpans.forEach(confederateSpan => {
                confederateSpan.dataset.hnid = hnid;
                confederateSpan.className = `highlight-span hl-${color}`;

                // Add .note-attached class if the notedHnid matches
                if (notedHnid) {
                    confederateSpan.classList.add('note-attached');
                }

                // Identify and add the saveable parent element for each confederate span
                let saveableParent = getRelevantParentElement(confederateSpan);
                if (saveableParent) {
                    affectedParents.add(saveableParent);
                }
            });
        }
    });

    // Submit to saveHighlightsToLocalStorage
    affectedParents.forEach(parentElement => {
        saveHighlightsToLocalStorage(parentElement);
        deleteMarkedHighlights(parentElement);
    });
}

// Function to delete a highlight
function deleteMarkedHighlights(parentElement) {
    if (!parentElement) return; // Ensure parentElement is valid

    // Find and remove hl-delete spans
    let deleteSpans = parentElement.querySelectorAll('.hl-delete');
    deleteSpans.forEach(span => {
        let parent = span.parentNode;
        while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
    });

    // Find the suitable pid ancestor element for the current element
    let pidElement = parentElement.closest('[id^="p"]');
    if (!pidElement) {
        console.warn("No suitable pid ancestor found for the current element.");
        return;
    }
    let pid = pidElement.id;

    // Update the highlights object
    let highlights = JSON.parse(localStorage.getItem('highlights')) || {};
    if (!highlights[bookId] || Object.keys(highlights[bookId]).length === 0) highlights[bookId] = {};

    if (!highlights[bookId] || !highlights[bookId][pid]) {
        console.warn("No highlights found for the given pid.");
        return;
    }

    // Process the element to update highlightedHTML and hnids
    let cleanedElement = parentElement.cloneNode(true);
    stripHighlightSpans(cleanedElement);
    let cleanedHTML = cleanedElement.outerHTML;
    let originalHTML = parentElement.outerHTML;

    highlights[bookId][pid].cleanedHTML = cleanedHTML;
    highlights[bookId][pid].highlightedHTML = originalHTML;

    let currentHnids = Array.from(parentElement.querySelectorAll('.highlight-span'))
        .map(span => span.getAttribute('data-hnid'));

    highlights[bookId][pid].hnids = Array.from(new Set(currentHnids));
    highlights[bookId][pid].hnids = highlights[bookId][pid].hnids.map(hnid => parseInt(hnid));

    // Delete the pid if hnids array is empty
    if (highlights[bookId][pid].hnids.length === 0) {
        delete highlights[bookId][pid];
    }

    // If there are no remaining pids for this bookId, delete the bookId entry
    if (Object.keys(highlights[bookId]).length === 0) {
        delete highlights[bookId];
    }

    // Save the updated highlights object to localStorage
    localStorage.setItem('highlights', JSON.stringify(highlights));
}

// Get the highest hnid value from the localStorage highlights
function getHighestHnid() {
    let highlights = JSON.parse(localStorage.getItem('highlights')) || {};
    if (!highlights[bookId] || Object.keys(highlights[bookId]).length === 0) highlights[bookId] = {};
    let highestHnid = -1;

    Object.keys(highlights).forEach(bookId => {
        Object.keys(highlights[bookId]).forEach(pid => {
            let hnids = highlights[bookId][pid].hnids;
            if (Array.isArray(hnids)) { // Check if hnids is an array
                hnids.forEach(hnid => {
                    let numericHnid = parseInt(hnid);
                    if (!isNaN(numericHnid) && numericHnid > highestHnid) {
                        highestHnid = numericHnid;
                    }
                });
            } else {
                console.warn("hnid is not an array");
            }
        });
    });

    return highestHnid;
}

// Adjust the range offsets to ensure whole words are highlighted
function adjustRangeOffsets(range) {
    let startContainer = range.startContainer;
    let endContainer = range.endContainer;
    let startOffset = range.startOffset;
    let endOffset = range.endOffset;

    // Adjust the start offset to include whole words
    if (startContainer.nodeType === Node.TEXT_NODE) {
        while (startOffset > 0 && !/\s/.test(startContainer.textContent[startOffset - 1])) {
            startOffset--;
        }
    }

    // Adjust the end offset to include whole words
    if (endContainer.nodeType === Node.TEXT_NODE) {
        while (endOffset < endContainer.textContent.length && !/\s/.test(endContainer.textContent[endOffset])) {
            endOffset++;
        }
    }

    // Check if the endOffset is 0 and adjust the endContainer accordingly
    if (endOffset === 0 && startContainer !== endContainer) {
        // Navigate to the previous text node if endContainer is a whitespace text node
        let newEndContainer = findPreviousTextNode(endContainer);

        if (newEndContainer) {
            endContainer = newEndContainer;
            endOffset = endContainer.textContent.length;
        } else {
            console.error("Failed to adjust range: no valid previous text node found.");
        }
    }

    // Set the adjusted range
    try {
        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
    } catch (error) {
        console.error("Error setting range end:", error);
    }
}

// Find the previous non-empty text node from the given node
function findPreviousTextNode(node) {
    if (!node) return null;

    // Check previous siblings
    if (node.previousSibling) {
        let prevSibling = node.previousSibling;
        while (prevSibling) {
            let lastNonEmptyTextNode = findLastNonEmptyTextNode(prevSibling);
            if (lastNonEmptyTextNode) {
                return lastNonEmptyTextNode;
            }
            prevSibling = prevSibling.previousSibling;
        }
    }

    // Check parent nodes
    return findPreviousTextNode(node.parentNode);
}

// Find the last non-empty text node within a given node
function findLastNonEmptyTextNode(node) {
    if (node.nodeType === Node.TEXT_NODE && /\w/.test(node.textContent)) {
        return node;
    }

    // Recursively search child nodes in reverse order
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
        let childNode = node.childNodes[i];
        let result = findLastNonEmptyTextNode(childNode);
        if (result) {
            return result;
        }
    }

    return null;
}

// Helper function to get the next node in the DOM
function nextNode(node) {
    if (node.firstChild) {
        return node.firstChild;
    }
    while (node) {
        if (node.nextSibling) {
            return node.nextSibling;
        }
        node = node.parentNode;
    }
    return null;
}


// APPLY HIGHLIGHTS TO DOM (create highlight spans, etc.)

// Highlights the text nodes within the given range with the specified color and hnid
function highlightTextNodes(textNodes, range, color, hnid) {
    if (textNodes.length === 1) {
        highlightSingleTextNode(textNodes[0], range, color, hnid);
    } else if (textNodes.length > 1) {
        highlightMultipleTextNodes(textNodes, range, color, hnid);
    }
}

// Highlights a single text node within the range with the specified color and hnid
function highlightSingleTextNode(node, range, color, hnid) {
    const text = node.textContent;
    const before = text.slice(0, range.startOffset);
    const highlight = text.slice(range.startOffset, range.endOffset);
    const after = text.slice(range.endOffset);

    const wrapper = createSpanWrapper(color, hnid);

    // Special handling for edge cases
    if (highlight === '' && range.startOffset === 0 && range.endOffset === 0) {
        wrapper.textContent = text;
    } else {
        wrapper.textContent = highlight;
    }

    const parent = node.parentNode;
    const referenceNode = node.nextSibling;

    parent.removeChild(node);
    if (before) {
        parent.insertBefore(document.createTextNode(before), referenceNode);
    }
    parent.insertBefore(wrapper, referenceNode);
    if (after && highlight !== '') {
        parent.insertBefore(document.createTextNode(after), referenceNode);
    }

    // Save to localStorage
    saveHighlightsToLocalStorage(parent);
}

// Highlights multiple text nodes within the range with the specified color and hnid
function highlightMultipleTextNodes(textNodes, range, color, hnid) {
    let allParentElements = new Set();
    textNodes.forEach(textNode => {
        allParentElements.add(getRelevantParentElement(textNode));
    });

    const startNode = textNodes[0];
    const endNode = textNodes[textNodes.length - 1];
    let usedHnids = [];

    const startText = startNode.textContent;
    const startBefore = startText.slice(0, range.startOffset);
    const startHighlight = startText.slice(range.startOffset);

    let endText = endNode.textContent;
    let endHighlight, endAfter;

    // If the end offset is at the very end of the end node, include the entire node
    if (range.endOffset >= endNode.textContent.length) {
        endHighlight = endText;
        endAfter = '';
    } else {
        endHighlight = endText.slice(0, range.endOffset);
        endAfter = endText.slice(range.endOffset);
    }

    const startWrapper = createSpanWrapper(color, hnid);
    startWrapper.textContent = startHighlight;

    const endWrapper = createSpanWrapper(color, hnid);
    endWrapper.textContent = endHighlight;

    const startParent = startNode.parentNode;
    const startAfterNode = document.createTextNode(startBefore);
    startParent.replaceChild(startAfterNode, startNode);
    startParent.insertBefore(startWrapper, startAfterNode.nextSibling);
    usedHnids.push(hnid);

    const endParent = endNode.parentNode;
    const endAfterNode = document.createTextNode(endAfter);
    endParent.replaceChild(endAfterNode, endNode);
    endParent.insertBefore(endWrapper, endAfterNode);
    usedHnids.push(hnid);

    if (textNodes.length > 2) {
        const interveningNodes = textNodes.slice(1, -1);
        interveningNodes.forEach(node => {
            if (node.textContent.trim() !== '') {
                const wrapper = createSpanWrapper(color, hnid);
                wrapper.textContent = node.textContent;
                node.parentNode.replaceChild(wrapper, node);
                usedHnids.push(hnid);
            }
        });
    }

    allParentElements.forEach(parentElement => {
        saveHighlightsToLocalStorage(parentElement);
    });
}

// Get the relevant parent element from the given node
function getRelevantParentElement(node) {
    const relevantTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'tr', 'figcaption', 'aside', 'address', 'details', 'summary'];
    while (node && node.nodeType !== Node.DOCUMENT_NODE) {
        if (node.tagName && relevantTags.includes(node.tagName.toLowerCase())) {
            return node;
        }
        node = node.parentNode;
    }
    console.warn("No relevant parent element found.");
    return null;
}

// Creates a span wrapper with the specified color and hnid
function createSpanWrapper(color, hnid) {
    const spanWrapper = document.createElement('span');
    spanWrapper.className = `highlight-span hl-${color}`;
    spanWrapper.dataset.hnid = hnid;
    return spanWrapper;
}



// REAPPLY HIGHLIGHTS (apply saved highlights when loading page)

// Function to reapply highlights and notes
function reapplyHighlightsNotes() {
    const startTime = performance.now();
    let highlights = JSON.parse(localStorage.getItem('highlights')) || {};
    console.log("highlights 1a:", highlights);
    if (!highlights[bookId] || Object.keys(highlights[bookId]).length === 0) highlights[bookId] = {};

    if (!highlights[bookId]) {
        console.warn("No highlights found for this book.");
        return;
    }

    Object.keys(highlights[bookId]).forEach(pid => {
        let { cleanedHTML, highlightedHTML } = highlights[bookId][pid];

        // Construct regex to match cleanedHTML
        let regex = new RegExp(cleanedHTML.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

        // Get the pid div element
        let pidElement = document.getElementById(pid);
        if (!pidElement) {
            return;
        }

        // Replace content within pid div element
        pidElement.innerHTML = pidElement.innerHTML.replace(regex, highlightedHTML);

        // Re-add onclick functionality to bookmark-icon in the current pidElement
        const bookmarkIcon = pidElement.querySelector('.bookmark-icon');
        if (bookmarkIcon) {
            const paragraphIndex = bookmarkIcon.id.split('-')[1];
            bookmarkIcon.setAttribute('onclick', `toggleBookmark(${paragraphIndex})`);
        }
    });
    console.log("highlights 1b:", highlights);

    // Apply .note-attached class to spans with notes
    let notes = JSON.parse(localStorage.getItem('notes')) || {};
    console.log("notes 1a:", notes);
    if (!notes[bookId] || Object.keys(notes[bookId]).length === 0) notes[bookId] = {};
    if (notes[bookId] && notes[bookId].hnids) {
        Object.keys(notes[bookId].hnids).forEach(hnid => {
            document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`).forEach(span => {
                span.classList.add('note-attached');
            });
        });
    }

    const endTime = performance.now();
    console.log("notes 1b:", notes);
}

// Add or update an element in highlights
function saveHighlightsToLocalStorage(rootElement) {
    if (!rootElement) return; // Ensure rootElement is valid

    let highlights = JSON.parse(localStorage.getItem('highlights')) || {};
    if (!highlights[bookId] || Object.keys(highlights[bookId]).length === 0) highlights[bookId] = {};

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

// Helper function to strip highlight spans from an element
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

// Function to save highlights and notes data on navigation away/app close
function saveHlnotesDataOnNavigationAway() {
    const highlights = JSON.parse(localStorage.getItem('highlights')) || {};
    if (!highlights[bookId] || Object.keys(highlights[bookId]).length === 0) highlights[bookId] = {};
    const notes = JSON.parse(localStorage.getItem('notes')) || {};
    if (!notes[bookId] || Object.keys(notes[bookId]).length === 0) notes[bookId] = {};
    const data = { highlights, notes };

    // Check if data is empty and hlnotesDataFound is true
    if (hlnotesDataFound && (!data.highlights || !data.highlights[bookId] || Object.keys(data.highlights[bookId]).length === 0) && (!data.notes || !data.notes[bookId] || Object.keys(data.notes[bookId]).length === 0 || Object.keys(data.notes[bookId]['hnids']).length === 0)) {
        const confirmMessage = "WARNING: We found highlights and/or notes when opening this book, but now we find none. We can recover the old notes or highlights, or delete them.\n\nShould we delete this data?";
        const userConfirmed = window.electronAPI.showConfirmDialog(confirmMessage);
        if (!userConfirmed) {
            console.log('User chose not to delete the data. Halting save operation.');
            return;
        }
    }

    window.electronAPI.saveHlnotesData(currentBookId, data);
}

setTimeout(() => {
    if (fullLoadingApproved) {
        // Add event listener for navigation away/app close
        window.addEventListener('beforeunload', saveHlnotesDataOnNavigationAway);
    }
}, 500);

// EDIT NOTES

let debounceTimer;
let lastSavedTime = Date.now();
let isSaving = false;
let lastNoteContent = '';
let typingTimer;
let lastSavedNote = '';

function autosaveNote() {
    const noteInput = document.querySelector('.note-input');
    if (!noteInput) return;

    const currentNote = noteInput.value.trim();
    let hnid = noteInput.dataset.hnid;
    if (!hnid) {
        console.error("No hnid found in dataset.");
        return;
    }

    const notes = JSON.parse(localStorage.getItem('notes')) || {};
    if (!notes[bookId] || Object.keys(notes[bookId]).length === 0) notes[bookId] = {};
    if (!notes[bookId]) notes[bookId] = {};
    if (!notes[bookId].hnids) notes[bookId].hnids = {};

    if (currentNote === "" || /^\s*$/.test(currentNote)) {
        // Delete the note if it is empty
        if (notes[bookId].hnids[hnid]) {
            delete notes[bookId].hnids[hnid];
        }
    } else {
        // Save the note if it is not empty
        notes[bookId].hnids[hnid] = currentNote;
    }

    // Check if there are any remaining notes for the bookId
    if (Object.keys(notes[bookId].hnids).length === 0) {
        delete notes[bookId];
    }

    localStorage.setItem('notes', JSON.stringify(notes));
    lastSavedNote = currentNote;

    const savingIndicator = document.querySelector('.saving-indicator');
    if (savingIndicator) {
        savingIndicator.textContent = 'Saved.';
        savingIndicator.style.display = 'block';
    }

    // Apply or remove .note-attached class to relevant spans
    if (currentNote !== '') {
        document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`).forEach(span => {
            span.classList.add('note-attached');
        });
    } else {
        document.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`).forEach(span => {
            span.classList.remove('note-attached');
        });
    }
}

// Start autosaving notes as soon as visible
const noteInput = document.querySelector('.note-input');
if (noteInput) {
    noteInput.addEventListener('input', function () {
        if (isElementVisible(noteInput)) {
            autosaveNote();
        }
    });
}



/////////////////////////////////
// BIG NOTES AND HIGHLIGHT MODAL

// Function to initialize the modal
function initializeHighlightsNotesModal() {
    let modal = document.getElementById('hn-highlightsNotesModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'hn-highlightsNotesModal';
        modal.className = 'hn-highlights-notes-modal';
        modal.innerHTML = `
            <span class="hn-close-btn" onclick="closeHighlightsNotesModal()">×</span>
            <div class="hn-tabs">
                <button class="hn-tab" onclick="switchTab('highlights')">Highlights</button>
                <button class="hn-tab" onclick="switchTab('notes')">Notes</button>
                <span id="copyText"><a href="#">Copy Text</a></span>
            </div>
            <div class="hn-tab-content-container">
                <div id="highlights" class="hn-tab-content">
                    <p>Loading highlights...</p>
                </div>
                <div id="notes" class="hn-tab-content">
                    <p>Loading notes...</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Event listener to handle the click on "Copy to Clipboard" link
        document.getElementById('copyText').addEventListener('click', function(event) {
            event.preventDefault();
            copyTabContent();
        });
    }

    // Add an event listener to the document to close the modal when clicking outside
    document.addEventListener('click', function (event) {
        if (modal.style.display === 'block' && !modal.contains(event.target)) {
            closeHighlightsNotesModal();
        }
    });

    // Add an event listener to the modal to stop propagation
    modal.addEventListener('click', function (event) {
        event.stopPropagation();
    });

    // Add an event listener for the Esc key to close the modal
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeHighlightsNotesModal();
        }
    });

    // Load the content for the initially selected tab
    const activeTab = localStorage.getItem('activeTab') || 'highlights';
    switchTab(activeTab);
}

// Copies content of hlnotes modal to clipboard
function copyTabContent() {
    const activeTab = localStorage.getItem('activeTab');
    let contentToCopy;
    let header;

    if (activeTab === 'highlights') {
        contentToCopy = document.getElementById('highlights').innerHTML;
        header = `<h2>Highlights: <br>${currentBookMetadata.Title}</h2><h4 style="text-align: left;">By ${currentBookMetadata.CreatorNames[0]}</h4><br>`;
    } else if (activeTab === 'notes') {
        contentToCopy = document.getElementById('notes').innerHTML;
        header = `<h2>Notes: <br>${currentBookMetadata.Title}</h2><h4 style="text-align: left;">By ${currentBookMetadata.CreatorNames[0]}</h4><br>`;
    } else {
        console.error('Unknown tab type.');
        return;
    }

    // Create a temporary container to hold the content
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = header + contentToCopy;

    // Remove elements with class 'curly-left' and 'curly-right'
    tempContainer.querySelectorAll('.curly-left, .curly-right').forEach(el => el.remove());

    // Add an extra <p> </p> after each .note-container
    tempContainer.querySelectorAll('.note-container').forEach(el => {
        const p = document.createElement('p');
        p.innerHTML = ' ';
        el.insertAdjacentElement('afterend', p);
    });

    // Replace <div class="hn-highlight-separator"></div> with <p> </p>
    tempContainer.querySelectorAll('.hn-highlight-separator').forEach(el => {
        const p = document.createElement('p');
        p.innerHTML = '--------------------';
        el.replaceWith(p);
    });

    // Prevent the issue with justified text when copying
    tempContainer.innerHTML = tempContainer.innerHTML.replace(/<br>\n?<br>/g, '<p> </p>');

    // Temporarily append to the body to perform the copy operation
    document.body.appendChild(tempContainer);

    // Copy to clipboard
    const range = document.createRange();
    range.selectNodeContents(tempContainer);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
        document.execCommand('copy');
        alert('Content copied to clipboard.');
    } catch (err) {
        console.error('Failed to copy content:', err);
    }

    selection.removeAllRanges(); // Clear the selection

    // Remove the temporary container from the DOM
    document.body.removeChild(tempContainer);
}

// Function to open the highlights and notes modal
function openHighlightsNotesModal(event) {
    document.body.classList.add('no-scroll'); // Disable background scrolling
    event.preventDefault(); // Prevent the default link behavior
    event.stopPropagation(); // Prevent the click event from propagating to the document level
    const modal = document.getElementById('hn-highlightsNotesModal');
    modal.style.display = 'block';
    const greyLine = document.getElementById('grey-line');
    greyLine.style.display = 'block';
    // Adjust grey line width based on zoom factor
    const originalWidth = parseFloat(getComputedStyle(greyLine).width); // Fetch the current width from CSS
    const zoomFactor = window.electronAPI.getZoomFactor();
    greyLine.style.width = `${15.5 / zoomFactor}px`;
    document.getElementById('header').style.width = `calc(100% - ${15.5 / zoomFactor}px)`;
    document.body.style.paddingRight = `${15.5 / zoomFactor}px`;

    // Clear existing content
    document.getElementById('highlights').innerHTML = '';
    document.getElementById('notes').innerHTML = '';

    // Repopulate based on the active tab
    const activeTab = localStorage.getItem('activeTab') || 'highlights';
    switchTab(activeTab);
    switch (activeTab) {
        case 'highlights':
            populateHighlightsTab();
            break;
        case 'notes':
            populateNotesTab();
            break;
        default:
            populateHighlightsTab();
    }
}

// Function to close the highlights and notes modal
function closeHighlightsNotesModal() {
    const modal = document.getElementById('hn-highlightsNotesModal');
    modal.style.display = 'none';
    document.body.classList.remove('no-scroll'); // Enable background scrolling
    document.body.classList.remove('modal-open'); // Remove padding adjustment
    const greyLine = document.getElementById('grey-line');
    greyLine.style.display = 'none';
    document.body.style.paddingRight = '0px';
    document.getElementById('header').style.width = "100%";
}

// Event listener to open the modal
document.getElementById('highlightsNotesBtn').addEventListener('click', openHighlightsNotesModal);

// Function to switch between tabs
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.hn-tab');
    const tabContents = document.querySelectorAll('.hn-tab-content');

    tabs.forEach(tab => {
        tab.classList.remove('active');
    });

    tabContents.forEach(content => {
        content.style.display = 'none';
    });

    document.querySelector(`.hn-tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).style.display = 'block';

    // Save the active tab to local storage
    localStorage.setItem('activeTab', tabName);

    // Populate the active tab content
    switch (tabName) {
        case 'highlights':
            populateHighlightsTab();
            break;
        case 'notes':
            populateNotesTab();
            break;
    }
}

// Helper function to clean HTML that goes in the highlight tab
function cleanHighlightedHTML(html) {
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Function to recursively process nodes
    function processNode(node, topLevelElement) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
            // If it's a text node not inside a highlight span
            if (!node.parentElement.classList.contains('highlight-span')) {
                if (node.parentElement === topLevelElement) {
                    // If the parent element is the top-level element, replace it with "..."
                    let placeholder = document.createTextNode(" ... ");
                    node.replaceWith(placeholder);
                } else {
                    // Otherwise, replace the parent element with "..."
                    let placeholder = document.createTextNode(" ... ");
                    node.parentElement.replaceWith(placeholder);
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            Array.from(node.childNodes).forEach(childNode => processNode(childNode, topLevelElement));
        }
    }

    // Process nodes to replace non-highlighted text nodes with "..."
    Array.from(tempDiv.childNodes).forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            processNode(node, node);
        }
    });

    // Function to clean up multiple "..." into a single "..."
    function cleanEllipses(node) {
        let textContent = node.innerHTML;
        node.innerHTML = textContent.replace(/(\s*\.\.\.\s*){2,}/g, ' ... ');
    }

    // Clean up ellipses in the processed HTML
    cleanEllipses(tempDiv);

    // Function to remove unwanted classes from any element
    function cleanHighlightSpans(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            node.classList.remove('hl-yellow', 'hl-pink', 'hl-green', 'hl-blue', 'hl-purple');
            node.classList.remove('note-attached');
            Array.from(node.childNodes).forEach(childNode => cleanHighlightSpans(childNode));
        }
    }

    // Clean highlight spans
    cleanHighlightSpans(tempDiv);

    return tempDiv.innerHTML;
}


// Function to populate the Highlights tab
function populateHighlightsTab() {
    try {
        const highlightsData = localStorage.getItem('highlights');
        if (!highlightsData || !JSON.parse(highlightsData)[bookId] || Object.keys(JSON.parse(highlightsData)[bookId]).length === 0) {
            document.getElementById('highlights').innerHTML = '<p class="no-data-message">No highlights yet. To add a highlight, select some text and click the color you want.</p>';
            return;
        }

        const highlights = JSON.parse(highlightsData);
        const bookHighlights = highlights[bookId];
        if (!bookHighlights) {
            document.getElementById('highlights').innerHTML = '<p class="no-data-message">No highlights yet. To add a highlight, select some text and click the color you want.</p>';
            return;
        }

        let highlightsHTML = '';
        const orderedPids = Object.keys(bookHighlights).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        let previousPid = null;

        orderedPids.forEach(pid => {
            const highlight = bookHighlights[pid];
            let cleanedHTML = cleanHighlightedHTML(highlight.highlightedHTML);

            // Check if the current pid is consecutive to the previous pid
            if (previousPid !== null && parseInt(pid.slice(1)) !== parseInt(previousPid.slice(1)) + 1) {
                highlightsHTML += `<div class="hn-highlight-separator"></div>`;
            }

            // Wrap each pid's content in a div to maintain block structure and make it clickable
            highlightsHTML += `<div class="highlight-item" data-pid="${pid}">${cleanedHTML}</div>`;
            previousPid = pid;
        });

        document.getElementById('highlights').innerHTML = highlightsHTML;

        // Add click event listeners to each highlight item
        document.querySelectorAll('.highlight-item').forEach(item => {
            item.addEventListener('click', function () {
                const pid = this.getAttribute('data-pid');
                window.location.hash = `#${pid}`;
                closeHighlightsNotesModal();

                // Scroll adjustment
                setTimeout(() => {
                    const targetElement = document.getElementById(pid);
                    if (targetElement) {
                        const offset = 100;
                        const elementPosition = targetElement.getBoundingClientRect().top;
                        const offsetPosition = elementPosition - offset;
                        window.scrollBy({ top: offsetPosition });
                    }
                }, 100); // Delay to ensure the page navigates to the correct section
            });
        });

    } catch (error) {
        console.error('Error populating highlights tab:', error);
        document.getElementById('highlights').innerHTML = '<p class="no-data-message">Error loading highlights.</p>';
    }
}

// Function to render Markdown to HTML, and make necessary changes to user-input HTML
function renderMarkdownAndFixHTML(markdownText) {
    // Convert headings
    markdownText = markdownText.replace(/^### (.+$)/gim, '<h3 class="md-h3">$1</h3>');
    markdownText = markdownText.replace(/^## (.+$)/gim, '<h2 class="md-h2">$1</h2>');
    markdownText = markdownText.replace(/^# (.+$)/gim, '<h1 class="md-h1">$1</h1>');

    // Convert bold text
    markdownText = markdownText.replace(/\*\*(?=\S)([^\*]*?\S)\*\*/gim, '<strong>$1</strong>');

    // Convert italic text
    markdownText = markdownText.replace(/\*(?=\S)([^\*]*?\S)\*/gim, '<i>$1</i>');

    // Convert blockquotes
    markdownText = markdownText.replace(/^\> (.+$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');

    // Convert ordered lists
    markdownText = markdownText.replace(/^\d+\.\s(.*$)/gim, '<li class="md-li">$1</li>');
    markdownText = markdownText.replace(/(<li class="md-li">.*<\/li>)/gim, '<ol class="md-ol">$1</ol>');

    // Convert unordered lists
    markdownText = markdownText.replace(/^\-\s(.+$)/gim, '<li class="md-li">$1</li>');
    markdownText = markdownText.replace(/(<li class="md-li">.*<\/li>)/gim, '<ul class="md-ul">$1</ul>');

    // Convert inline code
    markdownText = markdownText.replace(/\`(.+)\`/gim, '<code class="md-code">$1</code>');

    // Convert horizontal rules
    markdownText = markdownText.replace(/^\-\-\-$/gim, '<hr class="md-hr">');

    // Convert line breaks to <br> between word characters
    markdownText = markdownText.replace(/\n\n/gim, '<br><br>');
    markdownText = markdownText.replace(/([\w!"?,"-.:\];])\n/gim, '$1<br>');

    // Create a temporary element to hold the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = markdownText.trim();

    // Add target="_new" to all links
    const links = tempDiv.querySelectorAll('a');
    links.forEach(link => {
        link.setAttribute('target', '_new');
    });

    return tempDiv.innerHTML; // Return the modified HTML
}

// Function to clean paragraphs by removing spans that do not match the current hnid
function cleanParagraphByHnid(html, hnid) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const spans = tempDiv.querySelectorAll(`.highlight-span`);
    spans.forEach(span => {
        if (span.getAttribute('data-hnid') !== hnid) {
            span.replaceWith(document.createTextNode(' ... '));
        }
    });

    // Iteratively remove empty elements, including those that are just " ... "
    function removeEmptyElements(node) {
        const elements = node.querySelectorAll('*');
        elements.forEach(element => {
            if (element.textContent.trim() === '...') {
                element.remove();
            }
        });

        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(childNode => {
            if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent.trim() === '...') {
                childNode.remove();
            }
        });
    }

    removeEmptyElements(tempDiv);

    // Function to clean up multiple " ... " into a single " ... "
    function cleanEllipses(node) {
        let textContent = node.innerHTML;
        node.innerHTML = textContent.replace(/(\s*\.\.\.\s*){2,}/g, ' ... ');
    }

    cleanEllipses(tempDiv);

    return tempDiv.innerHTML;
}

function createHanContainer(hnid, hnidSpans, noteContent) {
    // Create a container for the highlights (pids)
    const highlightContainer = document.createElement('div');
    highlightContainer.classList.add('highlight-container');
    hnidSpans.forEach(({ html, colorClass }) => {
        const paragraphDiv = document.createElement('div');
        paragraphDiv.classList.add('highlight-paragraph'); // Add class for styling

        // Modify the inner HTML to include the curly quotes
        const modifiedHtml = `<span class="curly-left">&#8220;</span>${html}<span class="curly-right">&#8221;</span>`;
        paragraphDiv.innerHTML = modifiedHtml;

        // Add the color class for the border lines
        switch (colorClass) {
            case 'hl-yellow':
                paragraphDiv.classList.add('border-yellow');
                break;
            case 'hl-pink':
                paragraphDiv.classList.add('border-pink');
                break;
            case 'hl-green':
                paragraphDiv.classList.add('border-green');
                break;
            case 'hl-blue':
                paragraphDiv.classList.add('border-blue');
                break;
            case 'hl-purple':
                paragraphDiv.classList.add('border-purple');
                break;
            default:
                console.warn('No matching color class found for:', colorClass);
                break;
        }
        highlightContainer.appendChild(paragraphDiv);
    });

    const noteContainer = document.createElement('div');
    noteContainer.classList.add('note-container');

    // Render the note content using Markdown
    const renderedNoteContent = renderMarkdownAndFixHTML(noteContent);
    noteContainer.innerHTML = `${renderedNoteContent}<p>&nbsp;</p>`;

    // Combine the highlight and note containers into a 'han' container
    const hanContainer = document.createElement('div');
    hanContainer.classList.add('han-container', 'highlight-item'); // Added 'highlight-item' class for consistency
    hanContainer.setAttribute('data-pid', hnidSpans[0]?.pid);
    hanContainer.appendChild(highlightContainer);
    hanContainer.appendChild(noteContainer);

    // Simplify the event listener to just log the click
    hanContainer.addEventListener('click', function (event) {
        event.stopPropagation(); // Ensure the event doesn't propagate further
        const pid = hanContainer.getAttribute('data-pid');
        console.log(`Clicked han with pid: ${pid}`);
    });

    return hanContainer.outerHTML;
}

// Function to populate the Notes tab
function populateNotesTab() {
    try {
        const notesData = localStorage.getItem('notes');
        console.log("notesData 3a:", notesData);
        if (!notesData) {
            document.getElementById('notes').innerHTML = '<p class="no-data-message">No notes yet. To add a note, select some text and click the note icon.</p>';
            return;
        }

        const parsedNotesData = JSON.parse(notesData);
        const bookNotes = parsedNotesData[bookId];

        if (!bookNotes || Object.keys(bookNotes).length === 0 || (bookNotes.hnids && Object.keys(bookNotes.hnids).length === 0)) {
            document.getElementById('notes').innerHTML = '<p class="no-data-message">No notes yet. To add a note, select some text and click the note icon.</p>';
            return;
        }

        // Fetch highlighted spans corresponding to each hnid
        const highlightsData = localStorage.getItem('highlights');
        const highlights = highlightsData ? JSON.parse(highlightsData)[bookId] : {};

        let hans = [];

        for (const hnid in bookNotes.hnids) {
            const hnidSpans = [];
            const pidsSet = new Set();

            for (const pid in highlights) {
                const highlight = highlights[pid];

                // Extract the color class before cleaning
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = highlight.highlightedHTML;
                const spans = tempDiv.querySelectorAll(`.highlight-span[data-hnid="${hnid}"]`);
                if (spans.length > 0) {
                    const colorClass = [...spans[0].classList].find(cls => cls.startsWith('hl-'));

                    pidsSet.add(pid);
                    let cleanedHTML = cleanHighlightedHTML(tempDiv.innerHTML);
                    const cleanedParagraph = cleanParagraphByHnid(cleanedHTML, hnid);
                    hnidSpans.push({ pid: pid, html: cleanedParagraph, colorClass });
                }
            }

            const hanHTML = createHanContainer(hnid, hnidSpans, bookNotes.hnids[hnid]);

            // Produce the 'han' container and add it to the hans array
            hans.push({
                hnid,
                html: hanHTML,
                firstPid: Math.min(...Array.from(pidsSet).map(pid => parseInt(pid.slice(1))))
            });
        }

        // Sort the hans by firstPid
        hans.sort((a, b) => a.firstPid - b.firstPid);

        // Display the combined highlights and notes in the notes tab with horizontal separators
        document.getElementById('notes').innerHTML = hans.map(han => `<div>${han.html}</div><div class="hn-highlight-separator"></div>`).join('');

        // Attach event listeners to the han containers; permits dragging/selection.
        document.querySelectorAll('.han-container').forEach(hanContainer => {
            const pid = hanContainer.getAttribute('data-pid');
            let isDragging = false;
            let startX, startY;

            hanContainer.addEventListener('mousedown', function (e) {
                isDragging = false;
                startX = e.clientX;
                startY = e.clientY;
            });

            hanContainer.addEventListener('mousemove', function (e) {
                if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
                    isDragging = true;
                }
            });

            hanContainer.addEventListener('mouseup', function (e) {
                if (!isDragging) {
                    console.log(`Clicked han with pid: ${pid}`);
                    window.location.hash = `#${pid}`;
                    closeHighlightsNotesModal();

                    // Scroll adjustment
                    setTimeout(() => {
                        const targetElement = document.getElementById(pid);
                        if (targetElement) {
                            const offset = 100;
                            const elementPosition = targetElement.getBoundingClientRect().top;
                            const offsetPosition = elementPosition - offset;
                            window.scrollBy({ top: offsetPosition });
                        }
                    }, 100); // Delay to ensure the page navigates to the correct section
                }
            });
        });

    } catch (error) {
        console.error('Error populating notes tab:', error);
        document.getElementById('notes').innerHTML = '<p class="no-data-message">Error loading notes.</p>';
    }
    console.log("notesData 3b:", notesData);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize the modal when the script loads
    initializeHighlightsNotesModal();

    // Call this function when switching to the Highlights tab
    document.querySelector('.hn-tab[onclick="switchTab(\'highlights\')"]').addEventListener('click', populateHighlightsTab);


    // Event listener to close modal when clicking outside of it
    document.addEventListener('click', function (event) {
        const modal = document.getElementById('hn-highlightsNotesModal');
        if (event.target.matches('.hn-modal-overlay') || event.target.matches('.hn-close-button')) {
            modal.style.display = 'none';
        }
    });

});



/*
document.addEventListener('focus', function(event) {
    console.log('Active element:', document.activeElement);
}, true); // Use capture phase to detect focus changes on all elements

setInterval(function() {
    console.log('Active element:', document.activeElement);
}, 5000);
*/


// END OF HIGHLIGHT FUNCTIONALITY
