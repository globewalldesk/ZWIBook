#!/usr/bin/env ruby
require 'fileutils'

# Purpose:
# This script takes unzipped PG folders, without -h or -0 (for that, use h_remover.rb),
# and when there is another -h or -0 folder inside it, it replaces that folder with the folder's contents.

# Base directory where the unzipped PG folders are located
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"

# Function to process each numbered directory
def process_directories(base_dir)
  Dir.foreach(base_dir) do |book_id|
    next if book_id == '.' || book_id == '..' || !book_id.match?(/^\d+$/) # Skip non-numbered directories

    book_path = File.join(base_dir, book_id)

    # Check for any -h or -0 folders inside the numbered directory
    Dir.foreach(book_path) do |subdir|
      next if subdir == '.' || subdir == '..' # Skip current and parent directories

      # Identify any -h or -0 folders
      if subdir.match?(/-(h|0)$/)
        subdir_path = File.join(book_path, subdir)
        
        if Dir.exist?(subdir_path)
          # Move the contents of the -h or -0 folder to the parent directory
          Dir.foreach(subdir_path) do |file|
            next if file == '.' || file == '..' # Skip current and parent directories
            
            source_file = File.join(subdir_path, file)
            destination_file = File.join(book_path, file)

            # Move the file or directory to the parent folder
            FileUtils.mv(source_file, destination_file)
            puts "Moved: #{source_file} -> #{destination_file}"
          end

          # Remove the now-empty -h or -0 folder
          FileUtils.rm_rf(subdir_path)
          puts "Deleted empty folder: #{subdir_path}"
        end
      end
    end
  end
end

# Start processing the directories
process_directories(BASE_DIR)

puts "Processing completed."
