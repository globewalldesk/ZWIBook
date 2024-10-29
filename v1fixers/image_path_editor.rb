#!/usr/bin/env ruby
require 'fileutils'

# Base directory where the numbered directories are located
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis_unzipped"

# Log file to track the modifications and encoding issues
log_file = "image_path_editor_log.txt"
encoding_issue_log = "encoding_issues_log.txt"

# Function to process HTML files in a given directory
def process_html_files(directory, log_file, encoding_issue_log)
  Dir.glob("#{directory}/*.htm").each do |html_file|
    file_modified = false

    begin
      # Attempt to read the file as UTF-8
      content = File.read(html_file, encoding: 'UTF-8')
    rescue ArgumentError => e
      if e.message.include?('invalid byte sequence in UTF-8')
        # If UTF-8 fails, log the file and try reading it with ISO-8859-1 encoding
        File.open(encoding_issue_log, 'a') { |f| f.puts "Encoding issue in file: #{html_file}, attempting ISO-8859-1" }
        content = File.read(html_file, encoding: 'ISO-8859-1').encode('UTF-8', invalid: :replace, undef: :replace, replace: '')
      else
        raise e # Re-raise other argument errors
      end
    end

    # Ensure any remaining invalid byte sequences are replaced before further processing
    content = content.encode('UTF-8', invalid: :replace, undef: :replace, replace: '')

    # Skip replacement if /data/media/ is already present
    next if content.include?('data/media/')

    # Regex to match image/music file paths that need to be updated
    regex = /(images|music)\/.+\.\w{3,4}/

    # Look for lines that contain "images/" or "music/" and replace them
    updated_content = content.gsub(regex) do |match|
      file_modified = true
      match.gsub('images/', 'data/media/images/').gsub('music/', 'data/media/music/')
    end

    # Save the updated content back to the file if modified
    if file_modified
      File.write(html_file, updated_content)
      File.open(log_file, 'a') { |f| f.puts "Modified: #{html_file}" }
      puts "Modified: #{html_file}"
    end
  end
end

# Function to check if the images/music directories exist and have content
def check_media_content(directory)
  images_dir = File.join(directory, 'data', 'media', 'images')
  music_dir = File.join(directory, 'data', 'media', 'music')

  # Return true if either directory exists and has content
  Dir.exist?(images_dir) && !Dir.empty?(images_dir) || Dir.exist?(music_dir) && !Dir.empty?(music_dir)
end

# Function to process all numbered directories
def process_directories(base_dir, log_file, encoding_issue_log)
  Dir.foreach(base_dir) do |book_id|
    next if book_id == '.' || book_id == '..' || !book_id.match?(/^\d+$/) # Skip non-numbered directories
    
    book_dir = File.join(base_dir, book_id)

    # Check if media directories have content
    if check_media_content(book_dir)
      process_html_files(book_dir, log_file, encoding_issue_log)
    else
      print "." # Print . if no media found
    end
  end
end

# Start processing the directories
process_directories(BASE_DIR, log_file, encoding_issue_log)

puts "Processing completed. See #{log_file} for details."
puts "Check #{encoding_issue_log} for any encoding issues."
