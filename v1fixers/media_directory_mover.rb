#!/usr/bin/env ruby
require 'fileutils'

# Base directory where the numbered directories are located
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"

# Log file to track the directories moved
log_file = "media_directory_mover_log.txt"

# Subdirectories to move
TARGET_DIRS = ['images', 'music']

# Function to move directories to /data/media
def move_media_directories(book_id, subdirs, log_file)
  base_path = File.join(BASE_DIR, book_id)
  media_path = File.join(base_path, 'data', 'media')

  # Ensure /data/media exists
  FileUtils.mkdir_p(media_path)

  subdirs.each do |subdir|
    source_dir = File.join(base_path, subdir)
    destination_dir = File.join(media_path, subdir)

    # Skip moving directories named 'data' to avoid self-reference errors
    if subdir == 'data'
      puts "Skipping directory named 'data' in #{base_path}."
      File.open(log_file, 'a') { |f| f.puts "Skipped: #{source_dir} (directory named 'data')." }
      next
    end

    if Dir.exist?(source_dir)
      if Dir.exist?(destination_dir)
        puts "Warning: #{destination_dir} already exists. Skipping move."
        File.open(log_file, 'a') { |f| f.puts "Warning: #{destination_dir} already exists. Skipped." }
      else
        # Move the directory and log it
        FileUtils.mv(source_dir, destination_dir)
        puts "Moved: #{source_dir} -> #{destination_dir}"
        File.open(log_file, 'a') { |f| f.puts "Moved: #{source_dir} -> #{destination_dir}" }
      end
    end
  end
end

# Function to process each numbered directory
def process_directories(base_dir, target_dirs, log_file)
  other_dirs_log = []

  Dir.foreach(base_dir) do |book_id|
    next if book_id == '.' || book_id == '..' || !book_id.match?(/^\d+$/) # Skip non-numbered directories

    # Check for target subdirectories and move them
    move_media_directories(book_id, target_dirs, log_file)

    # Find any other directories and log them (but move them as well)
    book_path = File.join(base_dir, book_id)
    Dir.foreach(book_path) do |subdir|
      next if subdir == '.' || subdir == '..' || target_dirs.include?(subdir) || subdir == 'data' # Skip target and data directories

      full_path = File.join(book_path, subdir)
      if Dir.exist?(full_path)
        # Move the other directory to /data/media and log it
        move_media_directories(book_id, [subdir], log_file)
        other_dirs_log << subdir unless target_dirs.include?(subdir)
      end
    end
  end

  # Log any other directories that were moved
  unless other_dirs_log.empty?
    puts "Summary of other directories moved: #{other_dirs_log.uniq.join(', ')}"
    File.open(log_file, 'a') { |f| f.puts "Other directories moved: #{other_dirs_log.uniq.join(', ')}" }
  end
end

# Start processing the directories
process_directories(BASE_DIR, TARGET_DIRS, log_file)

puts "Processing completed. See #{log_file} for details."
