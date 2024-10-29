require 'zip'
require 'json'
require 'ruby-progressbar'

# Setup directories
ZWI_DIR = 'redone_zwis'  # Adjust the directory to 'redone_zwis'
DB_DIR = 'database'

# Make sure the database directory exists
Dir.mkdir(DB_DIR) unless Dir.exist?(DB_DIR)

# Initialize an array to hold all metadata
metadata_collection = []

# Setup progress bar for all ZWI files in the directory
zwi_files = Dir.glob("#{ZWI_DIR}/*.zwi")
puts "Found ZWI files: #{zwi_files}"  # Verbose output to check what files are found

if zwi_files.empty?
  puts "No ZWI files found in #{ZWI_DIR}."  # Verbose output if no ZWI files are found
  exit
end

progressbar = ProgressBar.create(title: "Processing", total: zwi_files.size, format: '%a |%b>>%i| %p%% %t')

# Initialize error log for problematic metadata
error_log = File.join(DB_DIR, 'errors.log')
File.write(error_log, '')

# Initialize log for missing or inadequate metadata
missing_log = File.join(DB_DIR, 'missing_metadata.log')
File.write(missing_log, '')

# Attributes to be omitted
omit_attributes = ["ZWIversion", "ShortTitle", "Lang", "Content", "Publisher", "ContributorNames",
                   "LastModified", "TimeCreated", "PublicationDate", "Categories", "Rating",
                   "Description", "Comment", "License", "GeneratorName", "SourceURL"]

# Iterate over each ZWI file to collect metadata
zwi_files.each do |zwi_file|
  pg_id = File.basename(zwi_file, '.zwi')
  puts "Processing ZWI file: #{zwi_file} (PG ID: #{pg_id})"  # Verbose output for each ZWI file

  begin
    Zip::File.open(zwi_file) do |zip_file|
      # Locate metadata.json within the archive
      metadata_entry = zip_file.glob('metadata.json').first
      if metadata_entry
        puts "Found metadata.json in #{zwi_file}"  # Verbose output

        # Read and parse the metadata.json file content
        begin
          metadata_content = metadata_entry.get_input_stream.read
          metadata = JSON.parse(metadata_content)

          # Remove unwanted attributes
          omit_attributes.each { |attr| metadata.delete(attr) }

          # Add the PG ID to the metadata
          metadata['PG_ID'] = pg_id

          if metadata.empty?
            # Log inadequate metadata
            puts "Inadequate metadata for PG ID #{pg_id}"  # Verbose output
            File.open(missing_log, 'a') do |f|
              f.puts "Inadequate metadata for #{pg_id}"
            end
          else
            metadata_collection << metadata
            puts "Added metadata for PG ID #{pg_id}"  # Verbose output
          end
        rescue JSON::ParserError => e
          error_message = "JSON parsing failed for #{zwi_file}: #{e.message}"
          puts error_message  # Verbose output

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
      else
        # Log missing metadata.json file
        puts "Missing metadata.json for PG ID #{pg_id}"  # Verbose output
        File.open(missing_log, 'a') do |f|
          f.puts "Missing metadata.json for #{pg_id}"
        end
      end
    end
  rescue Zip::Error => e
    error_message = "Error processing ZIP file #{zwi_file}: #{e.message}"
    puts error_message  # Verbose output
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
db_output_path = File.join(DB_DIR, 'missing_data_generated.json')
File.write(db_output_path, JSON.pretty_generate(metadata_collection))

puts "Metadata collection process is complete."
puts "Database saved to #{db_output_path}"  # Verbose output to indicate where the database is saved
puts "Check #{error_log} for details on any errors."
puts "Check #{missing_log} for missing or inadequate metadata."
