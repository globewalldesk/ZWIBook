// Your bookshelf data
const bookshelfData = {
    viewedBooks: [],
    savedBooks: [],
    readingPositions: [],
    bookmarks: []
};

function formatTitle(title) {
    title = title.replace(/""/g, '"');
    // Regex to match ':', ';', or '-' not surrounded by \w characters
    const breakRegex = /([-:;])(?!\w)/;
    // Find the first occurrence of the break character
    const match = title.match(breakRegex);
    if (match) {
        // Insert a break after the matched character and wrap the rest in a span with the 'subtitle' class
        return title.slice(0, match.index + 1) + "<br><span class='subtitle'>" + title.slice(match.index + 1) + "</span>";
    }
    return title;
}

// Function to handle clicking on a book title
function onBookClick(bookId) {
    // Ensure bookId is treated as a string
    let stringBookId = String(bookId);

    let bookMetadata = bookshelfData.viewedBooks.concat(bookshelfData.savedBooks).find(book => String(book.PG_ID) === stringBookId);

    if (bookMetadata) {
        localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));
        window.location.href = `reader.html?bookId=${stringBookId}`;
    } else {
        console.error("Book metadata not found for ID:", stringBookId);
    }
}

function refreshBookshelfUI() {
    window.electronAPI.requestBookshelfData().then(data => {
        Object.assign(bookshelfData, data);

        const viewedDiv = document.getElementById('viewed');
        const savedDiv = document.getElementById('saved');

        viewedDiv.innerHTML = '';
        savedDiv.innerHTML = '';

        if (bookshelfData.viewedBooks.length === 0) {
            viewedDiv.innerHTML = '<p style="color:#007BFF">Nothing to show here yet.<br/>Start <a href="search.html">searching</a> or <a href="html/categories.html">browsing</a>, and saving books!<br/>To save one, open it and press this button:</p><p><span style="background-color:#007BFF; height: 32px; display: inline-block; padding: 5px"><img src="./images/icons/add-book.svg"></span></p>';
        } else {
            viewedDiv.innerHTML = '';
            populateDivWithBooks(viewedDiv, bookshelfData.viewedBooks, 'Viewed');
        }

        if (bookshelfData.savedBooks.length === 0) {
            savedDiv.innerHTML = '<p style="color:#007BFF">Nothing to show here yet.<br/>Start <a href="search.html">searching</a> or <a href="html/categories.html">browsing</a>, and saving books!<br/>To save one, open it and press this button:</p><p><span style="background-color:#007BFF; height: 32px; display: inline-block; padding: 5px"><img src="./images/icons/add-book.svg"></span></p>';
        } else {
            savedDiv.innerHTML = '';
            populateDivWithBooks(savedDiv, bookshelfData.savedBooks, 'Saved');
        }

        appendRemoveAllButton(viewedDiv, 'Viewed');
        appendRemoveAllButton(savedDiv, 'Saved');

        checkAndDisplayButtons();
    }).catch(error => {
        console.error("Error fetching bookshelf data: ", error);
    });
}

function populateDivWithBooks(divElement, books, listType) {
    books.forEach(book => {
        divElement.appendChild(createBookDiv(book, listType));
    });
    appendRemoveAllButtonContainer(divElement, listType);
}

function appendRemoveAllButtonContainer(divElement, listType) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'remove-all-button-container';
    divElement.appendChild(buttonContainer);
    appendRemoveAllButton(buttonContainer, listType);
}

function appendRemoveAllButton(container, listType) {
    const buttonId = `removeAll${listType}Button`;
    let button = document.getElementById(buttonId);

    if (!button) {
        button = document.createElement('button');
        button.id = buttonId;
        button.textContent = `Remove All ${listType} Books`;
        button.addEventListener('click', () => handleRemoveAll(button, listType));
        container.appendChild(button);
    }
}

function handleRemoveAll(button, listType) {
    const confirmed = confirm(`This will empty the '${listType} Books' tab. Are you sure?`);
    if (confirmed) {
        console.log(`Clearing ${listType.toLowerCase()} books`);
        const action = `removeAll${listType}`;
        window.electronAPI.updateBookshelf({ action: action });
        window.electronAPI.onBookshelfUpdated(() => {
            refreshBookshelfUI();  // Refresh the UI only after confirmation
        });
    }
}

function checkAndDisplayButtons() {
    const viewedItems = document.querySelectorAll('#viewed .searchResultItem');
    const savedItems = document.querySelectorAll('#saved .searchResultItem');

    const removeAllViewedBtn = document.getElementById('removeAllViewedButton');
    const removeAllSavedBtn = document.getElementById('removeAllSavedButton');

    removeAllViewedBtn.style.display = viewedItems.length >= 20 ? 'block' : 'none';
    removeAllSavedBtn.style.display = savedItems.length >= 20 ? 'block' : 'none';
}

function checkAndDisplayButtons() {
    const viewedItems = document.querySelectorAll('#viewed .searchResultItem');
    const savedItems = document.querySelectorAll('#saved .searchResultItem');

    const removeAllViewedBtn = document.getElementById('removeAllViewedButton');
    const removeAllSavedBtn = document.getElementById('removeAllSavedButton');

    removeAllViewedBtn.style.display = viewedItems.length >= 20 ? 'block' : 'none';
    removeAllSavedBtn.style.display = savedItems.length >= 20 ? 'block' : 'none';
}

function removeBook(bookId, listType) {
    console.log("Requesting removal of book with ID:", bookId, "from", listType);

    // Send IPC message to main process to remove the book from the specified list
    window.electronAPI.updateBookshelf({ bookMetadata: { PG_ID: bookId }, action: `remove${listType}` });

    // Listen for the update confirmation from the main process
    window.electronAPI.onBookshelfUpdated((response) => {
        console.log(response); // Log the response from the main process
        refreshBookshelfUI(); // Refresh the UI after the backend confirms the update
    });
}

// Function to create and return a book div element
function createBookDiv(book, listType) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'searchResultItem';

    const titleElement = document.createElement('a');
    titleElement.className = 'title';
    titleElement.innerHTML = formatTitle(book.Title);
    titleElement.onclick = function () {
        onBookClick(book.PG_ID);
    };
    titleElement.href = "javascript:void(0);";

    const authorElement = document.createElement('div');
    authorElement.className = 'author';
    authorElement.textContent = `by ${Array.isArray(book.CreatorNames) ? book.CreatorNames.join(', ') : 'Unknown Author'}`;

    const trashIcon = document.createElement('img');
    trashIcon.src = 'images/icons/trash.svg';
    trashIcon.className = 'trashIcon';
    trashIcon.onclick = function () {
        removeBook(book.PG_ID, listType);
    };

    bookDiv.appendChild(titleElement);
    bookDiv.appendChild(authorElement);
    bookDiv.appendChild(trashIcon);

    return bookDiv;
}

function showTab(tabName) {
    const tabs = document.getElementsByClassName('tab');
    const tabContents = document.getElementsByClassName('tabContent');

    // Hide all tab contents and remove active class from all tabs
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
        tabs[i].classList.remove('active');
    }

    // Retrieve the selected tab content
    const selectedTabContent = document.getElementById(tabName);

    // Show the selected tab content and add active class to the clicked tab
    selectedTabContent.style.display = 'block';
    const activeTab = document.querySelector(`.tab[onclick="showTab('${tabName}')"]`);
    activeTab.classList.add('active');

    // Save the current tab to localStorage
    localStorage.setItem('lastViewedTab', tabName);

    applySavedSorting()
}


// Function to get the currently active tab content for sorting
function getActiveTabContent() {
    // Check which tab content is visible and return the corresponding tab content container
    const viewedContent = document.getElementById('viewed');
    const savedContent = document.getElementById('saved');
    return (viewedContent.style.display !== 'none') ? viewedContent : savedContent;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Set the initial zoom level from local storage
    const initialZoomLevel = window.electronAPI.getZoomLevel();
    window.electronAPI.setZoomLevel(initialZoomLevel);

    window.electronAPI.refreshMenu();

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
        if (history.length == 1) { localStorage.removeItem('navCounter') };
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
    document.getElementById('backBtn').addEventListener('click', function (event) {
        event.preventDefault();
        let navCounter = parseInt(localStorage.getItem('navCounter'), 10);
        navCounter -= 2;
        localStorage.setItem('navCounter', navCounter.toString());
        localStorage.setItem('backBtnInvoked', true);
        history.back();
    });
    // End back button block


    try {
        const data = await window.electronAPI.requestBookshelfData();
        if (data) {
            bookshelfData.viewedBooks = data.viewedBooks;
            bookshelfData.savedBooks = data.savedBooks;
            refreshBookshelfUI();  // Use a dedicated function to refresh UI
        } else {
            console.error('No book data received');
        }
    } catch (error) {
        console.error("Error fetching bookshelf data: ", error);
    }

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


    // Clear existing content and populate tabs
    document.getElementById('viewed').innerHTML = '';
    document.getElementById('saved').innerHTML = '';
    
    bookshelfData.viewedBooks.forEach(book => {
        document.getElementById('viewed').appendChild(createBookDiv(book, 'Viewed')); // Pass 'Viewed'
    });
    bookshelfData.savedBooks.forEach(book => {
        document.getElementById('saved').appendChild(createBookDiv(book, 'Saved')); // Pass 'Saved'
    });

    // Retrieve the last viewed tab from localStorage or default to 'viewed'
    const lastViewedTab = localStorage.getItem('lastViewedTab') || 'viewed';
    showTab(lastViewedTab);

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
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function (event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
        }
    };

});


////////////////////////////
// SORTING FUNCTIONS

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
            break;
    }
    highlightCurrentSortButton();
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

// Call this function when the page loads or when the bookmarks.js is initialized
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(applySavedSorting, 100);  // Delay the sorting application by 250 milliseconds
    highlightCurrentSortButton();
});

function getVisibleTabContent() {
    const viewedContent = document.getElementById('viewed');
    const savedContent = document.getElementById('saved');

    // Return the element that is currently visible
    if (viewedContent.style.display !== 'none') {
        return viewedContent;
    } else if (savedContent.style.display !== 'none') {
        return savedContent;
    } else {
        // Fallback in case neither is visible
        return null;
    }
}

// Moves "remove all" button to bottom after sorting
function moveRemoveAllButtonToBottom() {
    const container = Array.from(document.querySelectorAll('div#saved, div#viewed')).find(div => getComputedStyle(div).display === 'block');
    const buttonContainer = container.querySelector('.remove-all-button-container');

    if (buttonContainer) {
        container.appendChild(buttonContainer); // This moves it to the bottom
    }
}

// Function to sort by author last name
function sortByAuthor() {
    const container = getVisibleTabContent();
    let items = container.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let authorA = a.querySelector('.author').textContent.split(',')[0].trim();
        let authorB = b.querySelector('.author').textContent.split(',')[0].trim();
        return authorA.localeCompare(authorB);
    });

    itemsArray.forEach(item => container.appendChild(item));
    moveRemoveAllButtonToBottom();

    // Save the sorting type in Local Storage
    localStorage.setItem('sortingType', 'author');
    highlightCurrentSortButton();
}

// Function to sort by title, stripping non-word characters
function sortByTitle() {
    const container = getVisibleTabContent();
    let items = container.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let titleA = a.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        let titleB = b.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    itemsArray.forEach(item => container.appendChild(item));
    moveRemoveAllButtonToBottom();

    // Save the sorting type in Local Storage
    localStorage.setItem('sortingType', 'title');
    highlightCurrentSortButton();
}

// Function to sort by date extracted from author or title field
function sortByDate() {
    const container = getVisibleTabContent();
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
    moveRemoveAllButtonToBottom();

    // Save the sorting type in Local Storage
    localStorage.setItem('sortingType', 'date');
    highlightCurrentSortButton();
}

function sortByDefault() {
    const container = getVisibleTabContent();
    let items = container.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);
    refreshBookshelfUI();
    moveRemoveAllButtonToBottom();

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