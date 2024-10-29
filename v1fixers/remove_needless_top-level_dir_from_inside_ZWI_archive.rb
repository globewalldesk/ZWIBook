require 'zip'
require 'fileutils'

# Base directory containing the .zwi files
ZWI_DIR = './redone_zwis'
TEMP_DIR = './temp_zwi_extract'

# Ensure temp directory exists
Dir.mkdir(TEMP_DIR) unless Dir.exist?(TEMP_DIR)

# Function to extract, flatten, and re-archive the ZWI file
def flatten_and_rearchive_zwi(zwi_file)
  extract_path = nil

  # Extract .zwi file to temporary directory
  Zip::File.open(zwi_file) do |zip_file|
    # Extract all files into a temporary directory
    extract_path = File.join(TEMP_DIR, File.basename(zwi_file, '.zwi'))
    Dir.mkdir(extract_path) unless Dir.exist?(extract_path)

    zip_file.each do |entry|
      # Skip top-level directory entries or entries starting with './'
      next if entry.name == '.' || entry.name.start_with?('./')

      entry_path = File.join(extract_path, entry.name)
      FileUtils.mkdir_p(File.dirname(entry_path)) unless File.exist?(File.dirname(entry_path))
      
      # Extract the file
      entry.extract(entry_path)
    end

    # Locate top-level directory
    top_level_dir = Dir.glob("#{extract_path}/*").find { |f| File.directory?(f) }
    if top_level_dir
      # Move the contents of the top-level directory to the parent directory
      Dir.glob("#{top_level_dir}/**/*").each do |item|
        relative_path = item.sub("#{top_level_dir}/", '')
        new_location = File.join(extract_path, relative_path)
        FileUtils.mkdir_p(File.dirname(new_location)) unless File.exist?(File.dirname(new_location))
        FileUtils.mv(item, new_location) unless File.directory?(item)
      end
      # Remove the now-empty top-level directory
      FileUtils.rm_rf(top_level_dir)
    end

    # Create a new .zwi file without the top-level directory
    new_zwi_file = File.join(ZWI_DIR, File.basename(zwi_file))
    File.delete(new_zwi_file) if File.exist?(new_zwi_file)

    # Recompress files into the .zwi archive
    Zip::File.open(new_zwi_file, Zip::File::CREATE) do |new_zip|
      Dir.glob("#{extract_path}/**/*").each do |file|
        relative_path = file.sub("#{extract_path}/", '')
        new_zip.add(relative_path, file) unless File.directory?(file)
      end
    end

    puts "Re-archived without top-level directory: #{File.basename(zwi_file)}"
  end

  # Clean up temporary extracted files
  FileUtils.rm_rf(extract_path) if extract_path
end

# Process all .zwi files in the directory
Dir.glob("#{ZWI_DIR}/*.zwi").each do |zwi_file|
  flatten_and_rearchive_zwi(zwi_file)
end

puts "All ZWI files have been re-archived without top-level directories."
