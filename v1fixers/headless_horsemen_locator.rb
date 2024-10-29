#!/usr/bin/env ruby
require 'nokogiri'

# Directory where the files are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"
output_file = "headless_horsemen.txt"

# Header and Footer phrases (without the final period)
header_phrase = "This eBook is for the use of anyone anywhere"
footer_phrase = "subscribe to our email newsletter to hear about new eBooks"

# Function to check for the header in the first 500 characters of a file
def has_header?(file_path, header_phrase)
  content = File.read(file_path, 500) rescue ""
  content.include?(header_phrase)
end

# Function to check for the footer in the last 500 characters of a file
def has_footer?(file_path, footer_phrase)
  return false unless File.exist?(file_path)
  
  File.open(file_path) do |file|
    file.seek([file.size - 500, 0].max)
    content = file.read(500)
    content.include?(footer_phrase)
  end
end

# Function to check for header in HTML files, after <body> tag
def html_has_header?(file_path, header_phrase)
  html_content = File.read(file_path)
  body_content = Nokogiri::HTML(html_content).at('body').to_s rescue ""
  body_content[0..500].include?(header_phrase)
end

# Function to check footer in HTML files
def html_has_footer?(file_path, footer_phrase)
  html_content = File.read(file_path)
  body_content = Nokogiri::HTML(html_content).at('body').to_s rescue ""
  body_content[-500..].include?(footer_phrase)
end

# Open the output file
File.open(output_file, 'w') do |log|
  # Iterate over the files in the base directory
  Dir.glob("#{base_directory}/**/*.{txt,htm}").each_with_index do |file_path, index|
    file_name = File.basename(file_path)
    top_level_dir = File.dirname(file_path)

    # Check if it's a .txt file
    if file_name.end_with?(".txt")
      has_header = has_header?(file_path, header_phrase)
      has_footer = has_footer?(file_path, footer_phrase)

      # If missing either the header or footer, log the file
      unless has_header && has_footer
        log.puts(file_path)
      end

    # Check if it's a .htm file
    elsif file_name.end_with?(".htm")
      has_header = html_has_header?(file_path, header_phrase)
      has_footer = html_has_footer?(file_path, footer_phrase)

      # If missing either the header or footer, log the file
      unless has_header && has_footer
        log.puts(file_path)
      end
    end

    # Print a progress indicator every 100 files
    print "." if (index + 1) % 100 == 0
  end
end

puts "\nProcessing completed. Results saved to #{output_file}."
