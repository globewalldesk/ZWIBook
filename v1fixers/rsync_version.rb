#!/usr/bin/env ruby
# SCRIPT PURPOSE: download all zips, to a given directory
# This script downloads all ZIP files for Project Gutenberg books starting from 70767.
# Each book consists of two files: a "0" file and an "h" file (HTML format).
# If the ZIP file is unavailable, download the .txt file or HTML directory.
# The files are saved in the specified directory, and progress is displayed with each downloaded file.

require 'fileutils'
require 'net/http'
require 'uri'

# Load the FILES_TO_DOWNLOAD array from external file
require_relative './files_to_download'

# Base URL for the Project Gutenberg mirror
OUTPUT_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# Ensure the output directory exists
FileUtils.mkdir_p(OUTPUT_DIR)

# Log files for tracking the script's work
head_log = File.open("head_log.txt", "w")
download_log = File.open("download_log.txt", "w")
dir_download_log = File.open("dir_download_log.txt", "w")

# Function to construct the correct rsync path based on the book number
def construct_rsync_path(book_number)
  digits = book_number.to_s.chars
  directory = digits[0...-1].join('/') + "/#{book_number}/"
  "rsync://aleph.gutenberg.org/gutenberg/#{directory}"
end

# Function to download files using rsync
def download_file_with_rsync(rsync_path, output_file, download_log)
  system("rsync -aq --include='#{File.basename(output_file)}' --exclude='*' #{rsync_path} #{File.dirname(output_file)}")
  
  if $?.success?
    download_log.puts "Successfully downloaded #{output_file} via rsync."
    return true
  else
    download_log.puts "Rsync failed for #{output_file}"
    return false
  end
end

# Function to download a directory using rsync, less verbose
def download_directory(rsync_path_dir_h, output_dir, dir_download_log)
  # Use rsync with less verbosity to download the entire directory
  system("rsync -aq #{rsync_path_dir_h} #{output_dir}")
  
  if $?.success?
    dir_download_log.puts "Successfully downloaded directory #{rsync_path_dir_h}"
    return true
  else
    dir_download_log.puts "Rsync failed for directory #{rsync_path_dir_h}"
    return false
  end
end

# Check if the file already exists locally and log '.' for each skipped book
def file_already_downloaded?(book_number)
  file_0 = File.join(OUTPUT_DIR, "#{book_number}-0.zip")
  file_h = File.join(OUTPUT_DIR, "#{book_number}-h.zip")
  txt_0 = File.join(OUTPUT_DIR, "#{book_number}-0.txt")
  dir_h = File.join(OUTPUT_DIR, "#{book_number}-h/")

  # If the file exists, log '.' and return true
  if File.exist?(file_0) || File.exist?(file_h) || File.exist?(txt_0) || Dir.exist?(dir_h)
    print "."
    return true
  else
    return false
  end
end

# Function to check existence using HTTP before running rsync
def check_if_exists(url)
  uri = URI(url)
  request = Net::HTTP::Head.new(uri)
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: false) do |http|
    http.request(request)
  end
  response.is_a?(Net::HTTPSuccess)
end

# Function to download file or its alternatives using rsync only if they exist
def download_file_or_alternatives(book_number, rsync_path_0, rsync_path_h, rsync_path_alt_0, rsync_path_dir_h, download_log, dir_download_log)
  base_url = "http://aleph.gutenberg.org/gutenberg/#{construct_rsync_path(book_number)}"

  # Check for 0.zip or fallback to 0.txt
  if check_if_exists("#{base_url}#{book_number}-0.zip")
    success_0 = download_file_with_rsync(rsync_path_0, File.join(OUTPUT_DIR, "#{book_number}-0.zip"), download_log)
  elsif check_if_exists("#{base_url}#{book_number}-0.txt")
    success_0 = download_file_with_rsync(rsync_path_alt_0, File.join(OUTPUT_DIR, "#{book_number}-0.txt"), download_log)
  else
    print "x0"  # Log that neither 0.zip nor 0.txt exists
    success_0 = false
  end

  # Check for h.zip or fallback to h directory
  if check_if_exists("#{base_url}#{book_number}-h.zip")
    success_h = download_file_with_rsync(rsync_path_h, File.join(OUTPUT_DIR, "#{book_number}-h.zip"), download_log)
  elsif check_if_exists("#{base_url}#{book_number}-h/")
    success_h = download_directory(rsync_path_dir_h, File.join(OUTPUT_DIR, "#{book_number}-h"), dir_download_log)
  else
    print "xh"  # Log that neither h.zip nor h directory exists
    success_h = false
  end

  # Return success flags
  return success_0, success_h
end

# Iterate over book numbers and download
downloaded_count = 0
not_found_count = 0
consecutive_nf = 0 # consecutive not found count
retry_list = []    # List of items to retry

FILES_TO_DOWNLOAD.each do |book_number|
  # Skip if already downloaded
  next if file_already_downloaded?(book_number)

  # Build rsync paths for the book number
  rsync_path_0 = "#{construct_rsync_path(book_number)}#{book_number}-0.zip"
  rsync_path_h = "#{construct_rsync_path(book_number)}#{book_number}-h.zip"
  rsync_path_alt_0 = "#{construct_rsync_path(book_number)}#{book_number}-0.txt"
  rsync_path_dir_h = "#{construct_rsync_path(book_number)}#{book_number}-h/"

  # Download the file or alternatives (e.g., .txt or directory)
  success_0, success_h = download_file_or_alternatives(book_number, rsync_path_0, rsync_path_h, rsync_path_alt_0, rsync_path_dir_h, download_log, dir_download_log)

  if success_0 || success_h
    print "#{book_number}-"
    print "0" if success_0
    print "h" if success_h  # Print "h" only if success_h is true
    print " "
    download_log.puts "Downloaded #{book_number}"
    consecutive_nf = 0
  else
    not_found_count += 1
    consecutive_nf += 1
    retry_list << book_number
    print "x "
    print "..." if consecutive_nf == 10
  end

  # Print two newlines every 100 files processed
  downloaded_count += 1
  print "\n\n" if downloaded_count % 100 == 0
end

# Retry logic for failed items
puts "\n\nRetrying failed downloads..."
retry_list.each do |book_number|
  next if file_already_downloaded?(book_number)  # Skip if already downloaded during the retry loop

  # Build URLs again for retry
  rsync_path_0 = "#{construct_rsync_path(book_number)}#{book_number}-0.zip"
  rsync_path_h = "#{construct_rsync_path(book_number)}#{book_number}-h.zip"
  rsync_path_alt_0 = "#{construct_rsync_path(book_number)}#{book_number}-0.txt"
  rsync_path_dir_h = "#{construct_rsync_path(book_number)}#{book_number}-h/"

  # Retry download
  download_file_or_alternatives(book_number, rsync_path_0, rsync_path_h, rsync_path_alt_0, rsync_path_dir_h, download_log, dir_download_log)
end

puts "\n\nDownload completed!"
puts "Total files not found: #{not_found_count}"

# Close the log files
head_log.close
download_log.close
dir_download_log.close
