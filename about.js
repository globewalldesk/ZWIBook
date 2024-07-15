document.addEventListener('DOMContentLoaded', async () => {
    // Set the initial zoom level from local storage
    const initialZoomLevel = window.electronAPI.getZoomLevel();
    window.electronAPI.setZoomLevel(initialZoomLevel);

    document.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
            window.electronAPI.zoom(event.deltaY);
        }
    });

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

    // Add event listener for the back button
    const backBtn = document.getElementById('backBtn');
    backBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default anchor behavior
        history.back(); // Go back to the previous page
    });

    // Open external links in the default browser
    document.querySelectorAll('a[href^="http"]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            window.electronAPI.openExternal(link.href);
        });
    });

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
            inputField.select();  // Select, so typing = delete
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

});
