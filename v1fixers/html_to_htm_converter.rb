#!/usr/bin/env ruby
require 'fileutils'

# Base directory where files are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"
log_file = "html_to_htm_conflicts.log"

# Function to rename `.html` files to `.htm`, logging conflicts
def rename_html_to_htm(directory, log_file)
  Dir.glob("#{directory}/**/*.html").each do |path|
    new_path = path.sub(/\.html$/, '.htm')

    # Check if the target `.htm` file already exists
    if File.exist?(new_path)
      File.open(log_file, 'a') { |f| f.puts "Conflict: #{path} -> #{new_path}" }
      puts "Conflict: #{path} -> #{new_path} (skipped)"
    else
      FileUtils.mv(path, new_path)
      puts "Renamed: #{path} -> #{new_path}"
    end
  end
end

# Clear the log file before starting
File.open(log_file, 'w') {}

# Run the renaming function on the base directory
rename_html_to_htm(base_directory, log_file)

puts "Processing completed."
