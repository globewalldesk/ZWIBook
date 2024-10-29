#!/usr/bin/env ruby
# SCRIPT PURPOSE: download all zips, to a given directory
# This script downloads all ZIP files for Project Gutenberg books starting from 70767.
# Each book consists of two files: a "0" file and an "h" file (HTML format).
# If the ZIP file is unavailable, download the .txt file or HTML directory.
# The files are saved in the specified directory, and progress is displayed with each downloaded file.

require 'net/http'
require 'uri'
require 'fileutils'

# Load the FILES_TO_DOWNLOAD array from external file
require_relative './files_to_download3'

# Base URL for the Project Gutenberg mirror
base_url = "http://aleph.gutenberg.org"

# Directory to save the downloaded files
OUTPUT_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixer/redone_zwis"

# Ensure the output directory exists
FileUtils.mkdir_p(OUTPUT_DIR)

# Log files for tracking the script's work
head_log = File.open("head_log.txt", "w")
download_log = File.open("download_log.txt", "w")
dir_download_log = File.open("dir_download_log.txt", "w")

# Function to build the correct URL based on the book number
def construct_url(book_number)
  digits = book_number.to_s.chars
  directory = digits[0...-1].join('/') + "/#{book_number}/"
  "http://aleph.gutenberg.org/#{directory}"
end

# Function to download files with added timeout and delay
def download_file(url, filename, head_log)
  uri = URI(url)
  head_req = Net::HTTP::Head.new(uri)
  
  # Timeout and sleep to avoid overwhelming the server
  begin
    # In download_file, change use_ssl to false for http-only mirror
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: false) do |http|
      http.request(head_req)
    end

    if response.is_a?(Net::HTTPSuccess)
      download_response = Net::HTTP.get_response(uri)
      File.open(filename, 'wb') { |file| file.write(download_response.body) }
      return true
    else
      head_log.puts "HEAD failed for #{url}"
      return false
    end
  rescue Timeout::Error => e
    head_log.puts "Timeout for #{url}: #{e.message}"
    return false
  rescue => e
    head_log.puts "Error for #{url}: #{e.message}"
    return false
  ensure
    #sleep(0.05) # Add a delay of 0.05 seconds between requests to avoid server overload
  end
end

# Function to download a directory
def download_directory(url, output_dir, dir_download_log, head_log)
  uri = URI(url)
  response = Net::HTTP.get_response(uri)

  if response.is_a?(Net::HTTPSuccess)
    Dir.mkdir(output_dir) unless Dir.exist?(output_dir)
    dir_download_log.puts "Downloading directory #{url}"

    # Parse the HTML page for links (files inside the directory)
    page_content = response.body
    page_content.scan(/href="([^"]+)"/).each do |file_link|
      file_name = file_link.first
      next if file_name == '../' # Skip parent directory link

      # Recursively download each file inside the directory
      file_url = URI.join(url, file_name).to_s
      file_output_path = File.join(output_dir, file_name)

      if file_name.end_with?('/') # If it's a subdirectory
        download_directory(file_url, file_output_path, dir_download_log, head_log)
      else
        download_file(file_url, file_output_path, head_log)
      end
    end
    return true
  else
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

# Function to check if the file exists on the server via HEAD request
def head_check(url, head_log)
  uri = URI(url)
  head_req = Net::HTTP::Head.new(uri)
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: false) do |http|
    http.request(head_req)
  end

  if response.is_a?(Net::HTTPSuccess)
    return true
  else
    head_log.puts "HEAD failed for #{url}"
    return false
  end
end

# Function to download file or its alternatives
def download_file_or_alternatives(book_number, book_url, head_log, dir_download_log)
  # Construct the URLs for each file type
  book_url_0 = "#{book_url}#{book_number}-0.zip"
  book_url_h = "#{book_url}#{book_number}-h.zip"
  
  # Alternative URLs for plain text and HTML directory
  alt_txt_0 = "#{book_url}#{book_number}-0.txt"
  alt_dir_h = "#{book_url}#{book_number}-h/"
  
  # Check if the ZIP file exists or fall back to alternatives
  success_0 = if head_check(book_url_0, head_log)
                 download_file(book_url_0, File.join(OUTPUT_DIR, "#{book_number}-0.zip"), head_log)
               elsif head_check(alt_txt_0, head_log)
                 download_file(alt_txt_0, File.join(OUTPUT_DIR, "#{book_number}-0.txt"), head_log)
               else
                 print "x"
                 false
               end

  success_h = if head_check(book_url_h, head_log)
                 download_file(book_url_h, File.join(OUTPUT_DIR, "#{book_number}-h.zip"), head_log)
               elsif head_check(alt_dir_h, head_log)
                 download_directory(alt_dir_h, File.join(OUTPUT_DIR, "#{book_number}-h"), dir_download_log, head_log)
               else
                 print "x"
                 false
               end

  # Return both success flags
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

  # Build URL for the book number
  book_url = construct_url(book_number)

  # Download the file or alternatives (e.g., .txt or directory)
  success_0, success_h = download_file_or_alternatives(book_number, book_url, head_log, dir_download_log)

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
  book_url = construct_url(book_number)

  # Retry download
  download_file_or_alternatives(book_number, book_url, head_log, dir_download_log)
end

puts "\n\nDownload completed!"
puts "Total files not found: #{not_found_count}"

# Close the log files
head_log.close
download_log.close
dir_download_log.close
