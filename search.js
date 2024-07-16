let searchReloaded = false; // Global track whether results have been reloaded (if necessary)

function formatTitle(title) {
    // Regex to match ':', ';', or '-' not surrounded by \w characters
    const breakRegex = /([-:;])(?!\w)/;
    title = title.replace(/""/g, '"'); // Fix weird PG "" title tic
    // Find the first occurrence of the break character
    const match = title.match(breakRegex);
    if (match) {
        // Insert a break after the matched character and wrap the rest in a span with the 'subtitle' class
        return title.slice(0, match.index + 1) + "<br><span class='subtitle'>" + title.slice(match.index + 1) + "</span>";
    }
    return title;
}


// List of common words to ignore in OR searches
const stopWords = new Set(['the', 'of', 'in', 'on', 'at', 'for', 'with', 'a', 'an', 'and', 'or', 'but', 'is', 'if', 'it', 'as', 'to', 'that', 'which', 'by', 'from', 'up', 'out', 'on', 'off', 'this', 'all']);

function sortAndDisplayResults(results, query, searchType) {
    const keywords = query.toLowerCase().split(/\s+/);
    const fullPhrase = query.toLowerCase(); // The full search phrase, not split

    // Function to generate all permutations of an array of strings
    function generatePermutations(array, maxLength) {
        const startTime = performance.now();
    
        // Helper function to generate permutations of a given length
        function permute(arr, len) {
            if (len === 1) return arr.map(el => [el]);
            let permutations = [];
            arr.forEach((el, i) => {
                const smallerPerms = permute(arr.slice(0, i).concat(arr.slice(i + 1)), len - 1);
                smallerPerms.forEach(smallerPerm => {
                    permutations.push([el].concat(smallerPerm));
                });
            });
            return permutations;
        }
    
        let allPermutations = [];
        for (let len = 1; len <= Math.min(maxLength, array.length); len++) {
            allPermutations = allPermutations.concat(permute(array, len));
        }
    
        const endTime = performance.now();
        return allPermutations;
    }
        
    // Function to normalize strings by removing punctuation and converting to lowercase
    function normalizeString(str) {
        return str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim();
    }

    function isWholeWordMatch(haystack, needle) {
        const regex = new RegExp(`\\b${needle}\\b`, 'i');
        return regex.test(haystack);
    }

    function scoreBook(book) {
        const startTime = performance.now(); // Start timing
        let score = 0;
        const title = normalizeString(book.Title);
        const authors = book.CreatorNames ? book.CreatorNames.map(name => normalizeString(name)) : [];
    
        const normalizedKeywords = keywords.map(keyword => normalizeString(keyword));
        const maxPermutationLength = 3; // Limit the length of permutations to 3
        const permutations = generatePermutations(normalizedKeywords, maxPermutationLength).map(perm => perm.join(' '));    
        switch (searchType) {
            case 'title':
                if (title.includes(fullPhrase)) {
                    score += 500;
                    if (title.startsWith(fullPhrase)) {
                        score += 100;
                    }
                }
                break;
            case 'author':
                const authorMatchesPhrase = authors.some(author => permutations.some(perm => isWholeWordMatch(author, perm)));
                if (authorMatchesPhrase) {
                    score += 500;
                    const authorStartsWithPhrase = authors.some(author => permutations.some(perm => author.startsWith(perm)));
                    if (authorStartsWithPhrase) {
                        score += 100;
                    }
                }
                break;
            case 'both':
            default:
                if (title.includes(fullPhrase)) {
                    score += 500;
                    if (title.startsWith(fullPhrase)) {
                        score += 100;
                    }
                }
                const authorMatchesPhraseForBoth = authors.some(author => permutations.some(perm => isWholeWordMatch(author, perm)));
                if (authorMatchesPhraseForBoth) {
                    score += 500;
                    const authorStartsWithPhraseForBoth = authors.some(author => permutations.some(perm => author.startsWith(perm)));
                    if (authorStartsWithPhraseForBoth) {
                        score += 100;
                    }
                }
                break;
        }
    
        keywords.forEach(keyword => {
            let titleIndex = title.indexOf(keyword);
            let authorIndex = Math.min(...authors.map(author => author.indexOf(keyword)).filter(index => index !== -1));
    
            switch (searchType) {
                case 'title':
                    if (isWholeWordMatch(title, keyword)) {
                        score += 200;
                    } else if (titleIndex !== -1) {
                        score += (100 - titleIndex);
                    }
                    break;
                case 'author':
                    if (authors.some(author => isWholeWordMatch(author, keyword))) {
                        score += 200;
                    } else if (authorIndex !== -1) {
                        score += (100 - authorIndex);
                    }
                    break;
                case 'both':
                default:
                    let titleScore = 0;
                    let authorScore = 0;
                    if (isWholeWordMatch(title, keyword)) {
                        titleScore += 200;
                    } else if (titleIndex !== -1) {
                        titleScore += (100 - titleIndex);
                    }
                    if (authors.some(author => isWholeWordMatch(author, keyword))) {
                        authorScore += 200;
                    } else if (authorIndex !== -1) {
                        authorScore += (100 - authorIndex);
                    }
                    const maxScore = Math.max(titleScore, authorScore);
                    score += maxScore;
                    break;
            }
        });
    
        const endTime = performance.now(); // End timing
        return score;
    }
    

    // Assign a score to each result
    results.forEach(book => {
        book.score = scoreBook(book);
    });

    // Sort results by score in descending order
    results.sort((a, b) => b.score - a.score);

    displayResults(results);
}

function performSearch(query, searchType, isNewSearch) {
    query = query.trim();

    // Split the query into disjuncts based on "OR"
const disjuncts = query.split(' OR ').map(disjunct => disjunct.replace(/[^\w\s'-]|_+/g, '').replace(/\s+AND\s+/gi, ' '));

    // Check each disjunct to ensure it has at least three alphanumeric characters
    for (let disjunct of disjuncts) {
        // Split the disjunct into words and remove non-alphanumeric characters per word
        let words = disjunct.split(/\s+/).map(word => word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
    
        // Filter out the stop words
        let filteredWords = words.filter(word => !stopWords.has(word));
    
        // Join the filtered words and check the remaining length
        if (filteredWords.join('').length < 3) {
            document.getElementById('searchResults').innerHTML = '<p class="nosearch">Type more. <a href="about.html#search-books">About</a>.</p>';
            return;
        }
    }
    
    // Store the current search state, storing the original query for display purposes
    const searchState = { query, searchType };
    sessionStorage.setItem('lastSearch', JSON.stringify(searchState));

    // Clear previous results
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';

    // Process the query for the search
    // Apply lowercase for searching, but preserve 'OR' as a logical operator
    const searchQuery = disjuncts.map(disjunct => 
        disjunct.split(/\s+/).map(word => 
            word === "OR" ? "OR" : word.toLowerCase()
        ).join(" ")
    ).join(" OR ");

    return window.electronAPI.performSearch(searchQuery, searchType)
        .then(results => {
            if (results === "TOOMANYRESULTS") {
                console.log("TOOMANYRESULTS");
                resultsDiv.innerHTML = '<p style="color:grey !important;">Too many results or search terms. Please refine your search.</p>';
                return;
            }
            sortAndDisplayResults(results, query, searchType);  // Use original query for sorting and displaying
            console.log(`Search performed. Query: '${query}', Type: '${searchType}'`);
        })
        .catch(error => {
            console.error('Search failed:', error);
            resultsDiv.innerHTML = '<p>Error performing search.</p>';
        });
}

// Search rate limiting and debouncing
let lastSearchTime = 0;
let lastQuery = '';
let lastSearchType = '';
let searchTimeout = null;

function initiateSearch(query, searchType) {
    localStorage.setItem('sortingType', 'default');
    const currentTime = Date.now();
    const isRecent = currentTime - lastSearchTime < 500;
    const isSameSearch = query === lastQuery && searchType === lastSearchType && currentTime - lastSearchTime < 2000;

    if (isSameSearch) {
        console.log('Search skipped: Same parameters or too frequent.');
        return;
    }

    // Update last search tracking
    lastQuery = query;
    lastSearchType = searchType;

    // Clear any pending search and reset the timer
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        lastSearchTime = Date.now(); // Update time when the search is actually initiated
        performSearch(query, searchType, true);
        highlightCurrentSortButton();
    }, isRecent ? 500 : 0);
}

function displayResults(results) {
    const resultsDiv = document.getElementById('searchResults');
    if (results.length > 0) {
        results.forEach(book => {
            const div = document.createElement('div');
            div.classList.add('searchResultItem');
            const formattedTitle = formatTitle(book.Title);
            const creatorNames = Array.isArray(book.CreatorNames) ? book.CreatorNames.join(', ') : '';
            div.innerHTML = `<a href="javascript:void(0);" class="title" onclick="onBookClick('${book.PG_ID}')">${formattedTitle}</a><div class="author">${creatorNames}</div>`;
            resultsDiv.appendChild(div);
        });
    } else {
        resultsDiv.innerHTML = '<p>No results found.</p>'; // Display a no results message
    }
}


function onBookClick(bookId) {
    window.electronAPI.fetchBookMetadata(bookId).then(bookMetadata => {
        if (bookMetadata) {
            console.log("Book metadata fetched:", bookMetadata);  // Log the metadata to see what is being fetched

            // Convert the metadata to a string and store it
            localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));

            window.electronAPI.updateBookshelf({bookMetadata: bookMetadata, action: 'addViewed'});
            window.location.href = `reader.html?bookId=${bookId}`;
        } else {
            console.error("Book metadata not found for ID:", bookId);
        }
    });
}

document.addEventListener('DOMContentLoaded', async() => {
    // Set the initial zoom level from local storage
    const initialZoomLevel = window.electronAPI.getZoomLevel();
    window.electronAPI.setZoomLevel(initialZoomLevel);
    
    window.electronAPI.refreshMenu();

    // Back button logic
    function manageNavigationOnLoad() {
        if (history.length > 1 && localStorage.getItem('lastAddress') && 
            localStorage.getItem('lastAddress') == window.location.pathname) {
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

    // Support internal searches from context menu
    const urlParams = new URLSearchParams(window.location.search);
    const passedFromContext = urlParams.get('q');
    if (passedFromContext) {
        // Function to handle search
        performSearch(passedFromContext, "both", true);
    }

    // Retrieve and parse the last search state, providing a fallback if not found
    const lastSearch = JSON.parse(sessionStorage.getItem('lastSearch')) || {};
    // Destructure the last search object, assigning default values if undefined
    const { query = '', searchType = 'both' } = lastSearch;

    // Restore the search input and the selected search option
    document.getElementById('searchBox').value = query;
    document.querySelector(`input[name="searchOption"][value="${searchType}"]`).checked = true;

    // Perform the search again using the saved query and type, if any
    if (query) {
        await performSearch(query, searchType, false);
        applySavedSorting();
        const intervalId = setInterval(() => {
            if (searchReloaded) {
                clearInterval(intervalId);
                restoreScrollPosition();
            }
        }, 100);
    } else {
        restoreScrollPosition();
    }

    // Set up event listeners for search input changes and search option changes
    setupEventListeners();


    /////////////////////////////
    // Sorting functionality

    // Add event listeners for sorting
    document.getElementById('sortAuthor').addEventListener('click', sortByAuthor);
    document.getElementById('sortTitle').addEventListener('click', sortByTitle);
    document.getElementById('sortDate').addEventListener('click', sortByDate);
    document.getElementById('sortDefault').addEventListener('click', sortByDefault);

    const sortButton = document.getElementById('sortBtn');
    const sortDropdown = document.getElementById('sortDropdown');
    const sortOverlay = document.getElementById('sortOverlay');

    // Event listener to show/hide the sort modal
    sortButton.addEventListener('click', (event) => {
        event.stopPropagation();  // Prevent the click from propagating to the document
        if (sortDropdown.style.display === 'flex') {
            hideSortModal();
        } else {
            showSortModal();
        }
    });

    // Event listener to hide the sort modal when clicking outside of it or on the overlay
    document.addEventListener('click', (event) => {
        if (event.target === sortOverlay || !sortDropdown.contains(event.target)) {
            hideSortModal();
        }
    });

    // Event listener to hide the sort modal on pressing the 'Escape' key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideSortModal();
        }
    });
    
    /////////////////////////////
    // Find on page functionality
    const inputField = document.getElementById('searchText');
    const findButton = document.getElementById('findButton');
    const modal = document.getElementById('findOnPage');

    const performFindOnPage = () => window.electronAPI.performFind(inputField.value.trim());

    const realText = "";
    
    // Modify the keypress listener to use the search counter
    inputField.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent form submission
            inputField.setAttribute("inert", "");
            performFindOnPage();
            setTimeout(() => {
                inputField.removeAttribute("inert");
                inputField.focus();
            }, 100); // Refocus after a delay
        }
    });
    
    // Reset the search counter explicitly when the "Find" button is clicked
    findButton.addEventListener('click', performFindOnPage);

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
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function(event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
        }
    };

});

// Debounce function to delay execution
function debounce(func, delay) {
    let debounceTimer;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
}

// Event listeners setup, using debouncing for input to reduce the number of queries sent while typing
function setupEventListeners() {
    document.getElementById('searchBox').addEventListener('input', function(e) {
        const query = e.target.value;
        const searchType = document.querySelector('input[name="searchOption"]:checked').value;
        initiateSearch(query, searchType);
    });

    document.getElementById('searchButton').addEventListener('click', function() {
        const query = document.getElementById('searchBox').value;
        const searchType = document.querySelector('input[name="searchOption"]:checked').value;
        initiateSearch(query, searchType);
    });

    document.getElementById('searchBox').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const query = event.target.value;
            const searchType = document.querySelector('input[name="searchOption"]:checked').value;
            initiateSearch(query, searchType);
        }
    });

    // Add event listeners for search option radio buttons
    document.querySelectorAll('input[name="searchOption"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const query = document.getElementById('searchBox').value;
            const searchType = document.querySelector('input[name="searchOption"]:checked').value;
            initiateSearch(query, searchType);
        });
    });
}
// Save scroll position before leaving the page
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
});

function restoreScrollPosition() {
    const lastScrollPosition = sessionStorage.getItem('scrollPosition');
    if (lastScrollPosition) {
        setTimeout(() => {
            window.scrollTo(0, parseInt(lastScrollPosition, 10));
            searchReloaded = false;
        }, 100); // A slight delay to ensure all elements have been rendered
    }
}


////////////////////////////
// SORTING FUNCTIONS
// Function to get the search results container
function getSearchResultsContainer() {
    return document.getElementById('searchResults');
}

// Function to apply saved sorting type on page load
function applySavedSorting() {
    const savedSortingType = localStorage.getItem('sortingType');
    switch (savedSortingType) {
        case 'author':
            sortByAuthor();
            break;
        case 'title':
            sortByTitle();
            break;
        case 'date':
            sortByDate();
            break;
        default:
            sortByDefault(false); // false = don't redo search
            break;
    }
    highlightCurrentSortButton();
    searchReloaded = true;
}

function highlightCurrentSortButton() {
    // Retrieve the current sorting type from Local Storage
    const sortingType = localStorage.getItem('sortingType');

    // Define the mapping between sorting types and corresponding button IDs
    const buttonIdMap = {
        author: 'sortAuthor',
        title: 'sortTitle',
        date: 'sortDate',
        default: 'sortDefault'
    };

    // Get the ID of the button to highlight based on the sorting type
    const buttonIdToHighlight = buttonIdMap[sortingType];

    // Remove highlighted class from all buttons first
    document.querySelectorAll('.dropdown-btn').forEach(button => {
        button.classList.remove('sort-button-highlighted');
    });

    // Add highlighted class to the button that matches the current sorting type
    if (buttonIdToHighlight) {
        const buttonToHighlight = document.getElementById(buttonIdToHighlight);
        if (buttonToHighlight) {
            buttonToHighlight.classList.add('sort-button-highlighted');
        }
    }
}

// Function to sort by author last name
function sortByAuthor() {
    const container = getSearchResultsContainer();
    let items = container.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let authorA = a.querySelector('.author').textContent.split(',')[0].trim();
        let authorB = b.querySelector('.author').textContent.split(',')[0].trim();
        return authorA.localeCompare(authorB);
    });

    itemsArray.forEach(item => container.appendChild(item));
    localStorage.setItem('sortingType', 'author');
    highlightCurrentSortButton();
}

// Function to sort by title, stripping non-word characters
function sortByTitle() {
    const container = getSearchResultsContainer();
    let items = container.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let titleA = a.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        let titleB = b.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    itemsArray.forEach(item => container.appendChild(item));
    localStorage.setItem('sortingType', 'title');
    highlightCurrentSortButton();
}

// Function to sort by date extracted from author or title field
function sortByDate() {
    const container = getSearchResultsContainer();
    let items = container.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let dateRegex = /(\d+)(\??)( BCE| CE| AD| BC)?/g;
        let getDateValue = (text) => {
            let dates = [...text.matchAll(dateRegex)];
            let earliest = dates.reduce((min, current) => {
                let year = parseInt(current[1]);
                let isBCE = current[3] && current[3].includes("BCE");
                if (isBCE) year = -year; // Convert BCE to negative for correct chronological order
                return Math.min(min, year);
            }, Number.POSITIVE_INFINITY);
            return earliest === Number.POSITIVE_INFINITY ? new Date().getFullYear() : earliest;
        };

        let dateA = getDateValue(a.querySelector('.author').textContent);
        let dateB = getDateValue(b.querySelector('.author').textContent);

        return dateA - dateB;
    });

    itemsArray.forEach(item => container.appendChild(item));
    localStorage.setItem('sortingType', 'date');
    highlightCurrentSortButton();
}

function sortByDefault(redoSearch = true) {
    const container = getSearchResultsContainer();
    let items = container.querySelectorAll('.searchResultItem');
    // Perform search again
    const query = document.getElementById('searchBox').value;
    const searchType = document.querySelector('input[name="searchOption"]:checked').value;
    if (redoSearch){ initiateSearch(query, searchType); }
    // Save the sorting type in Local Storage
    localStorage.setItem('sortingType', 'default');
    highlightCurrentSortButton();
}

function showSortModal() {
    const sortDropdown = document.getElementById('sortDropdown');
    const sortOverlay = document.getElementById('sortOverlay');
    sortDropdown.style.display = 'flex';  // Display the sort options modal
    sortOverlay.style.display = 'block';   // Display the overlay
}

function hideSortModal() {
    const sortDropdown = document.getElementById('sortDropdown');
    const sortOverlay = document.getElementById('sortOverlay');
    sortDropdown.style.display = 'none';   // Hide the sort options modal
    sortOverlay.style.display = 'none';    // Hide the overlay
}

document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
        event.preventDefault();
        window.electronAPI.zoom(event.deltaY);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && (event.key === '=' || event.key === '+')) {
        // Ctrl and + key
        event.preventDefault();
        window.electronAPI.zoom(-1); // Zoom in
    } else if (event.ctrlKey && event.key === '-') {
        // Ctrl and - key
        event.preventDefault();
        window.electronAPI.zoom(1); // Zoom out
    }
});

