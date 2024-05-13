const urlParams = new URLSearchParams(window.location.search);
const bookId = urlParams.get('bookId');
console.log(`Opening book Project Gutenberg number: ${bookId}`)
let currentBookId = bookId; 
let bookshelfData = null;

function loadFont() {
    // Load the font choice from local storage
    const selectedFont = localStorage.getItem('selectedFont') || 'Arial';  // Default font
    
    // If there's a font saved, apply it
    document.body.style.fontFamily = selectedFont;
}

document.addEventListener('DOMContentLoaded', async () => {
    loadFont();

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
        history.back();
    });
    // End back button block
    
    const bookContentDiv = document.getElementById('book-content');

    bookshelfData = await window.electronAPI.requestBookshelfData();
    
    const bookshelfAddRemove = document.querySelector('#bookshelfAddRemove');
    
    bookshelfAddRemove.style.display = 'flex';

    const currentBookMetadata = JSON.parse(localStorage.getItem('currentBookMetadata'));

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
    showSavedState(bookId); // Initially loads saved state from currentBookMetadata.

    // Listener for adding or removing a book from saved list
    bookshelfAddRemove.addEventListener("click", async () => {
        // Determine the action based on the current class
        let isAdding = bookshelfAddRemove.classList.contains('bi-journal-plus');
        let action = isAdding ? 'addSaved' : 'removeSaved';

        // Update the bookshelf with the appropriate action
        await window.electronAPI.updateBookshelf({ bookMetadata: currentBookMetadata, action: action });

        // Re-fetch the updated bookshelf data to ensure the UI can correctly reflect the new state
        bookshelfData = await window.electronAPI.requestBookshelfData();

        // Show the updated saved state based on the newly fetched data
        showSavedState(currentBookId);

    });

    let resourceMap = {};
    let zwiData;

    try {
        const buffer = await window.electronAPI.fetchZWI(bookId);
        if (!buffer) {
            bookContentDiv.textContent = 'Failed to load book: no buffer.';
            return;
        }
        // Convert Buffer to Uint8Array directly
        zwiData = new Uint8Array(buffer);
        // Now use zwiData as needed for further processing/display
    } catch (error) {
        bookContentDiv.textContent = 'Failed to load book: error.';
        console.error('Failed to fetch book data:', error);
    }

    function processText(text) {
        return text.replace(/_(.+?)_/g, (match, p1) => {
            if (p1.length <= 100) {
                return `<i>${p1}</i>`;
            }
            return match; // Return the original text if it's too long
        });
    }

    function extractAuthor() {
        let creatorNames = currentBookMetadata.CreatorNames;
        console.log(creatorNames);
        const suffixes = ["Ph.D.", "PhD", "Ph. D.", "D.Phil.", "DPhil", "Doctor", "D.D.", "D. D.", "Jr.", "Junior", "Sr.", "Senior", "II", "III", "IV", "V", "Esq.", "Esquire", "MD", "M.D.", "Dr.", "Doctor", "RN", "R.N.", "DO", "D.O.", "DDS", "D.D.S.", "DVM", "D.V.M.", "JD", "J.D.", "LLD", "LL.D.", "EdD", "Ed.D.", "PharmD", "Pharm.D.", "MBA", "M.B.A.", "CPA", "C.P.A.", "DMD", "D.M.D.", "DC", "D.C.", "OD", "O.D.", "PA", "P.A.", "P.A.-C", "MA", "M.A.", "MS", "M.S.", "MSc", "M.Sc.", "MPH", "M.P.H.", "BSc", "B.Sc.", "BA", "B.A.", "BS", "B.S.", "MFA", "M.F.A.", "MPhil", "M.Phil.", "PsyD", "Psy.D.", "EdS", "Ed.S.", "MSW", "M.S.W.", "BFA", "B.F.A.", "MSEd", "M.S.Ed.", "MSE", "M.S.E.", "DPT", "D.P.T.", "DPA", "D.P.A.", "ScD", "Sc.D.", "EngD", "Eng.D.", "ASN", "A.S.N."];
    
        // Clean creator names by removing square brackets and anything inside them
        let cleanedNames = creatorNames.map(name => name.replace(/\s*\[.*?\]\s*/g, '').trim());
    
        console.log("Cleaned Creator Names:", cleanedNames);
    
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
    
                console.log(`Extracted Author: ${formattedName}`);
                return formattedName;
            } else {
                console.log("No valid author data found.");
                return "No valid author data found.";
            }
        } else {
            console.log("No creator names available.");
            return "No creator names available.";
        }
    }
    
    function prepPlainText(text, isPoetry) {
        const lines = text.split(/\r\n|\r|\n/);
        const paragraphs = [];
        let paragraphIndex = 0;
    
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
    
        // Process each line individually
        lines.forEach((line, index) => {
            // Replace leading spaces and tabs with `&nbsp;`
            const modifiedLine = line.replace(/^(\s+)/, function(match) {
                return match.replace(/ /g, '&nbsp;').replace(/\t/g, '&nbsp;&nbsp;&nbsp;');
            });
    
            // Check for title or author in the line
            if (line.toLowerCase() === title.toLowerCase()) {
                paragraphs.push(`<h1 class="center">${title}</h1>`); 
            } else if (line.toLowerCase().startsWith('by') && percentageMatch(line.substring(3).toLowerCase(), formattedAuthorName.toLowerCase()) >= 50) {
                paragraphs.push(`<h2 class="center">By ${formattedAuthorName}</h2>`);
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
                } else {
                    tempParagraph.push(modifiedLine);
                }
            }
        });
    
        flushParagraph();  // Ensure the last paragraph is flushed if not already
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
    
        console.log('Unzipped content:', unzipped); // Log the content of unzipped
    
        const primaryFilename = currentBookMetadata.Primary;
        console.log(currentBookMetadata);
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
        const pattern = /poet|poem|poète|poème|dichter|gedicht|poeta|poema|dikt|поэт|стих|诗人|诗/i;

        // Fetch the title from the metadata and test it against the regular expression
        const isPoetry = pattern.test(currentBookMetadata.Title);
        
        // Set content in the appropriate format
        // Call prepPlainText with the isPoetry flag to adjust processing accordingly
        bookContentDiv.innerHTML = primaryFilename.endsWith(".txt") ? prepPlainText(bookContent, isPoetry) : bookContent;

        function addBookmarkIcon(element, index) {
            // Ensure the inner HTML of the element wraps its current content with a paragraph and includes the bookmark icon
            element.innerHTML = `<img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${index}" onclick="toggleBookmark(${index})">${element.tagName === 'P' ? '<p>' + element.innerHTML + '</p>' : element.innerHTML}`;
            element.classList.add("paragraph"); // Ensure it has the 'paragraph' class for consistent styling and behavior
        }

        function assignIDsToContentElements(content) {
            let paragraphIndex = 0;
            // Target both <p> and <div> tags
            let elements = content.querySelectorAll('p, div');
        
            elements.forEach(element => {
                // Process div tags that do not contain <p> tags and have non-empty text content
                // and p tags that do not already have an ID
                if (!element.id && ((element.tagName === 'DIV' && !element.querySelector('p') && element.textContent.trim().length > 0) || element.tagName === 'P')) {
                    element.id = `p${paragraphIndex}`; // Assign ID
                    addBookmarkIcon(element, paragraphIndex); // Add bookmark icon and other necessary HTML modifications
                    paragraphIndex++;
                }
            });
            return content;
        }
                
        // Usage after setting the innerHTML for bookContentDiv
        if (primaryFilename.endsWith(".html") || primaryFilename.endsWith(".htm")) {
            bookContentDiv.innerHTML = bookContent;
            console.time("foo");
            assignIDsToContentElements(bookContentDiv);
            console.timeEnd("foo");
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
            } catch (error) {
                console.error('Error fetching bookmarks:', error);
            }
        }
                
        applyBookmarks();
        
        // Function to preprocess <a> and <img> tags by removing <i>, </i> and updating refs
        function preprocessDocumentElements() {
            // Process anchor tags
            document.querySelectorAll('a').forEach(anchor => {
                ['name', 'id', 'href'].forEach(attr => {
                    if (anchor.hasAttribute(attr)) {
                        let value = anchor.getAttribute(attr);
                        // Remove <i> and </i> tags
                        value = value.replace(/<\/?i>/g, '_');
                        value = value.replace(/(noteref|note|page|fnote|fnanchor)(\d+)/ig, (match, p1, p2) => {
                            return `${p1}_${p2}`;
                        });
        
                        // Correct href formatting for references
                        if (attr === 'href' && value.startsWith('#')) {
                            value = value.replace(/#(noteref|note|page)(\d+)/ig, (match, p1, p2) => {
                                return `#${p1}_${p2}`;
                            });
                        }
                        anchor.setAttribute(attr, value);
                    }
                });
        
                // Check if there is a 'name' attribute without a corresponding 'id'
                if (anchor.hasAttribute('name') && !anchor.hasAttribute('id')) {
                    // Set 'id' to the value of 'name'
                    anchor.setAttribute('id', anchor.getAttribute('name'));
                }
            });
        
            // Process image tags (removes restores '_' where needed)
            document.querySelectorAll('img').forEach(img => {
                if (img.hasAttribute('src')) {
                    let src = img.getAttribute('src');
                    // Remove <i> and </i> tags from src
                    src = src.replace(/<\/?i>/g, '_');
                    img.setAttribute('src', src);
                }
            });
        }
        
        console.time('Preprocess Document Elements');
        preprocessDocumentElements(); // Preprocessing anchor and image elements
        console.timeEnd('Preprocess Document Elements');
            
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

        // When replacing src in HTML:
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
        if (currentBookMetadata && currentBookMetadata.Title) {
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
            if (wholeTitle.length > truncationLength) {
                truncatedTitle = wholeTitle.substring(0, truncationLength) + "…";
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
        } else {
            headTitle.textContent = wholeTitle;
        }
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
                        <div class="bookmark-column" onclick='goToBookmark(${id});'">
                            <img src="images/icons/bookmark-fill.svg">
                            <div class="bookmark-percentage">${position}%</div>
                        </div>
                        <span class="bookmark-snippet" onclick='goToBookmark(${id});'>${snippet}</span>
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
                const headerHeight = 80; // Adjust if your header height changes
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
    
        console.log(`Attempting to save position: ${percentageThrough.toFixed(2)}% for bookId: ${currentBookId}`);
    
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
    const element = document.getElementById(paragraphId.id);
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
            console.log(`Restoring to position: ${scrollPosition}px out of ${totalHeight}px total height`);
    
            window.scrollTo(0, scrollPosition);
        }
    } else {
        console.log("bookshelfData is not loaded yet");
    }
}

// Load last read position with a delay to ensure complete page load
window.onload = function() {
    setTimeout(() => {
        restoreScrollPosition();
    }, 250); // Adjust the timing as necessary based on your application's needs
};
