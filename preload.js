const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateBookshelf: (bookMetadata) => ipcRenderer.send('update-bookshelf', bookMetadata),
    onBookshelfUpdated: (func) => {
        ipcRenderer.once('bookshelf-update-confirmation', (event, ...args) => func(...args));
    },
    requestBookshelfData: () => ipcRenderer.invoke('get-bookshelf-data'),
    sendLastReadPosition: (data) => ipcRenderer.send('save-last-read-position', data),
    sendBookmarkUpdate: (data) => ipcRenderer.send('update-bookmark', data),
    requestBookmarks: (bookId) => ipcRenderer.invoke('get-bookmarks', bookId),
    performFind: (text) => ipcRenderer.send('perform-find', text),
    findNext: () => ipcRenderer.send('find-next'),
    onToggleFindModal: (callback) => ipcRenderer.on('toggle-find-modal', callback),
    onChooseFont: (callback) => ipcRenderer.on('choose-font', (event) => callback()),
    applyFont: (fontName) => ipcRenderer.send('apply-font', fontName),
    fetchZWI: (bookId) => ipcRenderer.invoke('fetch-zwi', bookId),
    performSearch: (query, searchType) => ipcRenderer.invoke('perform-search', { query, searchType }),
    fetchBookMetadata: (bookId) => ipcRenderer.invoke('fetch-book-metadata', bookId),
    updateGutenbergMenu: (bookId) => ipcRenderer.send('update-gutenberg-menu', bookId),
    refreshMenu: () => ipcRenderer.send('refresh-menu'),
    startZWIExport: (callback) => ipcRenderer.on('export-zwi', callback),
    finishZwiExport: (bookId) => ipcRenderer.send('finish-export-zwi', bookId),
    sendNavigate: (url) => {
        console.log(`sendNavigate called with URL: ${url}`);
        ipcRenderer.send('navigate', url);
    },
    downloadImage: (imagePath) => ipcRenderer.invoke('download-image', imagePath),
    onDownloadImageRequest: (callback) => ipcRenderer.on('download-image-request', callback),
    sendBookInfo: (bookInfo) => ipcRenderer.send('send-book-info', bookInfo),
    zoom: (deltaY) => ipcRenderer.send('zoom', deltaY),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    showConfirmDialog: (message) => ipcRenderer.sendSync('show-confirm-dialog', message),
    showAlertDialog: (message) => ipcRenderer.sendSync('show-alert-dialog', message),
    toggleSpellChecking: (callback) => ipcRenderer.on('toggle-spell-checking', callback),
    loadHlnotesData: (bookId) => ipcRenderer.invoke('read-hlnotes-data', bookId),
    saveHlnotesData: (bookId, data) => ipcRenderer.invoke('write-hlnotes-data', bookId, data),
    getZoomFactor: () => webFrame.getZoomFactor()
});

// Loads the same on all pages
ipcRenderer.on('toggle-spell-checking', (event, isEnabled) => {
    document.body.spellcheck = isEnabled;
    
    // Optional: Save the state to localStorage
    localStorage.setItem('spellCheckEnabled', isEnabled);
});

document.addEventListener('DOMContentLoaded', () => {
    const spellCheckEnabled = localStorage.getItem('spellCheckEnabled') === 'true';;
    if (spellCheckEnabled !== null) {
        document.body.spellcheck = (spellCheckEnabled === 'true');
    }
});
