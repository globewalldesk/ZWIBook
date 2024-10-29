#!/usr/bin/env ruby
require 'fileutils'

# Base directory where the numbered directories are located
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"

# Function to check if a directory is empty (no files or subdirectories)
def directory_empty?(dir_path)
  Dir.children(dir_path).empty?
end

# Function to process each numbered directory and delete empty media/data folders
def clean_empty_media_directories(base_dir)
  Dir.foreach(base_dir) do |book_id|
    next if book_id == '.' || book_id == '..' || !book_id.match?(/^\d+$/) # Skip non-numbered directories

    book_path = File.join(base_dir, book_id)
    media_path = File.join(book_path, 'data', 'media')
    data_path = File.join(book_path, 'data')

    # Check if /data/media exists and is completely empty
    if Dir.exist?(media_path) && directory_empty?(media_path)
      puts "Deleting empty media directory: #{media_path}"
      FileUtils.rm_rf(media_path) # Delete /media if it's empty

      # Now check if /data is also empty and delete it if so
      if Dir.exist?(data_path) && directory_empty?(data_path)
        puts "Deleting empty data directory: #{data_path}"
        FileUtils.rm_rf(data_path) # Delete /data if it's empty
      end
    end
  end
end

# Start processing the directories
clean_empty_media_directories(BASE_DIR)

puts "Cleaning completed."
