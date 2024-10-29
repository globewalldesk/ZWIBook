#!/usr/bin/env ruby
require 'fileutils'
require 'zip'

# Base directories
BASE_DIR = "redone_zwis"
DEST_DIR = "redone_zwis_unzipped"

# Function to create a .zwi (zip) archive for a single numbered directory
def create_zwi_archive(directory)
  book_id = File.basename(directory)

  # Path to the .zwi file
  zwi_file = File.join(BASE_DIR, "#{book_id}.zwi")

  puts "Creating ZWI archive for #{book_id}..."

  # Create the .zwi (zip) file
  Zip::File.open(zwi_file, Zip::File::CREATE) do |zipfile|
    Dir.glob("#{directory}/**/*").each do |file|
      next if File.directory?(file)

      # Create a relative path by stripping off the base directory
      relative_path = file.sub("#{directory}/", '')

      # Add the file to the zip archive using the relative path
      zipfile.add(relative_path, file)
      puts "Adding file: #{relative_path}"
    end
  end

  puts "Created #{zwi_file}"

  # Move the source directory to DEST_DIR
  target_dir = File.join(DEST_DIR, book_id)
  FileUtils.mv(directory, target_dir)
  puts "Moved #{directory} to #{target_dir}"
end

# Function to process directories and create .zwi files
def process_directories(base_dir)
  directories = Dir.glob("#{base_dir}/*/").sort  # Take all directories
  if directories.empty?
    puts "No directories found in #{base_dir}."
  else
    puts "Found directories: #{directories.join(', ')}"
  end

  directories.each do |directory|
    create_zwi_archive(directory)
  end
end

# Start processing directories
if Dir.exist?(BASE_DIR)
  process_directories(BASE_DIR)
else
  puts "Base directory #{BASE_DIR} does not exist!"
end

puts "ZWI creation and directory move completed."
