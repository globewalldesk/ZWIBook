#!/usr/bin/env ruby
require 'fileutils'
require 'zip'

# Directory where the files and directories are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# Function to check if a file is a plain text file based on its contents
def is_text_file?(file_path)
  first_bytes = File.read(file_path, 100) # Read the first 100 bytes
  first_bytes.match?(/\A[\x20-\x7E\s]+\z/) # Check if the content is printable characters
end

# Function to check if a file is a ZIP file based on its signature
def is_zip_file?(file_path)
  File.open(file_path, "rb") do |f|
    signature = f.read(4)
    signature == "\x50\x4B\x03\x04" # ZIP file signature
  end
end

# Function to extract a TXT file from a ZIP file, if it exists
def extract_txt_from_zip(zip_path, output_dir)
  Zip::File.open(zip_path) do |zip_file|
    zip_file.each do |entry|
      if entry.name.end_with?('.txt')
        entry.extract(File.join(output_dir, entry.name))
        puts "Extracted #{entry.name} from #{zip_path}"
      end
    end
  end
end

# Function to rename files in subdirectories, including handling "-h" and "-0"
def rename_files_in_directory(directory)
  Dir.glob("#{directory}/**/*").each do |path|
    next if File.directory?(path) # Skip directories

    # Case 1: Process `70566-0.zip` by extracting the `.txt` and then removing the zip
    if path =~ /-\d+\.zip$/
      if path =~ /-0\.zip$/
        # Extract .txt from the -0.zip and delete the zip
        extract_txt_from_zip(path, File.dirname(path))
        FileUtils.rm(path)
        puts "Deleted: #{path}"

      elsif path =~ /-h\.zip$/
        # Rename `70566-h.zip` to `70566.zip`
        new_path = path.gsub(/-h\.zip$/, '.zip')
        FileUtils.mv(path, new_path)
        puts "Renamed: #{path} -> #{new_path}"

      end

    # Case 2: Rename `.htm.txt`, `.svg.txt`, `.html.txt` to their appropriate extensions
    elsif path.end_with?('.htm.txt') || path.end_with?('.svg.txt') || path.end_with?('.html.txt')
      new_path = path.sub('.txt', '') # Remove the `.txt` part
      FileUtils.mv(path, new_path)
      puts "Renamed: #{path} -> #{new_path}"

    # Case 3: Rename `.htm` to `.html`
    elsif path.end_with?('.htm')
      new_path = path.sub('.htm', '.html')
      FileUtils.mv(path, new_path)
      puts "Renamed: #{path} -> #{new_path}"

    # Case 4: Check for files that should have `.txt` but have no extension and are plain text
    elsif !File.extname(path).match?(/\.(txt|htm|html|svg|pdf|zip)$/) && is_text_file?(path)
      new_path = "#{path}.txt"
      FileUtils.mv(path, new_path)
      puts "Appended .txt: #{path} -> #{new_path}"

    # Case 5: Check for files that are ZIPs but have no `.zip` extension
    elsif !File.extname(path).match?(/\.(txt|htm|html|svg|pdf|zip)$/) && is_zip_file?(path)
      new_path = "#{path}.zip"
      FileUtils.mv(path, new_path)
      puts "Appended .zip: #{path} -> #{new_path}"
    end
  end
end

# Function to count files and directories in the root of /new_zwis
def count_files_and_directories(directory)
  top_level_directories = []
  zip_files = []
  txt_files = []
  other_files = []

  Dir.glob("#{directory}/*").each do |path|
    if File.directory?(path)
      top_level_directories << path
    elsif File.file?(path)
      case File.extname(path)
      when '.zip'
        zip_files << path
      when '.txt'
        txt_files << path
      else
        other_files << path
      end
    end
  end

  # Output the counts
  puts "Top-level directories: #{top_level_directories.size}"
  puts "Files with .zip extension: #{zip_files.size}"
  puts "Files with .txt extension: #{txt_files.size}"
  puts "Other files: #{other_files.size}"
end

# Run the renaming function on the base directory
rename_files_in_directory(base_directory)

# Count files and directories in the root of /new_zwis
count_files_and_directories(base_directory)

puts "Processing completed."
