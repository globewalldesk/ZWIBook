#!/usr/bin/env ruby

# SCRIPT PURPOSE:
# This script scans the base directory for files that end in "-0.txt" or "-h.zip".
# It renames these files so that they end in ".txt" or ".zip", respectively.

require 'fileutils'

# Directory where the files are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# Function to rename files ending in "-0.txt" or "-h.zip" in the base directory
def rename_files_in_base_directory(directory)
  Dir.glob("#{directory}/*").each do |file|
    next if File.directory?(file) # Skip directories

    # Case 1: Rename files that end with "-0.txt" to ".txt"
    if file.end_with?("-0.txt")
      new_file = file.sub("-0.txt", ".txt")
      FileUtils.mv(file, new_file)
      puts "Renamed: #{file} -> #{new_file}"

    # Case 2: Rename files that end with "-h.zip" to ".zip"
    elsif file.end_with?("-h.zip")
      new_file = file.sub("-h.zip", ".zip")
      FileUtils.mv(file, new_file)
      puts "Renamed: #{file} -> #{new_file}"
    end
  end
end

# Run the renaming function
rename_files_in_base_directory(base_directory)

puts "Processing completed."
