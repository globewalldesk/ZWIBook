#!/usr/bin/env ruby
require 'fileutils'

# Directory where the files and directories are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"
boilerplate_file = "./boilerplate.txt"

# Read the boilerplate content
boilerplate = File.read(boilerplate_file)

# Function to append the boilerplate if conditions are met
def append_boilerplate(file_path, boilerplate)
  # Read the contents of the file
  content = File.read(file_path)
  
  # Check the first 500 characters for the phrase "This eBook is for the use of anyone anywhere"
  first_500_chars = content[0..499]
  return if first_500_chars.include?("This eBook is for the use of anyone anywhere")

  # Check the last 500 characters for the phrase "subscribe to our email newsletter to hear about new eBooks"
  last_500_chars = content[-500..-1] || ""
  return if last_500_chars.include?("subscribe to our email newsletter to hear about new eBooks")

  # If the conditions are not met, append the boilerplate
  File.open(file_path, 'a') { |f| f.puts "\n\n#{boilerplate}" }
  puts "Appended boilerplate to: #{file_path}"
end

# Iterate over the numbered directories and process the "nnnnn.txt" files
def process_txt_files(base_directory, boilerplate)
  file_count = 0
  Dir.glob("#{base_directory}/*/*.txt").each do |txt_file|
    append_boilerplate(txt_file, boilerplate)
    file_count += 1
    # Add '.' for every 100 files processed
    print "." if file_count % 100 == 0
  end
  puts "\nProcessed #{file_count} files."
end

# Function to confirm if all the files have the boilerplate appended
def confirm_boilerplate(base_directory)
  confirmation_count = 0
  Dir.glob("#{base_directory}/*/*.txt").each do |txt_file|
    content = File.read(txt_file)
    first_500_chars = content[0..499]
    last_500_chars = content[-500..-1] || ""

    if first_500_chars.include?("This eBook is for the use of anyone anywhere") ||
       last_500_chars.include?("subscribe to our email newsletter to hear about new eBooks")
      confirmation_count += 1
    else
      puts "Boilerplate missing in: #{txt_file}"
    end
  end
  puts "Boilerplate confirmed in #{confirmation_count} files."
end

# Start the process
puts "Appending boilerplate to eligible files..."
process_txt_files(base_directory, boilerplate)

puts "Verifying that boilerplate is present in all files..."
confirm_boilerplate(base_directory)

puts "Processing completed."
