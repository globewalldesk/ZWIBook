#!/usr/bin/env ruby
require 'fileutils'

# OUTPUT:
# Total numbered directories: 3929
# Directories with .txt files: 2971
# Directories with .htm files: 3343
# Directories with only .txt files: 526
# Directories with only .htm files: 898
# Directories with neither .txt nor .htm: [comma-separated list]

# Directory where the files and directories are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# Initialize counters
total_directories = 0
with_txt = 0
with_html = 0
txt_only = 0
html_only = 0
neither_list = []

# Iterate over the numbered directories
Dir.glob("#{base_directory}/*/").each do |dir|
  dir_name = File.basename(dir.chomp('/'))

  # Skip directories that don't match the pattern of numbered directories
  next unless dir_name =~ /^\d+$/

  total_directories += 1
  txt_found = false
  html_found = false

  txt_file = File.join(dir, "#{dir_name}.txt")
  html_file = File.join(dir, "#{dir_name}.htm")

  # Check if the directory contains the corresponding .txt and/or .htm files
  if File.exist?(txt_file)
    with_txt += 1
    txt_found = true
  end

  if File.exist?(html_file)
    with_html += 1
    html_found = true
  end

  # Check for directories that contain only TXT or only HTML
  txt_only += 1 if txt_found && !html_found
  html_only += 1 if html_found && !txt_found

  # If neither .txt nor .htm files exist, add to the neither_list
  if !txt_found && !html_found
    neither_list << dir_name
  end
end

# Output the results
puts "Total numbered directories: #{total_directories}"
puts "Directories with .txt files: #{with_txt}"
puts "Directories with .htm files: #{with_html}"
puts "Directories with only .txt files: #{txt_only}"
puts "Directories with only .htm files: #{html_only}"

# Output the list of directories with neither type
puts "Directories with neither .txt nor .htm: #{neither_list.join(', ')}" unless neither_list.empty?

puts "Processing completed."
