require 'fileutils'

# Define the source and target directories
source_directory = '/home/backup-server/ZWIBook/book_zwis'
target_directory = '/media/backup-server/ZWIBook1/book_zwis'
manifest_path = File.join(File.dirname(target_directory), 'manifest.txt')

# Generate a manifest with file sizes from the source directory
File.open(manifest_path, 'w') do |manifest_file|
  manifest_file.puts("Manifest of file sizes from the source directory: #{source_directory}\n")

  # Get all .zwi files in the source directory and write their sizes to manifest.txt
  Dir.glob(File.join(source_directory, '*.zwi')).each do |source_file|
    filename = File.basename(source_file)
    file_size = File.size(source_file)
    manifest_file.puts("#{filename}: #{file_size} bytes")
  end
end

puts "Manifest created at #{manifest_path}."

# Compare file sizes between source and target directories and copy missing or 0-byte files
discrepancies = []
Dir.glob(File.join(source_directory, '*.zwi')).each do |source_file|
  filename = File.basename(source_file)
  target_file = File.join(target_directory, filename)

  if File.exist?(target_file)
    source_size = File.size(source_file)
    target_size = File.size(target_file)

    # Handle 0-byte files and size mismatches
    if target_size == 0
      puts "Copying #{filename} from source to target (target file is 0 bytes)"
      FileUtils.cp(source_file, target_file)
    elsif source_size != target_size
      discrepancies << "Size mismatch: #{filename} - Source: #{source_size} bytes, Target: #{target_size} bytes"
      FileUtils.cp(source_file, target_file)
    end
  else
    # If the file is missing in the target directory, copy it over
    puts "Copying missing file #{filename} from source to target"
    FileUtils.cp(source_file, target_file)
  end
end

# Output discrepancies to the console
if discrepancies.empty?
  puts "All files in the target directory match the source directory's byte sizes, except for the missing or 0-byte files, which have been copied."
else
  puts "Discrepancies found between source and target directories (not including missing or 0-byte files):"
  discrepancies.each { |entry| puts entry }
end