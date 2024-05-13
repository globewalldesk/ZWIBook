require 'json'
require 'fileutils'
require 'csv'
require 'cgi'

# Path to the directory where HTML files are stored
html_dir = './html'

# Remove the html directory and all its contents if it exists
FileUtils.rm_rf(html_dir) if File.directory?(html_dir)

# Create the directory for HTML files
FileUtils.mkdir_p(html_dir)

# Read the codes from the CSV file
codes = CSV.read('codes.csv', col_sep: '|', headers: false)
codes << ["Amisc", "Misc and Other"]

# Initialize a hash to store categories
categories = {}

# Process each code in the CSV
codes.each do |row|
  code, description = row
  parent_code = code[0] # Get the first letter of the code for top-level categories

  # Organize codes into a hash where each top-level category has its subcategories
  categories[parent_code] ||= {description: nil, subcategories: []}
  if code.length == 1
    categories[parent_code][:description] = description # Capture the description for single-letter categories
  else
    categories[parent_code][:subcategories] << [code, description]
  end
end

# Load LoCC counts from CSV
locc_counts = Hash.new(0) # Initialize all counts to 0 by default

CSV.foreach('locc_counts.csv', headers: true) do |row|
  code = row['Cleaned LoCC Code']
  count = row['Count'].to_i # Ensure the count is an integer

  # Update count for the exact code
  locc_counts[code] += count

  # If the code is two letters long, also add its count to the corresponding one-letter category
  locc_counts[code[0]] += count if code.length == 2
end

# Generate the landing page linking to all top-level category pages
File.open('./html/categories.html', 'w') do |file|
  file.puts <<~HTML
  <html>
  <head>
  <title>Categories</title>
  <link rel="stylesheet" href="../stylesheet.css">
  <script src="../categories.js"></script>
  </head>
  <body>
  <!-- The Find on Page Modal -->
  <div id="findOnPage" class="modal">
      <!-- Modal content -->
      <div class="modal-content">
          <input type="text" id="searchText" placeholder="Enter text to find..." tabindex="0">
          <button id="findButton">Find</button>
      </div>
  </div>
  <div id="header">
    <div id="header-content">
      <div class="header-container">
        <a id="backBtn" class="header-btn" href="#">
            <img src="data:image/svg+xml,%3Csvg width='32' height='32' fill='currentColor' class='bi bi-arrow-left' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' d='M30 16a1 1 0 0 0-1-1H5.416l6.293-6.292a1.001 1.001 0 1 0-1.416-1.415l-8 7.999a1 1 0 0 0 0 1.416l8 8a1.001 1.001 0 0 0 1.416-1.416L5.416 17H29a1 1 0 0 0 1-1' style='stroke-width:1.99987;fill:%23fff;fill-opacity:1'/%3E%3C/svg%3E">
        </a>
        <a id="search" class="header-btn" href="../search.html">
            <img src="../images/icons/search.svg" title="Search took titles">
        </a>
      </div>
      <h1 id="headTitle">Browse Categories</h1>
      <div class="header-container">
        <a id="bookshelfAddRemove" class="header-btn" href="#" style="display: none">
            <img src="../images/icons/add-book.svg" title="Bookshelf add/remove">
        </a>
        <a id="savedBooksLink" class="header-btn" href="../bookshelf.html">
            <img src="../images/icons/bookshelf.svg" title="Viewed/saved books">
        </a>
      </div>
    </div>
    <a id="sortBtn" class="header-btn" href="#" style="display:none"><!-- must be here or JS breaks -->
      <img src="../images/icons/sort.svg" title="Re-sort books">
    </a>
      <div id="sortDropdown" class="dropdown" style="display: none">
      <a id="sortAuthor" class="dropdown-btn" href="#">Sort by author</a>
      <a id="sortTitle" class="dropdown-btn" href="#">Sort by title</a>
      <a id="sortDate" class="dropdown-btn" href="#">Sort by date</a>
      <a id="sortDefault" class="dropdown-btn" href="#">Default sort</a>
    </div>
  </div>
  <div id="body">
    <h1>Categories</h1>
    <ul>
HTML
  categories.keys.sort.each do |code|
    count = locc_counts[code] || '0'  # Default to '0' if no count is available
    file.puts "<li><a href='#{code}.html' id='#{code}'>#{categories[code][:description]} (#{code})</a> <span class='count'>#{count}</span></li>"
  end
  file.puts '</ul>'
  file.puts '</div></body></html>'
end

# Generate secondary-level pages for each category
categories.each do |parent_code, details|
  File.open("./html/#{parent_code}.html", 'w') do |file|
    file.puts <<~HTML
    <html>
    <head>
    <title>Category</title>
    <link rel="stylesheet" href="../stylesheet.css">
    <script src="../categories.js"></script>
    </head>
    <body>
    <!-- The Find on Page Modal -->
      <div id="findOnPage" class="modal">
      <!-- Modal content -->
      <div class="modal-content">
          <input type="text" id="searchText" placeholder="Enter text to find..." tabindex="0">
          <button id="findButton">Find</button>
      </div>
    </div>
    <div id="header">
      <div id="header-content">
        <div class="header-container">
          <a id="backBtn" class="header-btn" href="#">
              <img src="data:image/svg+xml,%3Csvg width='32' height='32' fill='currentColor' class='bi bi-arrow-left' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' d='M30 16a1 1 0 0 0-1-1H5.416l6.293-6.292a1.001 1.001 0 1 0-1.416-1.415l-8 7.999a1 1 0 0 0 0 1.416l8 8a1.001 1.001 0 0 0 1.416-1.416L5.416 17H29a1 1 0 0 0 1-1' style='stroke-width:1.99987;fill:%23fff;fill-opacity:1'/%3E%3C/svg%3E">
          </a>
          <a id="search" class="header-btn" href="../search.html">
              <img src="../images/icons/search.svg" title="Search book titles">
          </a>
        </div>
        <h1 id="headTitle">Category: #{details[:description]} (#{parent_code})</h1>
        <div class="header-container">
          <a id="sortBtn" class="header-btn" href="#">
            <img src="../images/icons/sort.svg" title="Re-sort books">
          </a>
          <div id="sortDropdown" class="dropdown" style="display: none">
            <a id="sortAuthor" class="dropdown-btn" href="#">Sort by author</a>
            <a id="sortTitle" class="dropdown-btn" href="#">Sort by title</a>
            <a id="sortDate" class="dropdown-btn" href="#">Sort by date</a>
            <a id="sortDefault" class="dropdown-btn" href="#">Default sort</a>
          </div>
          <a class="header-btn" href="categories.html">
            <img src="../images/icons/categories.svg" title="Browse categories">
          </a>
          <a id="savedBooksLink" class="header-btn" href="../bookshelf.html">
              <img src="../images/icons/bookshelf.svg" title="Viewed/saved books">
          </a>
        </div>
      </div>
    </div>
    <div id="body">
    <ul>
HTML
    details[:subcategories].each do |code, description|
      next if locc_counts[code] == 0
      count = locc_counts[code] || '0'  # Default to '0' if no count is available
      file.puts "<li><a href='#{code}.html'>#{description} (#{code})</a> <span class='count'>#{count}</span></li>"
    end
    file.puts "<p>&nbsp;</p>"
  end
end

# Load the JSON data from 'metadatabase.json'
file = File.read('metadatabase.json')
books = JSON.parse(file)
# Update LoCC codes to remove numbers and ensure each LoCC is treated correctly
books.each do |book|
  locc_codes = Array(book['LoCC'])  # Wraps in array if not already one, handles empty string by making it an empty array

  # Update codes to remove trailing numbers, only if they exist
  locc_codes.map! do |code|
    code.gsub(/[0-9]+\.?\d+?$/, '')  # Remove trailing numbers with regex
  end

  # Assign back updated codes to the book
  book['LoCC'] = locc_codes
end

# Read the codes from the CSV file
codes = CSV.read('codes.csv', col_sep: '|', headers: false)

# Create a method to format titles as specified
def format_title(title)
  title.gsub!('""', '"')
  match = title.match(/([-:;])(?!\w)/)  # Find the first occurrence of ':', ';', or '-' not surrounded by \w characters
  if match
    index = match.begin(0)
    return title[0..index] + "<br><span class='subtitle'>" + title[index+1..-1].strip + "</span>"
  else
    return title
  end
end

notfound = []

# Create or update HTML files for each LoCC code in each book
books.each do |book|
  next if book['LoCC'].nil? || book['LoCC'].empty?

  book['LoCC'].each do |code|
    code.sub!(/\d+\.?\d+?$/, '')
    # Ensure a directory and HTML file for each LoCC code
    description = codes.find { |pair| pair[0] == code.upcase }
    code = "Amisc" if code == ''
    description = "Misc and Other" unless description
    description = description[1] unless description == "Misc and Other"
    notfound << code unless description
    filename = "./html/#{code}.html"
    unless File.exist?(filename)
      File.open(filename, 'w') do |f|
        f.puts <<~HTML
        <html>
        <head>
        <title>Subcategory</title>
        <link rel="stylesheet" href="../stylesheet.css">
        <script src="../categories.js"></script>
        </head>
        <body>
          <!-- The Find on Page Modal -->
          <div id="findOnPage" class="modal">
              <!-- Modal content -->
              <div class="modal-content">
                  <input type="text" id="searchText" placeholder="Enter text to find..." tabindex="0">
                  <button id="findButton">Find</button>
              </div>
          </div>
          <div class="sort-overlay" id="sortOverlay"></div>
          <div id="header">
            <div id="header-content">
              <div class="header-container">
                <a id="backBtn" class="header-btn" href="#">
                    <img src="data:image/svg+xml,%3Csvg width='32' height='32' fill='currentColor' class='bi bi-arrow-left' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' d='M30 16a1 1 0 0 0-1-1H5.416l6.293-6.292a1.001 1.001 0 1 0-1.416-1.415l-8 7.999a1 1 0 0 0 0 1.416l8 8a1.001 1.001 0 0 0 1.416-1.416L5.416 17H29a1 1 0 0 0 1-1' style='stroke-width:1.99987;fill:%23fff;fill-opacity:1'/%3E%3C/svg%3E">
                </a>
                <a id="search" class="header-btn" href="../search.html">
                    <img src="../images/icons/search.svg" title="Search book titles">
                </a>
              </div>
              <h1 id="headTitle">#{description} (#{code})</h1>
              <div class="header-container">
                  <a id="sortBtn" class="header-btn" href="#">
                    <img src="../images/icons/sort.svg" title="Re-sort books">
                  </a>
                  <div id="sortDropdown" class="dropdown" style="display: none">
                    <a id="sortAuthor" class="dropdown-btn" href="#">Sort by author</a>
                    <a id="sortTitle" class="dropdown-btn" href="#">Sort by title</a>
                    <a id="sortDate" class="dropdown-btn" href="#">Sort by date</a>
                    <a id="sortDefault" class="dropdown-btn" href="#">Default sort</a>
                  </div>
                  <a class="header-btn" href="categories.html">
                    <img src="../images/icons/categories.svg" title="Browse categories">
                  </a>      
                  <a id="savedBooksLink" class="header-btn" href="../bookshelf.html">
                      <img src="../images/icons/bookshelf.svg" title="Viewed/saved books">
                  </a>
              </div>
            </div>
          </div>
          <div id="body">
            <ul>
HTML
      end
    end

    bookJSON = CGI.escapeHTML(book.to_json)

    # Append the book entry to the corresponding HTML file
    File.open(filename, 'a') do |f|
      formatted_title = format_title(book['Title'])
      # Ensure CreatorNames is treated as an array, even if it's undefined or in a different format
      creator_names = Array(book['CreatorNames']).join(', ')
      f.puts "<div class='searchResultItem'>"
      f.puts "<a href='javascript:void(0);' onclick=\"onBookClick(#{book['PG_ID']}, #{bookJSON});\" class='title'>#{formatted_title}</a>"
      f.puts "<div class='author'>#{creator_names}</div>"
      f.puts "</div>"
    end
  end
end

# Close all HTML files properly
Dir.glob('./html/*.html') do |filename|
  File.open(filename, 'a') do |f|
    f.puts "</ul></div>"
    f.puts "</body></html>"
  end
end

puts 'HTML files have been generated successfully.'
