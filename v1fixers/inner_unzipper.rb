#!/usr/bin/env ruby

require 'fileutils'
require 'zip' # gem install rubyzip if not installed

# Base directory where the numbered subdirectories are located
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# Log file for name conflicts
conflict_log = File.open("name_conflicts_log.txt", "w")

# Function to unzip files inside numbered subdirectories and handle conflicts
def unzip_files_in_directory(directory, conflict_log)
  # Step 1: Find all .zip files in the numbered subdirectory
  Dir.glob("#{directory}/*.zip").each do |zip_file|
    unzip_dir = directory

    # Step 2: Check contents of the .zip file for name conflicts
    conflict_found = false
    Zip::File.open(zip_file) do |zip_contents|
      zip_contents.each do |entry|
        destination_path = File.join(unzip_dir, entry.name)

        if File.exist?(destination_path)
          conflict_log.puts "Conflict in #{directory}: #{entry.name} already exists!"
          conflict_found = true
        end
      end
    end

    # Step 3: If no conflicts are found, proceed to unzip and delete the .zip file
    unless conflict_found
      Zip::File.open(zip_file) do |zip_contents|
        zip_contents.each do |entry|
          destination_path = File.join(unzip_dir, entry.name)

          # Create the directory structure if necessary
          if entry.directory?
            FileUtils.mkdir_p(destination_path)
          else
            FileUtils.mkdir_p(File.dirname(destination_path)) # Ensure the directory exists
            zip_contents.extract(entry, destination_path) { true } # Force overwrite if needed
          end
        end
      end
      puts "Unzipped: #{zip_file}"
      File.delete(zip_file) if File.exist?(zip_file) # Remove the .zip file after unzipping
    else
      puts "Skipping #{zip_file} due to conflicts"
    end
  end
end

# Function to iterate over numbered directories and process each one
def process_directories(base_directory, conflict_log)
  Dir.glob("#{base_directory}/*").each do |subdirectory|
    next unless File.directory?(subdirectory) # Process only directories with book IDs
    unzip_files_in_directory(subdirectory, conflict_log)
  end
end

# Run the script to process all directories
process_directories(base_directory, conflict_log)

# Close the conflict log
conflict_log.close

puts "Unzipping process completed."
