const { EPub } = require('epub-gen-memory');
const fs = require('fs');
const path = require('path');

// Function to escape special characters in a string for use in a regular expression
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Example function to generate a test EPUB file
async function generateTestEpub() {
    const exportData = {
        title: "Test EPUB Title",
        author: "Test Author",
        inlineStyles: "h1 { color: red; }",
        externalStyles: "p { font-family: Arial; }",
        images: {
            // "test-image.jpg": "iVBORw0KGgoAAAANSUhEUgAAAAUA" // Example base64 data
        }
    };

    const exportContent = [
      {
          title: "Test Chapter 1",
          content: "<h1>Chapter 1</h1><p>This is a test chapter with an image: <!--<img src='test-image.jpg'>--></p>"
      },
      {
          title: "Test Chapter 2",
          content: "<h1>Chapter 2</h1><p>This is another test chapter.</p>"
      }
  ];

    const {
        inlineStyles,
        externalStyles,
        images,
        author,
        title
    } = exportData;

    // Combine inline and external styles
    const combinedStyles = `<style>${inlineStyles}\n${externalStyles}</style>`;

    let processedContent;

    try {
        // Process each chapter
        processedContent = exportContent.map(chapter => {
            let chapterContent = chapter.content; // Changed from 'data' to 'content'

            // Replace image paths with base64 data
            for (const [originalPath, base64Data] of Object.entries(images)) {
                const escapedOriginalPath = escapeRegExp(originalPath);
                const base64Url = `data:image/${originalPath.split('.').pop()};base64,${base64Data}`;
                chapterContent = chapterContent.replace(new RegExp(escapedOriginalPath, 'g'), base64Url);
            }

            return {
                title: chapter.title,
                content: combinedStyles + chapterContent // Changed from 'data' to 'content'
            };
        });
    } catch (error) {
        console.error('Error processing content:', error);
        return;
    }

    // Verify processedContent is an array
    console.log("processedContent:", processedContent);
    console.log("Type of processedContent:", typeof processedContent);
    console.log("Is processedContent an array?", Array.isArray(processedContent));

    if (Array.isArray(processedContent) && processedContent.length > 0) {
        const options = {
            title: title || "Generated EPUB Title",
            author: author || "Author Name"
        };

        console.log("Options:", options);

        try {
            const epubBuffer = await new EPub(exportData, exportContent).genEpub();
            const outputPath = path.join(__dirname, 'test-output.epub');
            fs.writeFileSync(outputPath, epubBuffer);

            console.log('EPUB generated successfully at:', outputPath);
        } catch (error) {
            console.error('Failed to generate EPUB:', error);
        }
    } else {
        console.error('Content is missing or incorrectly formatted.');
    }
}

generateTestEpub();
