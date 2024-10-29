#!/usr/bin/env ruby
require 'fileutils'

# Base directory where files are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"

# Log files
log_file = "extraction_log.txt"
conflict_log_file = "conflict_log.txt"

# Function to check for filename conflicts between the top-level and inner directory
def check_for_conflicts(inner_dir, top_level_dir)
  Dir.foreach(inner_dir) do |item|
    next if item == '.' or item == '..'
    item_in_top_level = File.join(top_level_dir, item)
    if File.exist?(item_in_top_level)
      return true  # Conflict found
    end
  end
  false
end

# Function to move contents of the inner directory to the top level
def move_inner_contents(inner_dir, top_level_dir)
  Dir.foreach(inner_dir) do |item|
    next if item == '.' or item == '..'
    item_path = File.join(inner_dir, item)
    new_path = File.join(top_level_dir, item)

    if File.directory?(item_path)
      # Move the entire directory
      FileUtils.mv(item_path, new_path)
    else
      # Move the file up one level
      FileUtils.mv(item_path, new_path)
    end
  end

  # Remove the inner directory if it's empty
  Dir.rmdir(inner_dir) if Dir.empty?(inner_dir)
end

# Function to process the directories
def process_directories(base_dir, log_file, conflict_log_file)
  Dir.foreach(base_dir) do |top_level_dir|
    next if top_level_dir == '.' or top_level_dir == '..'
    top_level_path = File.join(base_dir, top_level_dir)

    if File.directory?(top_level_path)
      # Look for inner directories with '-h' suffix
      inner_dir = File.join(top_level_path, "#{top_level_dir}-h")

      if File.exist?(inner_dir) and File.directory?(inner_dir)
        # Check for filename conflicts
        if check_for_conflicts(inner_dir, top_level_path)
          File.open(conflict_log_file, 'a') { |f| f.puts "Conflict in #{top_level_path}" }
          puts "Conflict found in #{top_level_path}, skipping extraction"
        else
          # Move contents and remove inner directory
          move_inner_contents(inner_dir, top_level_path)
          File.open(log_file, 'a') { |f| f.puts "Extracted: #{top_level_dir}" }
          puts "Extracted: #{top_level_dir}"
        end
      end
    end
  end
end

# Run the script
process_directories(base_directory, log_file, conflict_log_file)
