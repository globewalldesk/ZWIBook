function onBookClick(bookId, bookMetadata) {
    let stringBookId = String(bookId);  // Ensure bookId is treated as a string
    localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));
    window.location.href = `../reader.html?bookId=${stringBookId}`;
}

window.onload = () => {
    function getDefaultContents() {
        const ulElement = document.querySelector('#body');
        return ulElement ? ulElement.innerHTML : ''; // Return an empty string if the element is not found
    }
    
    // Stash default book order for 'default' sort
    const defaultContents = getDefaultContents();

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
    

    /////////////////////////////
    // Sorting listeners etc.

    // Add event listeners for sorting
    document.getElementById('sortAuthor').addEventListener('click', sortByAuthor);
    document.getElementById('sortTitle').addEventListener('click', sortByTitle);
    document.getElementById('sortDate').addEventListener('click', sortByDate);
    document.getElementById('sortDefault').addEventListener('click', sortByDefault);

    highlightCurrentSortButton();

    applySavedSorting()

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

    function getSearchResultsContainer() {
        return document.getElementById('body');
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

        // Save the sorting type in Local Storage
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

        // Save the sorting type in Local Storage
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

        // Save the sorting type in Local Storage
        localStorage.setItem('sortingType', 'date');
        highlightCurrentSortButton();
    }

    function sortByDefault() {
        // Save the sorting type in Local Storage
        localStorage.setItem('sortingType', 'default');
        restoreDefaultOrder();
        highlightCurrentSortButton();
    }

    function restoreDefaultOrder() {
        // Retrieve the specific <ul> element
        const ulElement = document.querySelector('#body');
    
        // Check if the element exists to avoid errors
        if (ulElement) {
            ulElement.innerHTML = ''; // Clear existing contents of the <ul>
            ulElement.innerHTML = defaultContents; // Insert the stored default contents
        } else {
            console.log('The specified element does not exist.');
        }
    }

    function showSortModal() {
        const sortDropdown = document.getElementById('sortDropdown');
        sortDropdown.style.display = 'flex';  // Display the sort options modal
    }
    
    function hideSortModal() {
        const sortDropdown = document.getElementById('sortDropdown');
        sortDropdown.style.display = 'none';   // Hide the sort options modal
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
                sortByDefault();
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
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function(event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
        }
    };

};
