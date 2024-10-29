#!/usr/bin/env ruby
require 'fileutils'

# Script purpose: update ZWIBook content, either in /home or on flash drives.

# Paths to the home directory and flash drives
HOME_PATH = "/home/globewalldesk/ZWIBook/book_zwis"
FLASH_DRIVE_PATH = '/media/globewalldesk/ZWIBook*'
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
def check_files(drive)
  file_path = File.join(drive, '673.zwi')
  unless File.exist?(file_path)
    puts "Drive #{drive} does not have 673.zwi."
    puts "Do you still want to proceed with deletion on this drive? (y/n)"
    answer = gets.chomp.downcase
    exit unless answer == 'y'
  else
    puts "Drive #{drive} has 673.zwi. Press <Enter> to proceed with deletion on this drive."
    gets.chomp
  end
end

# Step (d): Delete specified files from the drive and count successful deletions
def delete_files(drive, files_to_delete)
  total_files_to_delete = files_to_delete.size
  total_deleted = 0
  already_deleted = 0

  files_to_delete.each do |file_number|
    file_path = File.join(drive, "#{file_number}.zwi")
    if File.exist?(file_path)
      FileUtils.rm(file_path)
      total_deleted += 1
      puts "Deleted: #{file_path}"
    else
      already_deleted += 1
      # Optionally, you can log that the file was already deleted
    end
  end

  # Remove additional files from the current drive
  ['bookshelf.json', 'latest.txt', '.93', '36567.html'].each do |file|
    file_path = File.join(drive, file)
    if File.exist?(file_path)
      if File.directory?(file_path)
        FileUtils.rm_rf(file_path)
        puts "Deleted directory: #{file_path}"
      else
        FileUtils.rm(file_path)
        puts "Deleted file: #{file_path}"
      end
    end
  end

  [total_files_to_delete, total_deleted, already_deleted]
end

# Step (e): Copy files from the source to the drive and count successful copies
def replace_files(drive, start_zwi, target_file_count)
  total_copied = 0
  missing_sources = 0
  current_file_count = count_remaining_files(drive)

  file_number = start_zwi
  while current_file_count < target_file_count
    source_file = File.join(DATA_SOURCE_PATH, "#{file_number}.zwi")
    dest_file = File.join(drive, "#{file_number}.zwi")

    if File.exist?(dest_file)
      # File already exists on this drive, skip copying
    else
      if File.exist?(source_file)
        FileUtils.cp(source_file, dest_file)
        total_copied += 1
        current_file_count += 1
        puts "Copied to #{drive}: #{file_number}.zwi"
      else
        missing_sources += 1
        puts "Source file not found: #{source_file}"
      end
    end

    file_number += 1
  end

  [total_copied, missing_sources]
end

# Step (f): Count remaining files in the target directory
def count_remaining_files(drive)
  remaining_files = Dir.glob(File.join(drive, '*.zwi'))
  remaining_files_count = remaining_files.size
  remaining_files_count
end

# Step (g): Output the highest-numbered ZWI file on the drive
def output_highest_numbered_file(drive)
  zwi_files = Dir.glob(File.join(drive, '*.zwi')).map { |f| File.basename(f, '.zwi').to_i }
  if zwi_files.empty?
    puts "No ZWI files found in #{drive}"
  else
    highest_zwi = zwi_files.max
    puts "The highest-numbered ZWI file on #{drive} is: #{highest_zwi}.zwi"
  end
end

# Main execution
drives, location = choose_location
puts "Operating on: #{location}"
puts "Drives/Directories to be processed: #{drives.join("\n")}"  # Confirm detected drives
files_to_delete = read_file_list(FILES_TO_DELETE)

drives.each do |drive|
  puts "\nProcessing drive: #{drive}"

  check_files(drive)

  # Delete files and get statistics
  total_files_to_delete, total_deleted, already_deleted = delete_files(drive, files_to_delete)

  # Replace files and get statistics
  total_copied, missing_sources = replace_files(drive, START_ZWI, TARGET_FILE_COUNT)

  # Count remaining files
  remaining_files_count = count_remaining_files(drive)

  # Output the statistics for the current drive
  puts "\nUpdate process completed for drive: #{drive}"
  puts "Files to delete: #{total_files_to_delete}"
  puts "Files deleted: #{total_deleted}"
  puts "Files already deleted: #{already_deleted}"

  puts "\nFiles copied over: #{total_copied}"
  puts "Missing source files: #{missing_sources}"

  puts "\nTotal remaining files in target directory: #{remaining_files_count}"

  # Output the highest-numbered ZWI file on the current drive
  puts "\nOutputting the highest-numbered ZWI file on drive: #{drive}"
  output_highest_numbered_file(drive)
end

puts "\nOperation completed on all selected drives/directories."
