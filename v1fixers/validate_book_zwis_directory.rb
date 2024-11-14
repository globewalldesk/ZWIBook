require 'zip'
require 'io/console'

# Path to the directory containing the .zwi files
zwi_directory = '../book_zwis'

# Function to check for required files in a ZIP file
def validate_zwi_file(file_path)
  has_text_or_html = false
  has_metadata = false
  has_signature = false

  Zip::File.open(file_path) do |zip_file|
    zip_file.each do |entry|
      # Check for .txt or .htm file
      has_text_or_html = true if entry.name.match?(/\.txt$/i) || entry.name.match?(/\.htm$/i)
      # Check for metadata.json
      has_metadata = true if entry.name == 'metadata.json'
      # Check for signature.json
      has_signature = true if entry.name == 'signature.json'
    end
  end

  # Determine missing components
  missing = []
  missing << "text or HTML file (.txt or .htm)" unless has_text_or_html
  missing << "metadata.json" unless has_metadata
  missing << "signature.json" unless has_signature

  missing
end

# Collect all .zwi files in the directory
zwi_files = Dir.glob(File.join(zwi_directory, '*.zwi'))
total_files = zwi_files.size

# Process each .zwi file in the directory with a progress bar
zwi_files.each_with_index do |zwi_file, index|
  missing_files = validate_zwi_file(zwi_file)
  unless missing_files.empty?
    puts "File #{File.basename(zwi_file)} is missing: #{missing_files.join(', ')}"
  end

  # Display progress bar
  progress = ((index + 1).to_f / total_files * 100).to_i
  print "\rProcessing files: #{progress}% completed (#{index + 1}/#{total_files})"
end

puts "\nValidation complete."
