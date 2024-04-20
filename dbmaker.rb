require 'zip'
require 'json'
require 'ruby-progressbar'

# Setup directories
ZWI_DIR = './book_zwis'
DB_DIR = './database'
JSON_DB_PATH = File.join(DB_DIR, 'metadata_database.json')

# Make sure the database directory exists
Dir.mkdir(DB_DIR) unless Dir.exist?(DB_DIR)

# Initialize an array to hold all metadata
metadata_collection = []

# Setup progress bar
zwi_files = Dir.glob("#{ZWI_DIR}/*.zwi")
progressbar = ProgressBar.create(title: "Processing", total: zwi_files.size, format: '%a |%b>>%i| %p%% %t')

# Initialize error log for problematic metadata
error_log = File.join(DB_DIR, 'errors.log')
File.write(error_log, '')

# Attributes to be omitted
omit_attributes = ["ZWIversion", "ShortTitle", "Lang", "Content", "Publisher", "ContributorNames",
                   "LastModified", "TimeCreated", "PublicationDate", "Categories", "Rating",
                   "Description", "Comment", "License", "GeneratorName", "SourceURL"]

# Iterate over each ZWI file to collect metadata
zwi_files.each do |zwi_file|
  pg_id = File.basename(zwi_file, '.zwi')

  begin
    Zip::File.open(zwi_file) do |zip_file|
      # Locate metadata.json within the archive
      metadata_entry = zip_file.glob('metadata.json').first
      if metadata_entry
        # Read and parse the metadata.json file content
        begin
          metadata_content = metadata_entry.get_input_stream.read
          metadata = JSON.parse(metadata_content)

          # Remove unwanted attributes
          omit_attributes.each { |attr| metadata.delete(attr) }

          # Add the PG ID to the metadata
          metadata['PG_ID'] = pg_id
          metadata_collection << metadata
        rescue JSON::ParserError => e
          error_message = "JSON parsing failed for #{zwi_file}: #{e.message}"
          puts error_message

          # Log the error as with other errors
          File.open(error_log, 'a') do |f|
            f.puts error_message
            # Attempt to read the first chunk of the file for inspection
            begin
              invalid_content = metadata_entry.get_input_stream.read(1024) # Read first 1KB
              f.puts "Invalid content start: #{invalid_content.inspect}"
            rescue StandardError => e
              f.puts "Error reading content: #{e.message}"
            end
            f.puts "---"
          end
        end
      end
    end
  rescue Zip::Error => e
    error_message = "Error processing ZIP file #{zwi_file}: #{e.message}"
    puts error_message
    # Log the ZIP-related error as with other errors
    File.open(error_log, 'a') do |f|
      f.puts error_message
      f.puts "---"
    end
  ensure
    # Increment progress bar
    progressbar.increment
  end
end

# Write the metadata collection to a JSON database file
File.write(JSON_DB_PATH, JSON.pretty_generate(metadata_collection))

puts "Metadata database has been created at #{JSON_DB_PATH}"
puts "Check #{error_log} for details on any errors."
