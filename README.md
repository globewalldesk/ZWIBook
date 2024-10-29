# ZWIBook

THIS IS A BACKUP OF THE GITLAB REPO (WHICH SHOULD BE MORE CURRENT).

**Note: this readme was generated automatically by ChatGPT-4. It might not be quite right.**

ZWIBook is a digital library application developed by the Knowledge Standards Foundation (KSF). It allows users to find, read, highlight, and take notes on books from the extensive Project Gutenberg collection. The primary goal is to preserve knowledge and make it accessible offline, providing features that support research and personal reading.

## Features

### General Features
- **Access to Project Gutenberg Collection**: Contains over 69,000 texts, mainly books published before 1920.
- **Digital Preservation**: Ensures digital censorship resistance by distributing knowledge through thumb drives.
- **User Control**: Allows users to manage their bookshelf, bookmarks, highlights, and notes locally.

### Reader Features
- **Search and Browse Books**: Easily find books by title or author.
- **Bookmarking**: Hover over a paragraph and click the bookmark icon to save your place.
- **Highlighting and Notes**: Select text to highlight it in different colors or add notes with markdown support.
- **Page Navigation**: Use page buttons to navigate through the book.
- **Font Customization**: Change font styles and sizes, with preferences saved for future use.
- **Research Tools**: Right-click on selected text to search related books, define words, translate passages, or ask AI for explanations.

### Bookshelf Features
- **Manage Selections**: Switch between "Saved" and "Viewed" tabs to manage your book collection.
- **Sorting and Filtering**: Sort books by author, title, or date. Use the "Remove All" button to clear lists with 20 or more books.
- **Export/Import Data**: Easily export or import highlight and note data.

### Printing and Downloading
- **Save as PDF**: Save books as PDFs for printing or offline reading.
- **Export ZWI**: Export the original ZWI files, which are ZIP files containing the book's HTML and TXT files.
- **Project Gutenberg Files**: Access the original Project Gutenberg files in various formats.

### Digital Signature Verification
- **Verify ZWI Files**: Follow steps to ensure the integrity and authenticity of a ZWI file using digital signatures.

### Troubleshooting and Q&A
- **Why Use ZWIBook?**: Local control over your library and research tools that make it unique.
- **Share Notes**: Potential for sharing notes with other users.
- **Move Book Files**: Instructions for transferring book files from the thumb drive to your computer.
- **Backup Data**: Recommended steps for backing up your bookshelf, bookmarks, highlights, and notes.
- **Report Issues**: Contact larry@encyclosphere.org for support with major bugs or unreadable books.

### Additional Notes and Disclaimers
- **Rendering of Books**: Books should be well-rendered, but some design errors might remain.
- **Software "As-Is"**: ZWIBook is provided as a "thank-you" gift and is presented "as-is" without guarantees.
- **Respecting Project Gutenberg License**: Distribution complies with the Project Gutenberg license.

## Installation

1. **Installation**: Copy the ZWIBook application to your thumb drive.
2. **Running ZWIBook**: Open the application and start exploring the Project Gutenberg collection.
3. **Managing Your Library**: Use the bookshelf to save and view books, take notes, and highlight text.

## Development

### Prerequisites
- **Node.js and npm**: Ensure you have Node.js and npm installed.
- **Electron**: This project uses Electron to run the app.

### Getting Started
1. **Clone the repository**: `git clone https://gitlab.com/your-repo/zwibook.git`
2. **Install dependencies**: Navigate to the project directory and run `npm install`.
3. **Start the application**: Run `npm start` to launch the app.

### Directory Structure
- **/book_zwis**: Directory containing all the book ZWI files.
- **/images**: Directory containing icons and images used in the app.
- **/html**: Directory containing the HTML files for different views.
- **/stylesheets**: Directory containing the CSS files for styling.
- **/scripts**: Directory containing the JavaScript files for app functionality.

### Main Components
- **main.js**: The main process script, managing application lifecycle and system events.
- **preload.js**: The script that bridges between the main process and the renderer process.
- **renderer.js**: The script for rendering the UI and handling user interactions.
- **index.html**: The main HTML file that loads the app interface.

### Building the App
To build the app for distribution, run the following command:
```
npm run build
```
This will package the app using Electron Packager.

## Contributing

We welcome contributions from the community. Here’s how you can help:
- **Bug Reports**: Submit detailed bug reports in the GitLab issue tracker.
- **Feature Requests**: Suggest new features or enhancements.
- **Code Contributions**: Fork the repository, make your changes, and submit a pull request.

### Code Style
- Follow the existing code style.
- Ensure your code is well-documented.

### Testing
- Write unit tests for new features.
- Ensure existing tests pass before submitting a pull request.

## License

ZWIBook is licensed under the MIT License.

## Contact and Support

For any issues, feature requests, or contributions, please contact larry@encyclosphere.org. For more details about the Knowledge Standards Foundation, visit [Encyclosphere](https://encyclosphere.org).
