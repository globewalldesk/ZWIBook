#!/usr/bin/env ruby
require 'nokogiri'  # For XML parsing

# SCRIPT PURPOSE: construct list of copyrighted ebook PG_IDs

# Path to the directory containing subdirectories and .rdf files
base_dir = '/media/globewalldesk/DATA/ProjectGutenberg/PG_data/cache/epub'

# Initialize an array to store ebook numbers that are not public domain
non_public_domain_ebooks = []

# Counter to track number of processed files
processed_count = 0

# Iterate through each numbered subdirectory inside `base_dir`
Dir.glob("#{base_dir}/*").each do |subdir|
  next unless File.directory?(subdir)  # Skip if it's not a directory

  # Now, look inside this subdirectory for its numbered `.rdf` file
  rdf_file = Dir.glob("#{subdir}/*.rdf").first
  next unless rdf_file  # Skip if no .rdf file found

  begin
    # Parse the .rdf file using Nokogiri
    rdf_content = File.read(rdf_file)
    doc = Nokogiri::XML(rdf_content)

    # Extract the <pgterms:ebook> 'rdf:about' attribute
    ebook_element = doc.at_xpath('//pgterms:ebook')
    rights_element = doc.at_xpath('//dcterms:rights')

    if ebook_element && rights_element
      rdf_about = ebook_element['rdf:about']
      rights_text = rights_element.text.strip

      # Only collect the ebook number if it's not public domain in the USA
      if rights_text != "Public domain in the USA." && rdf_about.match(/ebooks\/(\d+)/)
        non_public_domain_ebooks << rdf_about.match(/ebooks\/(\d+)/)[1]
      end
    end

    # Increment processed count and print a dot every 1000 files
    processed_count += 1
    print "." if processed_count % 1000 == 0
  rescue => e
    puts "Error processing #{rdf_file}: #{e.message}"
  end
end

# Output the ebook numbers as a comma-separated list
puts "\n\nNon-public domain ebook numbers:"
puts non_public_domain_ebooks.join(', ')
