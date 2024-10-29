require 'fileutils'

# Base directory where the numbered directories are located
BASE_DIR = "redone_zwis_unzipped"

# Log file to track modifications
log_file = "image_path_editor_log.txt"
encoding_issue_log = "encoding_issues_log.txt"

# Function to process HTML files in a given directory
def process_html_files(directory, log_file, encoding_issue_log)
  Dir.glob("#{directory}/*.htm").each do |html_file|
    file_modified = false

    begin
      # Read the file in binary mode to avoid encoding issues
      content = File.read(html_file, mode: 'rb')
    rescue StandardError => e
      # Log any error that occurs while reading the file
      File.open(encoding_issue_log, 'a') { |f| f.puts "Error reading file: #{html_file}, Error: #{e.message}" }
      next
    end

    # Skip replacement if /data/media/ is already present
    next if content.include?('data/media/')

    # Regex to match src paths that start with 'images/' or 'music/' and replace them
    updated_content = content.gsub(/src=(['"])(images|music)\//) do |match|
      file_modified = true
      match.gsub('images/', 'data/media/images/').gsub('music/', 'data/media/music/')
    end

    # Save the updated content back to the file if modified
    if file_modified
      File.write(html_file, updated_content, mode: 'wb')  # Write back in binary mode
      File.open(log_file, 'a') { |f| f.puts "Modified: #{html_file}" }
      puts "Modified: #{html_file}"
    end
  end
end

# Function to process all numbered directories
def process_directories(base_dir, log_file, encoding_issue_log)
  Dir.foreach(base_dir) do |book_id|
    next if book_id == '.' || book_id == '..' || !book_id.match?(/^\d+$/) # Skip non-numbered directories
    
    book_dir = File.join(base_dir, book_id)

    process_html_files(book_dir, log_file, encoding_issue_log)
  end
end

# Start processing the directories
process_directories(BASE_DIR, log_file, encoding_issue_log)

puts "Processing completed. See #{log_file} for details."
puts "Check #{encoding_issue_log} for any issues."
