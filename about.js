document.addEventListener('DOMContentLoaded', async () => {
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

    document.querySelectorAll('a[href^="http"]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            window.electronAPI.openExternal(link.href);
        });
    });

});
