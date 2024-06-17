const { contextBridge, ipcRenderer } = require('electron');

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
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
