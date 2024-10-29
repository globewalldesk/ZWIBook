require 'json'
require 'fileutils'

# Paths
intermediate_file_path = './intermediate_authors.json'
base_dir = '/media/globewalldesk/DATA/ProjectGutenberg/new_zwis_unzipped'  # Adjust this to your actual path

# Load the intermediate authors data
authors_data = JSON.parse(File.read(intermediate_file_path))

# Create a hash for quick lookup
authors_hash = authors_data.each_with_object({}) do |entry, hash|
  hash[entry["TextNumber"]] = entry["CreatorNames"]
end

# Iterate through each numbered directory in the base directory
Dir.glob("#{base_dir}/*/").each do |directory|
  metadata_file_path = File.join(directory, 'metadata.json')

  if File.exist?(metadata_file_path)
    # Load the existing metadata
    metadata = JSON.parse(File.read(metadata_file_path))

    # Update CreatorNames if the TextNumber matches
    text_number = File.basename(directory)  # Extract the Text# from the directory name

    if authors_hash.key?(text_number)
      metadata['CreatorNames'] = authors_hash[text_number]

      # Save the updated metadata back to the file
      File.write(metadata_file_path, JSON.pretty_generate(metadata))
      puts "Updated CreatorNames in #{metadata_file_path}"
    else
      puts "No authors found for Text Number: #{text_number}"
    end
  else
    puts "Metadata file not found in #{directory}"
  end
end

puts "All metadata files processed."
