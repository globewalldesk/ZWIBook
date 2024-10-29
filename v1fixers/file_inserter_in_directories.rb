#!/usr/bin/env ruby

# SCRIPT PURPOSE:
# This script scans the base directory for:
# 1. Subdirectories that represent book IDs (numerals).
# 2. Files in the base directory that correspond to these book IDs and have a ".txt" or ".zip" extension.
# 3. Files in the base directory that consist of exactly five digits and renames them with a ".txt" extension.
# 4. If a directory does not exist for a five-digit book ID but a .txt or .zip file exists, create the directory.

require 'fileutils'

# Directory where the files and subdirectories are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# Function to move corresponding .txt or .zip files into their respective subdirectories, creating new ones if needed
def move_files_to_subdirectories(directory)
  # Step 1: List all subdirectories and extract the book ID
  Dir.glob("#{directory}/*").each do |subdirectory|
    next unless File.directory?(subdirectory) # Process only directories
    book_id = File.basename(subdirectory) # Extract the book ID (numeral)

    # Step 2: Find corresponding .txt and .zip files in the base directory
    txt_file = File.join(directory, "#{book_id}.txt")
    zip_file = File.join(directory, "#{book_id}.zip")

    # Move .txt file to the corresponding subdirectory
    if File.exist?(txt_file)
      FileUtils.mv(txt_file, subdirectory)
      puts "Moved: #{txt_file} -> #{subdirectory}/"
    end

    # Move .zip file to the corresponding subdirectory
    if File.exist?(zip_file)
      FileUtils.mv(zip_file, subdirectory)
      puts "Moved: #{zip_file} -> #{subdirectory}/"
    end
  end

  # Step 3: For files without an existing directory, create the directory and move the file
  Dir.glob("#{directory}/*").each do |file|
    next if File.directory?(file) # Skip directories
    base_name = File.basename(file, ".*") # Get the filename without extension

    # Check if the filename consists of exactly five digits
    if base_name.match?(/^\d{5}$/)
      subdirectory = File.join(directory, base_name) # Subdirectory that corresponds to the book ID

      # Check if the subdirectory exists
      unless Dir.exist?(subdirectory)
        Dir.mkdir(subdirectory) # Create the subdirectory
        puts "Created directory: #{subdirectory}"
      end

      # Move the file into the new or existing subdirectory
      FileUtils.mv(file, subdirectory)
      puts "Moved: #{file} -> #{subdirectory}/"
    end
  end
end

# Run the function to move files to subdirectories
move_files_to_subdirectories(base_directory)

puts "Processing completed."
