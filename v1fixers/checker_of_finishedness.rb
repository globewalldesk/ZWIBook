#!/usr/bin/env ruby
require 'fileutils'

# Paths to the necessary directories and files
DATA_SOURCE_PATH = '/media/globewalldesk/DATA/ProjectGutenberg/book_zwis'
FILES_TO_DELETE = 'files_to_delete.txt'
FILES_TO_REPLACE = 'files_to_replace.txt'

# Function to read the list of file numbers from a file
def read_file_list(file)
  if File.exist?(file)
    File.readlines(file).map(&:chomp).uniq
  else
    puts "File #{file} not found."
    exit
  end
end

# Function to check if files are present in the source directory
def check_files_in_source(file_list, file_type)
  missing_files = []
  file_list.each do |file_number|
    file_path = File.join(DATA_SOURCE_PATH, "#{file_number}.zwi")
    missing_files << file_number unless File.exist?(file_path)
  end

  if missing_files.empty?
    puts "All #{file_type} files are present in the source directory."
  else
    puts "Missing #{file_type} files in source directory: #{missing_files.join(', ')}"
  end
end

# Function to find any duplicates within a list
def check_duplicates(file_list, file_type)
  duplicates = file_list.select { |file| file_list.count(file) > 1 }.uniq
  if duplicates.empty?
    puts "No duplicates found in the #{file_type} list."
  else
    puts "Duplicates found in the #{file_type} list: #{duplicates.join(', ')}"
  end
end

# Main execution
files_to_delete = read_file_list(FILES_TO_DELETE)
files_to_replace = read_file_list(FILES_TO_REPLACE)

# Check for files in the source directory
puts "\nChecking if all files_to_delete are in the source directory:"
check_files_in_source(files_to_delete, 'files_to_delete')

puts "\nChecking if all files_to_replace are in the source directory:"
check_files_in_source(files_to_replace, 'files_to_replace')

# Check for any overlaps between the lists
overlap = files_to_delete & files_to_replace
if overlap.empty?
  puts "\nNo files are present in both files_to_delete and files_to_replace."
else
  puts "\nFiles present in both files_to_delete and files_to_replace: #{overlap.join(', ')}"
end

# Check for duplicates in the lists
puts "\nChecking for duplicates in files_to_delete:"
check_duplicates(files_to_delete, 'files_to_delete')

puts "\nChecking for duplicates in files_to_replace:"
check_duplicates(files_to_replace, 'files_to_replace')