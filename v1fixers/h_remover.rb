#!/usr/bin/env ruby
require 'fileutils'

# Base directory where files are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"

# Function to rename top-level directories by removing "-h" and "-0"
def remove_suffix_from_directories(directory)
  Dir.glob("#{directory}/*").each do |path|
    next unless File.directory?(path) # Only process directories

    # Generate the new directory name by removing "-h" or "-0" from the name
    new_path = path.gsub(/-(h|0)$/, '')
    if new_path != path
      FileUtils.mv(path, new_path)
      puts "Renamed directory: #{path} -> #{new_path}"
    end
  end
end

# Function to rename .htm and .txt files inside the target directory by removing "-h" and "-0"
def remove_suffix_from_files(directory)
  Dir.glob("#{directory}/**/*.{htm,txt}").each do |path|
    next if File.directory?(path) # Skip directories

    # Generate the new filename by removing "-h" or "-0" before the file extension
    new_path = path.gsub(/-(h|0)(\.[^.]+)$/, '\2')
    if new_path != path
      FileUtils.mv(path, new_path)
      puts "Renamed file: #{path} -> #{new_path}"
    end
  end
end

# Run the renaming functions on the base directory
remove_suffix_from_directories(base_directory)
remove_suffix_from_files(base_directory)

puts "Processing completed."
