#!/usr/bin/env ruby
require 'fileutils'

# Directories
HOME_PATH = '/home/globewalldesk/ZWIBook/book_zwis'
DATA_SOURCE_PATH = '/media/globewalldesk/DATA/ProjectGutenberg/book_zwis'

# Starting file number and target total files
START_FILE_NUMBER = 70566
TARGET_TOTAL_FILES = 69020

# Function to count existing .zwi files in the home directory
def count_existing_files(directory)
  Dir.glob("#{directory}/*.zwi").size
end

# Function to calculate the cumulative size of files to reach the target total number of files
def calculate_additional_files_to_target(data_source_path, start_file_number, files_needed)
  cumulative_size = 0
  current_file_number = start_file_number
  files_added = 0

  while files_added < files_needed
    # Construct file path for current .zwi file
    file_path = File.join(data_source_path, "#{current_file_number}.zwi")

    if File.exist?(file_path)
      file_size = File.size(file_path)
      cumulative_size += file_size
      files_added += 1
      puts "Adding #{current_file_number}.zwi (size: #{file_size} bytes)"
    else
      puts "#{current_file_number}.zwi not found, skipping."
    end

    # Move to the next file number
    current_file_number += 1
  end

  { cumulative_size: cumulative_size, files_added: files_added }
end

# Main function
def main(home_path, data_source_path, start_file_number, target_total_files)
  # Count existing files in the home directory
  existing_files_count = count_existing_files(home_path)

  # Calculate the number of files needed to reach the target
  files_needed = target_total_files - existing_files_count

  if files_needed <= 0
    puts "No additional files needed. Total files already exceed or match target."
    return
  end

  puts "Files needed to reach the target of #{target_total_files}: #{files_needed}"

  # Calculate the cumulative size and file count to add
  file_addition_stats = calculate_additional_files_to_target(data_source_path, start_file_number, files_needed)

  # Output the stats
  total_size_in_gb = file_addition_stats[:cumulative_size] / (1024.0**3)
  puts "\nCumulative size of added files: #{file_addition_stats[:cumulative_size]} bytes (#{total_size_in_gb.round(2)} GB)"
  puts "Number of files added: #{file_addition_stats[:files_added]}"
  puts "Final total number of files in home directory will be: #{target_total_files}"
end

# Run the main function
main(HOME_PATH, DATA_SOURCE_PATH, START_FILE_NUMBER, TARGET_TOTAL_FILES)
