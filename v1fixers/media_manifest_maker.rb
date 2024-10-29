#!/usr/bin/env ruby
require 'json'
require 'digest'
require 'fileutils'

# Base directory where the numbered directories are located
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"

# Function to calculate the SHA-1 hash of a file
def calculate_sha1(file_path)
  Digest::SHA1.file(file_path).hexdigest
end

# Function to recursively scan the media directories and generate the manifest
def generate_media_manifest(directory)
  media_manifest = {}
  data_dir = File.join(directory, 'data', 'media')

  # Only proceed if the data/media directory exists
  return media_manifest unless Dir.exist?(data_dir)

  # Recursively traverse files in the media directories (images, music, etc.)
  Dir.glob("#{data_dir}/**/*").each do |file_path|
    next if File.directory?(file_path)  # Skip directories

    # Get the relative path starting from 'data/' by removing everything before it
    relative_path = file_path.sub(/^.*\/data\//, 'data/')
    sha1_hash = calculate_sha1(file_path)
    media_manifest[relative_path] = sha1_hash
  end

  media_manifest
end

# Function to write the media manifest to media.json (overwrite)
def write_media_manifest(directory, media_manifest)
  media_file_path = File.join(directory, 'media.json')
  File.open(media_file_path, 'w') do |file|
    file.write(JSON.pretty_generate(media_manifest))
  end
  puts "Generated media.json in #{directory}"
end

# Function to process each numbered directory
def process_directories(base_dir)
  Dir.glob("#{base_dir}/*/").sort.each do |directory|
    book_id = File.basename(directory)
    media_manifest = generate_media_manifest(directory)

    if ! media_manifest.empty?
      write_media_manifest(directory, media_manifest)
    end
  end
end

# Start processing directories
process_directories(BASE_DIR)

puts "Processing completed."
