puts "Enter drive number (e.g., 'none' for no number, '1' for '1', '2' for '2', etc.):"
drive_number = gets.chomp
drive_number = '' if drive_number == "none"
# Validation: exit if input is not '' or a single digit
unless drive_number == '' || drive_number.match?(/^\d+$/)
  puts "Invalid input. Please enter 'none' or number (e.g., '1', '2')."
  exit
end

##################### BEGIN drive_duplicator.rb

#!/usr/bin/env ruby
require 'fileutils'

# Configuration paths and file lists
FLASH_DRIVE_PATH = "/media/globewalldesk/ZWIBook#{drive_number}"
SOURCE_A_DIRECTORY = '/home/globewalldesk/ZWIBook'
BOOK_ZWIS_PATH = 'book_zwis'
FILES_A_TO_DELETE = 'files_to_delete.txt'
SAMPLE_BOOKSHELF_NOTES = 'sample_bookshelf_notes'
START_HERE_FILE = 'START_HERE.pdf'

# Rsync options
RSYNC_OPTIONS = '-av --progress'

# Top-level files and directories to delete on each drive
TOP_LEVEL_DIRECTORIES = [
  'Linux', 'Mac', 'mac', 'mac-arm64', 'Windows', 
  'System Volume Information', '.fseventsd', '.Spotlight-V100'
]
TOP_LEVEL_FILES = [
  'builder-debug.yml', 'builder-effective-config.yaml',
  'ZWIBook.dmg', 'ZWIBook.dmg.blockmap', '._Mac', '.DS_Store', 
  'start_here (1).pdf', 'START_HERE.pdf'
]

# Additional specific items to delete within `/book_zwis`
BOOK_ZWIS_SPECIFIC_ITEMS = ['bookshelf.json', 'latest.txt', '.93', '36567.html', 'ZWIBook.dmg.blockmap']

# Load list of files to delete from `book_zwis`
def load_files_to_delete(file)
  if File.exist?(file)
    File.readlines(file).map(&:chomp).uniq
  else
    puts "File #{file} not found."
    exit
  end
end

# Function to display a progress bar
def show_progress_bar(operation, progress, total)
  percent_complete = (progress.to_f / total * 100).to_i
  print "\r#{operation}: #{percent_complete}% completed (#{progress}/#{total})"
end

# Function to delete specified files and directories from a drive
def delete_files_and_directories(drive, book_zwis_files)
  total_deletions = TOP_LEVEL_DIRECTORIES.size + TOP_LEVEL_FILES.size + book_zwis_files.size + BOOK_ZWIS_SPECIFIC_ITEMS.size
  completed_deletions = 0

  # Delete files from book_zwis directory
  book_zwis_path = File.join(drive, BOOK_ZWIS_PATH)
  book_zwis_files.each do |file_name|
    file_path = File.join(book_zwis_path, "#{file_name}.zwi")
    if File.exist?(file_path)
      FileUtils.rm(file_path)
      puts "Deleted: #{file_path}"
    end
    completed_deletions += 1
    show_progress_bar("Deleting from #{drive}", completed_deletions, total_deletions)
  end

  # Delete specific items in book_zwis
  BOOK_ZWIS_SPECIFIC_ITEMS.each do |item|
    item_path = File.join(book_zwis_path, item)
    if File.directory?(item_path)
      FileUtils.rm_rf(item_path)
      puts "Deleted directory: #{item_path}"
    elsif File.exist?(item_path)
      FileUtils.rm(item_path)
      puts "Deleted file: #{item_path}"
    end
    completed_deletions += 1
    show_progress_bar("Deleting from #{drive}", completed_deletions, total_deletions)
  end

  # Delete top-level directories
  TOP_LEVEL_DIRECTORIES.each do |dir_name|
    dir_path = File.join(drive, dir_name)
    if File.directory?(dir_path)
      FileUtils.rm_rf(dir_path)
      puts "Deleted directory: #{dir_path}"
    end
    completed_deletions += 1
    show_progress_bar("Deleting from #{drive}", completed_deletions, total_deletions)
  end

  # Delete top-level files
  TOP_LEVEL_FILES.each do |file_name|
    file_path = File.join(drive, file_name)
    if File.exist?(file_path)
      FileUtils.rm(file_path)
      puts "Deleted file: #{file_path}"
    end
    completed_deletions += 1
    show_progress_bar("Deleting from #{drive}", completed_deletions, total_deletions)
  end

  puts "\nFinished deleting files and directories on #{drive}."
end

# Function to copy sample_bookshelf_notes and START_HERE.pdf with error logging
def sync_sample_and_start_here(drive)
  # Copy `sample_bookshelf_notes` directory if it exists in the source
  sample_source_path = File.join(SOURCE_A_DIRECTORY, SAMPLE_BOOKSHELF_NOTES)
  if Dir.exist?(sample_source_path)
    puts "\nSyncing #{SAMPLE_BOOKSHELF_NOTES} to #{drive}..."
    rsync_output = `rsync #{RSYNC_OPTIONS} #{sample_source_path} #{drive} 2>&1`
    if $?.success?
      puts "#{SAMPLE_BOOKSHELF_NOTES} synced successfully."
    else
      puts "Error syncing #{SAMPLE_BOOKSHELF_NOTES} to #{drive}: #{rsync_output}"
    end
  else
    puts "#{SAMPLE_BOOKSHELF_NOTES} does not exist in the source directory."
  end

  # Copy `START_HERE.pdf` file
  start_here_source_path = File.join(SOURCE_A_DIRECTORY, START_HERE_FILE)
  if File.exist?(start_here_source_path)
    puts "\nCopying #{START_HERE_FILE} to #{drive}..."
    rsync_output = `rsync #{RSYNC_OPTIONS} #{start_here_source_path} #{drive} 2>&1`
    if $?.success?
      puts "#{START_HERE_FILE} copied successfully."
    else
      puts "Error copying #{START_HERE_FILE} to #{drive}: #{rsync_output}"
    end
  else
    puts "#{START_HERE_FILE} does not exist in the source directory."
  end
end

# Main execution
book_zwis_files_to_delete = load_files_to_delete(FILES_A_TO_DELETE)
drives = Dir.glob(FLASH_DRIVE_PATH).sort

if drives.empty?
  puts "No ZWIBook drives found."
  exit
end

drives.each do |drive|
  puts "\nNow working on #{drive}. Begin? (Press Enter to confirm)"
  gets.chomp

  # Step 1: Delete specified files and directories with a progress bar
  delete_files_and_directories(drive, book_zwis_files_to_delete)

  # Step 2: Sync `sample_bookshelf_notes` and `START_HERE.pdf` with verification
  sync_sample_and_start_here(drive)
end

puts "\nAll drives processed."

################# BEGIN validate_flash_drive.rb

require 'fileutils'

# Define the source directory
source_b_directory = '/home/globewalldesk/ZWIBook/book_zwis'

# Find the first flash drive that matches "ZWIBook*"
target_drive = Dir.glob("/media/globewalldesk/ZWIBook#{drive_number}").first
if target_drive.nil?
  puts "No drives found matching 'ZWIBook*'"
  exit
end

# Define the target directory and manifest path on the selected drive
target_directory = File.join(target_drive, 'book_zwis')
manifest_b_path = File.join(target_drive, 'manifest.txt')

# Specific files to delete from the target book_zwis directory
files_b_to_delete = ['bookshelf.json', 'latest.txt', '.93', '36567.html']

files_b_to_delete.each do |file_name|
  file_path = File.join(target_directory, file_name)
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

# Generate a manifest with file sizes from the source directory
File.open(manifest_b_path, 'w') do |manifest_file|
  manifest_file.puts("Manifest of file sizes from the source directory: #{source_b_directory}\n")

  # Get all .zwi files in the source directory and write their sizes to manifest.txt
  Dir.glob(File.join(source_b_directory, '*.zwi')).each do |source_file|
    filename = File.basename(source_file)
    file_size = File.size(source_file)
    manifest_file.puts("#{filename}: #{file_size} bytes")
  end
end

puts "Manifest created at #{manifest_b_path}."

# Compare file sizes between source and target directories and copy missing or 0-byte files
discrep_b_ancies = []
Dir.glob(File.join(source_b_directory, '*.zwi')).each do |source_file|
  filename = File.basename(source_file)
  target_file = File.join(target_directory, filename)

  if File.exist?(target_file)
    source_size = File.size(source_file)
    target_size = File.size(target_file)

    # Handle 0-byte files and size mismatches
    if target_size == 0
      puts "Copying #{filename} from source to target (target file is 0 bytes)"
      FileUtils.cp(source_file, target_file)
    elsif source_size != target_size
      discrep_b_ancies << "Size mismatch: #{filename} - Source: #{source_size} bytes, Target: #{target_size} bytes"
      FileUtils.cp(source_file, target_file)
    end
  else
    # If the file is missing in the target directory, copy it over
    puts "Copying missing file #{filename} from source to target"
    FileUtils.cp(source_file, target_file)
  end
end

# Output discrep_b_ancies to the console
if discrep_b_ancies.empty?
  puts "All files in the target directory match the source directory's byte sizes, except for the missing or 0-byte files, which have been copied."
else
  puts "Discrepancies found between source and target directories (not including missing or 0-byte files):"
  discrep_b_ancies.each { |entry| puts entry }
end

############################# BEGIN confirm_os_drives.rb

require 'fileutils'

# Define the source directory
source_c_directory = '/home/globewalldesk/ZWIBook/v1.1'

# List of OS directories to process
OS_DIRECTORIES = ['Linux', 'Mac', 'Windows']

# Find all flash drives that match "ZWIBook*"
target_drives = Dir.glob("/media/globewalldesk/ZWIBook#{drive_number}")

if target_drives.empty?
  puts "No drives found matching 'ZWIBook*'"
  exit
end

# Process each drive
target_drives.each do |target_drive|
  puts "\nProcessing drive: #{target_drive}"

  OS_DIRECTORIES.each do |os|
    source_os_directory = File.join(source_c_directory, os)
    target_os_directory = File.join(target_drive, os)
    manifest_c_path = File.join(target_drive, "#{os}_manifest.txt")

    unless Dir.exist?(source_os_directory)
      puts "Source directory does not exist: #{source_os_directory}"
      next
    end

    # Create target OS directory if it doesn't exist
    FileUtils.mkdir_p(target_os_directory) unless Dir.exist?(target_os_directory)

    puts "Processing OS: #{os}"

    # Generate a manifest with file sizes from the source OS directory
    File.open(manifest_c_path, 'w') do |manifest_file|
      manifest_file.puts("Manifest of file sizes from the source directory: #{source_os_directory}\n")

      # Get all files in the source OS directory and write their sizes to the manifest
      Dir.glob(File.join(source_os_directory, '**', '*')).each do |source_file|
        next if File.directory?(source_file)
        relative_path = source_file.sub("#{source_os_directory}/", '')
        file_size = File.size(source_file)
        manifest_file.puts("#{relative_path}: #{file_size} bytes")
      end
    end

    puts "Manifest created at #{manifest_c_path}."

    # Compare files between source and target directories and copy missing or different files in batches
    discrep_c_ancies = []
    files_to_copy = []

    Dir.glob(File.join(source_os_directory, '**', '*')).each do |source_file|
      next if File.directory?(source_file)
      relative_path = source_file.sub("#{source_os_directory}/", '')
      target_file = File.join(target_os_directory, relative_path)

      source_size = File.size(source_file)

      if File.exist?(target_file)
        target_size = File.size(target_file)

        if target_size == 0
          puts "Queuing #{relative_path} for copying (target file is 0 bytes)"
          files_to_copy << [source_file, target_file]
        elsif source_size != target_size
          discrep_c_ancies << "Size mismatch: #{relative_path} - Source: #{source_size} bytes, Target: #{target_size} bytes"
          files_to_copy << [source_file, target_file]
        end
      else
        # If the file is missing in the target directory, queue it for copying
        puts "Queuing missing file #{relative_path} for copying"
        files_to_copy << [source_file, target_file]
      end
    end

    # Batch copy files with a pause after each batch of 100
    batch_size = 100
    files_to_copy.each_slice(batch_size) do |batch|
      batch.each do |source_file, target_file|
        FileUtils.mkdir_p(File.dirname(target_file))
        FileUtils.cp(source_file, target_file)
      end
      sleep(0.1) # Pause briefly after each batch
    end

    # Output discrep_c_ancies to the console
    if discrep_c_ancies.empty?
      puts "All files in the target directory match the source directory's byte sizes for OS #{os}, except for the missing or 0-byte files, which have been copied."
    else
      puts "Discrepancies found between source and target directories for OS #{os} (not including missing or 0-byte files):"
      discrep_c_ancies.each { |entry| puts entry }
    end
  end

  puts "\nFinished processing drive: #{target_drive}"

  # Remove manifest files after processing
  ['manifest.txt', 'Linux_manifest.txt', 'Mac_manifest.txt', 'Windows_manifest.txt'].each do |manifest|
    manifest_c_path = File.join(target_drive, manifest)
    if File.exist?(manifest_c_path)
      FileUtils.rm(manifest_c_path)
      puts "Removed #{manifest_c_path}"
    else
      puts "Manifest not found: #{manifest_c_path}"
    end
  end
end

puts "\nAll OS directories processed."
