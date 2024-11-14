require 'fileutils'

# Define the source and target directories
source_directory = File.expand_path('../book_zwis')
target_directory = '/home/globewalldesk/ZWIBook/book_zwis'
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

# Compare file sizes between source and target directories
discrepancies = []
Dir.glob(File.join(target_directory, '*.zwi')).each do |target_file|
  filename = File.basename(target_file)
  source_file = File.join(source_directory, filename)

  # Check if the source file exists
  if File.exist?(source_file)
    source_size = File.size(source_file)
    target_size = File.size(target_file)

    # Record any file size discrepancies
    if source_size != target_size
      discrepancies << "#{filename} - Source: #{source_size} bytes, Target: #{target_size} bytes"
    end
  else
    discrepancies << "#{filename} - File missing in source directory."
  end
end

# Output discrepancies to the console or file
if discrepancies.empty?
  puts "All files in the target directory match the source directory's byte sizes."
else
  puts "Discrepancies found between source and target directories:"
  discrepancies.each { |entry| puts entry }
end
