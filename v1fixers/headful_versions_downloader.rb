#!/usr/bin/env ruby
require 'net/http'
require 'uri'
require 'fileutils'

# Directory where the downloaded files should be saved in their numbered directories
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# File containing the list of files to be processed (all of them now)
input_file = 'headless_horsemen.txt'

# Read the entire list from the input file
file_list = File.readlines(input_file).map(&:chomp)

# Function to construct the download URL for .txt or .htm files
def construct_url(book_id, extension)
  base_url = "https://aleph.pglaf.org/cache/epub/#{book_id}/pg#{book_id}"
  case extension
  when '.txt'
    "#{base_url}.txt"
  when '.htm'
    "#{base_url}-images.html"
  else
    raise "Unknown file extension: #{extension}"
  end
end

# Function to download a file from the given URL and save it locally in the appropriate numbered directory
def download_file(url, output_dir, filename)
  uri = URI(url)
  response = Net::HTTP.get_response(uri)

  if response.is_a?(Net::HTTPSuccess)
    # Ensure the directory exists before saving the file
    FileUtils.mkdir_p(output_dir)
    output_path = File.join(output_dir, filename)

    File.open(output_path, 'wb') { |file| file.write(response.body) }
    puts "Downloaded: #{output_path}"
    STDOUT.flush # Force immediate output of the feedback
    return true
  else
    puts "Failed to download: #{filename} from #{url}"
    STDOUT.flush # Ensure failure message is printed right away
    return false
  end
end

# Initialize a list to store missing files
missing_files = []

# Process each file in the list
file_list.each do |file|
  # Extract the book ID and extension from the file name
  book_id, extension = file.match(/^(\d+)(\..+)$/).captures

  # Construct the download URL
  url = construct_url(book_id, extension)

  # Define the output directory and file name
  output_dir = File.join(BASE_DIR, book_id)  # /new_zwis/70844/
  filename = "#{book_id}#{extension}"        # 70844.txt or 70844.htm

  # Download the file and check for missing files
  success = download_file(url, output_dir, filename)
  missing_files << file unless success
end

# Create missing_files_log.txt only if there are missing files
unless missing_files.empty?
  File.open("missing_files_log.txt", 'w') do |f|
    missing_files.each { |file| f.puts file }
  end
  puts "Missing files logged in missing_files_log.txt."
end

puts "Processing completed."
