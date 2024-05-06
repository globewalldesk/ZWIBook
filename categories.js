function onBookClick(bookId, bookMetadata) {
    let stringBookId = String(bookId);  // Ensure bookId is treated as a string
    localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));
    window.location.href = `../reader.html?bookId=${stringBookId}`;
}

// Function to sort by author last name
function sortByAuthor() {
    let items = document.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let authorA = a.querySelector('.author').textContent.split(',')[0].trim();
        let authorB = b.querySelector('.author').textContent.split(',')[0].trim();
        return authorA.localeCompare(authorB);
    });

    const parent = document.querySelector('#body > ul');
    itemsArray.forEach(item => parent.appendChild(item));

    // Collapse the popup after 1 second
    setTimeout(() => {
        document.getElementById('sortDropdown').style.display = 'none';
    }, 250);    
}

// Function to sort by title, stripping non-word characters
function sortByTitle() {
    let items = document.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let titleA = a.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        let titleB = b.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    const parent = document.querySelector('#body > ul');
    itemsArray.forEach(item => parent.appendChild(item));

    // Collapse the popup after 1 second
    setTimeout(() => {
        document.getElementById('sortDropdown').style.display = 'none';
    }, 250);
}

// Function to sort by date extracted from author or title field
function sortByDate() {
    let items = document.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        // Improved regex to find common historical date formats, handling BCE/CE more effectively
        let dateRegex = /(\d+)(\??)( BCE| CE| AD| BC)?/g;

        let getDateValue = (text) => {
            let dates = [...text.matchAll(dateRegex)];
            let earliest = dates.reduce((min, current) => {
                let year = parseInt(current[1]);
                let isBCE = current[3] && current[3].includes("BCE");
                let isUncertain = current[2] === '?';
                if (isBCE) year = -year; // Convert BCE to negative for correct chronological order
                if (isUncertain && year > 0) year -= 50; // Adjust uncertain CE dates slightly earlier
                return Math.min(min, year);
            }, Number.POSITIVE_INFINITY);
            return earliest === Number.POSITIVE_INFINITY ? new Date().getFullYear() : earliest; // Default to current year if no date found
        };

        let dateA = getDateValue(a.querySelector('.author').textContent);
        let dateB = getDateValue(b.querySelector('.author').textContent);

        return dateA - dateB; // Sort by earliest date
    });

    const parent = document.querySelector('#body > ul');
    itemsArray.forEach(item => parent.appendChild(item));

    // Collapse the popup after 1 second
    setTimeout(() => {
        document.getElementById('sortDropdown').style.display = 'none';
    }, 250);
}

window.onload = () => {
    window.electronAPI.refreshMenu();
    // Adding event listeners for sorting buttons (assuming their presence in the HTML)
    document.getElementById('sortAuthor').addEventListener('click', sortByAuthor);
    document.getElementById('sortTitle').addEventListener('click', sortByTitle);
    document.getElementById('sortDate').addEventListener('click', sortByDate);

    const sortDropdown = document.getElementById('sortDropdown');

    document.getElementById('sortBtn').addEventListener('click', () => {
        sortDropdown.style.display = sortDropdown.style.display === 'flex' ? 'none' : 'flex';
    });

    /////////////////////////////
    // Find on page functionality
    const inputField = document.getElementById('searchText');
    const findButton = document.getElementById('findButton');
    const modal = document.getElementById('myModal');
    let lastSearch = '';  // Variable to store the last searched term

    // Helper function to perform search or find next
    function performSearch(newSearch = false) {
        const currentSearchTerm = inputField.value;
        if (newSearch || currentSearchTerm !== lastSearch) {
            window.electronAPI.performFind(currentSearchTerm);
            lastSearch = currentSearchTerm;  // Update last search term
        } else {
            window.electronAPI.findNext();
        }
    }

    // Event listener for keypress in the search input to handle the Enter key
    inputField.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            window.requestAnimationFrame(() => inputField.focus());  // Refocus on the input field to allow continuous 'Enter' presses
            performSearch();
        }
    });

    // Event listener for the Find button click
    findButton.addEventListener('click', () => performSearch(true));

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
