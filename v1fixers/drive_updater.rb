#!/usr/bin/env ruby
require 'fileutils'

# Script purpose: update ZWIBook content, either in /home or on flash drives.

# Paths to the home directory and flash drives
HOME_PATH = "/home/globewalldesk/ZWIBook/book_zwis"
FLASH_DRIVE_PATH = '/media/globewalldesk/ZWIBook1'
DATA_SOURCE_PATH = '/media/globewalldesk/DATA/ProjectGutenberg/book_zwis'
START_ZWI = 70566  # The starting point for copying files
TARGET_FILE_COUNT = 69020  # The total number of files desired in the target directories

# File lists (should be in the same directory as this script)
FILES_TO_DELETE = 'files_to_delete.txt'

# Step (a): Ask whether to update the home directory or flash drives
def choose_location
  puts "Would you like to update (a) the home directory or (b) flash drives?"
  choice = gets.chomp.downcase
  case choice
  when 'a'
    return [HOME_PATH], 'Home Directory'
  when 'b'
    drives = Dir.glob(FLASH_DRIVE_PATH)
    if drives.empty?
      puts "No ZWIBook drives found."
      exit
    end
    puts "Detected drives:"
    drives.each { |drive| puts drive }
    puts "\nPress <Enter> to confirm the drives and continue."
    gets.chomp
    # Ensure the 'book_zwis' subdirectory is appended to the flash drives correctly
    drives_with_book_zwis = drives.map { |drive| File.join(drive, 'book_zwis') }
    return drives_with_book_zwis, 'Flash Drives'
  else
    puts "Invalid choice. Please choose 'a' or 'b'."
    exit
  end
end

# Step (b): Read file lists
def read_file_list(file)
  if File.exist?(file)
    File.readlines(file).map(&:chomp).uniq
  else
    puts "File #{file} not found."
    exit
  end
end

# Step (c): Locate 673.zwi on each drive and confirm presence
def check_files(drives)
  missing_files = []
  drives.each do |drive|
    file_path = File.join(drive, '673.zwi')
    unless File.exist?(file_path)
      missing_files << drive
    end
  end

  if missing_files.any?
    puts "The following drives do not have 673.zwi:"
    missing_files.each { |drive| puts drive }
    puts "Do you still want to proceed with deletion of the others? (y/n)"
    answer = gets.chomp.downcase
    exit unless answer == 'y'
  else
    puts "All drives have the file. Press <Enter> to proceed with deletion."
    gets.chomp
  end
end

# Step (d): Delete specified files from each drive and count successful deletions
def delete_files(drives, files_to_delete)
  total_files_to_delete = files_to_delete.size
  total_deleted = 0
  already_deleted = 0

  drives.each do |drive|
    files_to_delete.each do |file_number|
      file_path = File.join(drive, "#{file_number}.zwi")
      if File.exist?(file_path)
        FileUtils.rm(file_path)
        total_deleted += 1
        puts "Deleted: #{file_path}"
      else
        already_deleted += 1
        #puts "File not found (already deleted): #{file_path}"
      end
    end

    # Remove bookshelf.json, latest.txt, and .93 from each drive
    ['bookshelf.json', 'latest.txt', '.93'].each do |file|
      file_path = File.join(drive, file)
      if File.exist?(file_path)
        if File.directory?(file_path)
          FileUtils.rm_rf(file_path)
          puts "Deleted directory: #{file_path}"
        else
          FileUtils.rm(file_path)
          puts "Deleted file: #{file_path}"
        end
      else
        puts "File not found (already removed): #{file_path}"
      end
    end
  end

  [total_files_to_delete, total_deleted, already_deleted]
end

# Step (e): Copy files from the source to each drive and count successful copies
def replace_files(drives, start_zwi, target_file_count)
  total_copied = 0
  missing_sources = 0
  current_file_count = count_remaining_files(drives)

  # Start copying from the first uncopied file until the target count is reached
  (start_zwi..).each do |file_number|
    break if current_file_count >= target_file_count  # Stop when the target file count is reached

    file_already_exists = drives.any? { |drive| File.exist?(File.join(drive, "#{file_number}.zwi")) }
    
    next if file_already_exists  # Skip files that are already copied

    source_file = File.join(DATA_SOURCE_PATH, "#{file_number}.zwi")
    drives.each do |drive|
      dest_file = File.join(drive, "#{file_number}.zwi")  # Ensure ZWI files go inside the correct directory
      if File.exist?(source_file)
        FileUtils.cp(source_file, dest_file)
        total_copied += 1
        current_file_count += 1
        puts "Replaced: #{file_number}.zwi"
      else
        missing_sources += 1
        puts "Source file not found: #{source_file}"
      end
    end
  end

  [total_copied, missing_sources]
end

# Step (f): Count remaining files in the target directories
def count_remaining_files(drives)
  remaining_files_count = 0

  drives.each do |drive|
    remaining_files = Dir.glob(File.join(drive, '*.zwi'))
    remaining_files_count += remaining_files.size
  end

  remaining_files_count
end

# Main execution
drives, location = choose_location
puts "Operating on: #{location} - Drives: #{drives.join(', ')}"  # Debug output for location confirmation
files_to_delete = read_file_list(FILES_TO_DELETE)

check_files(drives)

# Delete files and get statistics
total_files_to_delete, total_deleted, already_deleted = delete_files(drives, files_to_delete)

# Replace files and get statistics, copying from 70566 upward until 69020 total files are reached
total_copied, missing_sources = replace_files(drives, START_ZWI, TARGET_FILE_COUNT)

# Count remaining files
remaining_files_count = count_remaining_files(drives)

# Output the statistics
puts "\nUpdate process completed."
puts "Files to delete: #{total_files_to_delete}"
puts "Files deleted: #{total_deleted}"
puts "Files already deleted: #{already_deleted}"

puts "\nFiles copied over: #{total_copied}"
puts "Missing source files: #{missing_sources}"

puts "\nTotal remaining files in target directories: #{remaining_files_count}"

# Final log of drives worked on
puts "\nOperation performed on: #{location}"
puts "Drives/Directories affected: #{drives.join("\n")}"
