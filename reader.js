// Declare variables globally
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


function loadFont() {
    // Load the font choice from local storage
    const selectedFont = localStorage.getItem('selectedFont') || 'Liberation Serif';  // Default font
    
    // If there's a font saved, apply it
    document.body.style.fontFamily = selectedFont;
}

// Perform asynchronous operations
async function fetchData() {
    return new Promise(async(resolve, reject) => {
        try {
            bookshelfData = await window.electronAPI.requestBookshelfData();
            const backBtnInvoked = localStorage.getItem('backBtnInvoked') === 'true';
    
            //if (backBtnInvoked) {
                buffer = await window.electronAPI.fetchZWI(currentBookId);
                if (!buffer) {
                    console.error('Failed to load book: no buffer.');
                    return;
                }
                // Convert Buffer to Uint8Array directly
                zwiData = new Uint8Array(buffer);
    
                const bookMetadata = await window.electronAPI.fetchBookMetadata(currentBookId);
                if (bookMetadata) {
                    // Convert the metadata to a string and store it
                    currentBookMetadata = bookMetadata;
                    localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));        
                    window.electronAPI.updateBookshelf({bookMetadata, action: 'addViewed'});
                } else {
                    console.error("Book metadata not found for ID:", bookId);
                }
                resolve();
        } catch (error) {
            console.error('Failed to fetch book data:', error);
            reject(error);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    loadFont();

    // Fetch data
    await fetchData();

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
        if (history.length > 1 && localStorage.getItem('lastAddress') && 
            localStorage.getItem('lastAddress') == window.location.pathname) {
            console.log(window.location.pathname);
            return;
        } else if (history.length <= 1) {
            localStorage.removeItem('navCounter');
        }
        localStorage.setItem('lastAddress', window.location.pathname);
        if (history.length == 1) {localStorage.removeItem('navCounter')};
        let navCounter = parseInt(localStorage.getItem('navCounter'), 10);
        if (isNaN(navCounter)) { // Case 1: navCounter empty
            localStorage.setItem('navCounter', '2'); // Initial setting
            displayBackButton(false);
        } else if (navCounter === 1) { // Case 2: navCounter == 1
            navCounter += 1;
            localStorage.setItem('navCounter', navCounter.toString());
            displayBackButton(false);
        } else { // Case 3: navCounter > 1
            navCounter += 1;
            localStorage.setItem('navCounter', navCounter.toString());
            displayBackButton(true);
        }
    }

    function displayBackButton(shouldDisplay) {
        const backBtn = document.getElementById('backBtn');
        if (shouldDisplay) {
            backBtn.style.display = 'block';
        } else {
            backBtn.style.display = 'none';
        }
    }
    manageNavigationOnLoad();

    // Event listener for the back button
    document.getElementById('backBtn').addEventListener('click', function(event) {
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

    function processText(text) {
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
        console.log(creatorNames);
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

    function prepPlainText(text, isPoetry) {
        const lines = text.split(/\r\n|\r|\n/);
        const paragraphs = [];
        let paragraphIndex = 0;
        let singleLineFlag = false;
    
        // Extract and format author name
        const formattedAuthorName = extractAuthor(); // Assuming extractAuthor() is available globally and returns a formatted name
        const title = currentBookMetadata.Title; // Assuming title is stored in currentBookMetadata
            
        let tempParagraph = [];
        function flushParagraph() {
            if (tempParagraph.length > 0) {
                let combinedText = tempParagraph.join(' ').replace(/ {2,}/g, ' ');
                combinedText = combinedText.replace(/(\w)  (\w)/g, '$1 $2');
                paragraphs.push(`
                    <div class="paragraph" id="p${paragraphIndex}">
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
            // Replace leading spaces and tabs with `&nbsp;`
            const modifiedLine = line.replace(/^(\s+)/, function(match) {
                return match.replace(/ /g, '&nbsp;').replace(/\t/g, '&nbsp;&nbsp;&nbsp;');
            });
    
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
    
        flushParagraph();  // Ensure the last paragraph is flushed if not already
        const separateSwitch = addSwitch();  // Prepend the poetrySwitch
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

    fflate.unzip(zwiData, async (err, unzipped) => {
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
        const preliminaryContent = new TextDecoder("utf-8").decode(rawContent).substring(0, 5000);

        let decoder;  
        if (preliminaryContent.toLowerCase().includes("utf-8")) {
            decoder = new TextDecoder("utf-8");
        } else if (preliminaryContent.toLowerCase().includes("language: russian")) {
            decoder = new TextDecoder("cp1251");
        } else if (preliminaryContent.toLowerCase().includes("language: serbian")) {
            decoder = new TextDecoder("cp1251");
        } else if (preliminaryContent.toLowerCase().includes("iso-8859-1")) {
            decoder = new TextDecoder("iso88591");
        } else if (preliminaryContent.toLowerCase().includes("iso-8859-2")) {
            decoder = new TextDecoder("iso88592");
        } else if (preliminaryContent.toLowerCase().includes("unicode")) {
            decoder = new TextDecoder("utf-8");
        } else if (preliminaryContent.toLowerCase().includes("language: chinese")) {
            decoder = new TextDecoder("utf-8");
        } else {
            decoder = new TextDecoder("iso88591");
        }

        let bookContent = decoder.decode(rawContent);

        // Remove weird PG tic: double-double quotes in titles
        bookContent = bookContent.replace(/(?<!=[ ]?)""/g, '"');
        bookContent = processText(bookContent);

        // Define a regular expression that includes the root words for "poet" or "poem" in various languages
        // Words: poet, poem, poète, poème, dichter, gedicht, poeta, poema, poet, dikt, поэт, стих, 诗人, 诗
        const pattern = /poet(?:s)?|poem(?:s)?|poète(?:s)?|poème(?:s)?|dichter(?:s)?|gedicht(?:e|er)?|poeta(?:s)?|poema(?:s)?|dikt(?:er)?|поэт(?:ы|ов)?|стих(?:и|ов)?|诗人|诗|song(?:s)?|canzone(?:i)?|lied(?:er|je)?|canción(?:es)?|canto(?:s)?|sång(?:er)?|песня(?:и|ей)?|歌|lyric(?:s)?|lyrique(?:s)?|lyrik(?:en)?|lirica(?:s)?|lyrik(?:er)?|лир(?:ика|ы)?|诗歌/i;


        // Fetch the title from the metadata and test it against the regular expression
        let isPoetry = pattern.test(currentBookMetadata.Title);

        // Override isPoetry based on the separateLines setting from localStorage
        const settingKey = `separateLines_${bookId}`;
        let separateLinesSetting = localStorage.getItem(settingKey);
        if (separateLinesSetting !== null) {
            isPoetry = separateLinesSetting === 'true';
        } else if (isPoetry) {
            localStorage.setItem(settingKey, 'true');
        }

        // Set content in the appropriate format
        // Call prepPlainText with the isPoetry flag to adjust processing accordingly
        bookContentDiv.innerHTML = primaryFilename.endsWith(".txt") ? prepPlainText(bookContent, isPoetry) : bookContent;

        // WORD COUNT LOGIC
        // Function to strip HTML tags and get plain text content
        function getTextContent(htmlContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            return tempDiv.textContent || tempDiv.innerText || '';
        }

        // Function to count words in a given text
        function countWords(text) {
            // Match words using a regex pattern
            const words = text.match(/\b\w+\b/g) || [];
            return words.length;
        }

        // Get the plain text content
        const plainTextContent = getTextContent(bookContentDiv.innerHTML);

        // Count the words
        const wordCount = countWords(plainTextContent);
        const pageCount = Math.ceil(wordCount / 300);

        // Move inline centering to class.
        let paragraphs = bookContentDiv.querySelectorAll('p[style*="text-align: center;"]');
        paragraphs.forEach(p => {
            p.style.textAlign = ''; // Remove the inline style
            p.classList.add('center'); // Add the center class
        });
            
        // Check if the switch exists
        const poetrySwitch = document.querySelector('.poetrySwitch input');
        if (poetrySwitch) {
            // Adding event listener to the switch
            poetrySwitch.addEventListener('change', function() {
                const settingKey = `separateLines_${bookId}`;
                if (this.checked) {
                    localStorage.setItem(settingKey, 'true');
                    setTimeout(() => {
                        location.reload();
                    }, 800);
                } else {
                    localStorage.setItem(settingKey, 'false');
                    setTimeout(() => {
                        location.reload();
                    }, 800);            
                }
            });

            // Set the switch position based on the latest setting
            const settingKey = `separateLines_${bookId}`;
            const separateLinesSetting = localStorage.getItem(settingKey);
            if (separateLinesSetting === 'true') {
                poetrySwitch.checked = true;
            } else {
                poetrySwitch.checked = false;
            }
        }

        function addBookmarkIcon(element, index) {
            // Create a new wrapper element
            const wrapper = document.createElement('div');
            // Add bookmark icon
            const bookmarkIcon = document.createElement('img');
            bookmarkIcon.src = "images/icons/bookmark.svg";
            bookmarkIcon.className = "bookmark-icon";
            bookmarkIcon.id = `bookmark-${index}`;
            bookmarkIcon.onclick = () => toggleBookmark(index);
        
            // Wrap the element's content with a paragraph if it's not a paragraph
            if (element.tagName !== 'P') {
                const paragraph = document.createElement('p');
                paragraph.innerHTML = element.innerHTML;
                wrapper.appendChild(bookmarkIcon);
                wrapper.appendChild(paragraph);
            } else {
                wrapper.appendChild(bookmarkIcon);
                wrapper.appendChild(element.cloneNode(true));
            }
        
            // Replace the element's content
            element.innerHTML = '';
            while (wrapper.firstChild) {
                element.appendChild(wrapper.firstChild);
            }
            element.classList.add("paragraph"); // Ensure it has the 'paragraph' class for consistent styling and behavior
        }
        
        function assignIDsToContentElements(content) {
            let paragraphIndex = 0;
            const elements = content.querySelectorAll('p, div');
            const updates = [];
        
            elements.forEach(element => {
                if (!element.id && ((element.tagName === 'DIV' && !element.querySelector('p') && element.textContent.trim().length > 0) || element.tagName === 'P')) {
                    element.id = `p${paragraphIndex}`;
                    updates.push({ element, index: paragraphIndex });
                    paragraphIndex++;
                }
            });
        
            updates.forEach(({ element, index }) => {
                addBookmarkIcon(element, index);
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
                        if (icon) {
                            icon.classList.add('filled');
                            icon.src = 'images/icons/bookmark-fill.svg';
                            icon.style.visibility = 'visible'; // Ensure it is always visible
                        } else {
                            console.log('Bookmark icon not found for:', bookmarkId);
                        }
                    } else {
                        console.log('Element not found for bookmark:', bookmarkId); // Log missing elements
                    }
                });
                // This is placed here simply because this function takes longest.
                setTimeout(restoreScrollPosition, 250);
            } catch (error) {
                console.error('Error fetching bookmarks:', error);
            }
        }
                
        applyBookmarks();
        
        // Function to preprocess <a> and <img> tags by removing <i>, </i> and updating refs
        function preprocessDocumentElements() {
            const anchors = document.querySelectorAll('a');
            const images = document.querySelectorAll('img');

            anchors.forEach(anchor => {
                ['name', 'id', 'href'].forEach(attr => {
                    if (anchor.hasAttribute(attr)) {
                        let value = anchor.getAttribute(attr);
                        // Remove <i> and </i> tags
                        value = value.replace(/<\/?i>/g, '_');
                        value = value.replace(/(noteref|note|page|fnote|fnanchor)(\d+)/ig, (_, p1, p2) => `${p1}_${p2}`);

                        // Ensure IDs and hrefs do not start with a digit
                        if ((attr === 'id' || attr === 'name') && /^\d/.test(value)) {
                            value = `id_${value}`;
                        } else if (attr === 'href' && value.startsWith('#')) {
                            value = value.replace(/#(noteref|note|page)(\d+)/ig, (_, p1, p2) => `#${p1}_${p2}`);
                            if (/^#\d/.test(value)) {
                                value = `#id_${value.slice(1)}`;
                            }
                        }

                        anchor.setAttribute(attr, value);
                    }
                });

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
                    src = src.replace(/<\/?i>/g, '_');
                    img.setAttribute('src', src);
                }
            });
        }
            
        // Function to clean up file paths
        function cleanPath(path) {
            return path.replace(/<\/?[^>]+>/gi, ''); // Strip out HTML tags
        }

        // When creating Blob URLs and storing them in the resourceMap:
        Object.keys(unzipped).forEach(filename => {
            if (filename !== primaryFilename && (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.gif'))) {
                const fileBlob = new Blob([unzipped[filename]], {type: 'image/' + filename.split('.').pop()});
                const fileUrl = URL.createObjectURL(fileBlob);
                // Normalize and clean filename to match the expected src format in HTML
                const normalizedFilename = cleanPath(filename.replace('data/media/images/', ''));
                resourceMap[normalizedFilename] = fileUrl;
            }
        });

        // Replace <img src> with blob link
        document.querySelectorAll('#book-content img').forEach(img => {
            const originalSrc = img.getAttribute('src');
        
            // Skip processing for known static assets to avoid unnecessary errors
            if (originalSrc.startsWith('images/icons/')) {
                return; // Skip this image as it's a static asset
            }
        
            const normalizedSrc = cleanPath(originalSrc.replace('data/media/images/', ''));
            if (resourceMap[normalizedSrc]) {
                img.setAttribute('src', resourceMap[normalizedSrc]);
        
                // Add event listener for opening the modal
                img.onclick = function(event) {
                    event.preventDefault(); // Prevent the default anchor behavior
                    const modal = document.getElementById('imageModal');
                    const modalImg = document.getElementById('modalImage');
                    const captionText = document.getElementById('caption');
                    modal.style.display = "block";
                    modalImg.src = this.src;
                    captionText.innerHTML = img.alt; // Assuming you might use the alt attribute as caption
                };
            } else {
                console.log('No Blob URL found for:', originalSrc);
            }
        });

        // Close the image modal that was just created
        // Get the <span> element that closes the modal
        var span = document.getElementsByClassName("close")[0];
        // When the user clicks on <span> (x), close the modal
        span.onclick = function() {
            var modal = document.getElementById('imageModal');
            modal.style.display = "none";
        }
        document.addEventListener('keydown', function(event) {
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

                if (resourceMap[imagePath]) {
                    const blobUrl = resourceMap[imagePath];
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.href = blobUrl;
                    downloadAnchor.download = getBasename(imagePath); // Use the custom function to get the image file name for downloading
                    downloadAnchor.click();
                    URL.revokeObjectURL(blobUrl); // Clean up the URL object
                } else {
                    console.error('Blob URL not found for:', imagePath);
                }
            }
        }

        // Add event listener to the document for intercepting link clicks
        document.addEventListener('click', handleImageDownload);

        // Existing code for preprocessing document elements and handling modals
        preprocessDocumentElements();


        // WORD COUNT DISPLAY
        // Append the word count to the bottom of #book-content
        const wordCountDiv = document.createElement('div');
        wordCountDiv.classList.add('word-count');
        wordCountDiv.innerHTML = `<i>Word count: ${wordCount.toLocaleString()}<br>(${pageCount.toLocaleString()} average pages)</i>`;
        document.getElementById('book-content').appendChild(wordCountDiv);
        
        // Create the word count hover-over popup
        const countPopup = document.createElement('div');
        countPopup.classList.add('count-popup');
        countPopup.innerHTML = `<i>Word count: ${wordCount.toLocaleString()}<br>(${pageCount.toLocaleString()} average pages)</i>`;
        document.body.appendChild(countPopup);

        // Add event listeners to #headTitle
        const headTitle = document.getElementById('headTitle');
        headTitle.addEventListener('mouseover', function(event) {
            countPopup.style.display = 'block';
            countPopup.style.left = event.pageX + 'px';
            countPopup.style.top = event.pageY + 'px';
        });

        headTitle.addEventListener('mousemove', function(event) {
            countPopup.style.left = event.pageX + 'px';
            countPopup.style.top = event.pageY + 'px';
        });

        headTitle.addEventListener('mouseout', function() {
            countPopup.style.display = 'none';
        });
    });
    
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
    window.addEventListener('resize', setTitle);


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

    bookmarksBtn.addEventListener('click', function(event) {
        event.preventDefault();
        const isDisplayed = bookmarksDropdown.style.display === 'flex';
        bookmarksDropdown.style.display = isDisplayed ? 'none' : 'flex';
        
        if (!isDisplayed) {
            displayBookmarks();
        }
    });

    // Ensure bookmark modal is closed on 'Escape' key press
    document.addEventListener('keydown', function(event) {
        if (event.key === "Escape") {
            if (bookmarksDropdown && bookmarksDropdown.style.display === 'flex') {
                bookmarksDropdown.style.display = 'none';
            }
        }
    });

    document.addEventListener('click', function(event) {
        if (!bookmarksDropdown.contains(event.target) && !bookmarksBtn.contains(event.target)) {
            bookmarksDropdown.style.display = 'none';
        }
    });

    // Prevent clicks inside the dropdown from propagating
    bookmarksDropdown.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    async function displayBookmarks() {
        try {
            const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
            const docHeight = document.documentElement.scrollHeight;
            if (bookmarks && bookmarks.length > 0) {
                const bookmarksHtml = bookmarks.map(id => {
                    const paragraphElement = document.getElementById(id);
                    let snippet = paragraphElement ? paragraphElement.textContent.slice(0, 150) + '...' : 'No preview available';
                    let position = paragraphElement ? (paragraphElement.offsetTop / docHeight) * 100 : 0;
                    position = position.toFixed(0); // Format to 2 decimal places
                    return `
                    <div class="dropdown-btn bookmark-item" data-bookmark-id="${id}">
                        <div class="bookmark-column" onclick='goToBookmark("${id}");'">
                            <img src="images/icons/bookmark-fill.svg">
                            <div class="bookmark-percentage">${position}%</div>
                        </div>
                        <span class="bookmark-snippet" onclick='goToBookmark("${id}");'>${snippet}</span>
                        <img src="images/icons/trash.svg" class="delete-bookmark" onclick="deleteBookmark('${id}')" title="Delete">
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
    inputField.addEventListener('keypress', function(event) {
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
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        } else if (event.target === fontModal) {
            closeFontModal(); // Close the modal if the click was outside the modal content
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function(event) {
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

    document.body.addEventListener('click', function(e) {
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
    
        return function() {
            const context = this;
            const args = arguments;
            const elapsed = Date.now() - lastExec;
    
            const execute = function() {
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
        window.scrollBy(0,-120);
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
window.onkeydown = function(event) {
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
