#!/usr/bin/env ruby
require 'nokogiri'

# File path for storing the list of non-public domain books
output_file = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/non_public_domain_books.txt"

# Directory where RDF files are stored
rdf_base_dir = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/PG_data/cache/epub/"

# Load the list of Project Gutenberg book IDs to check
require_relative './files_to_download'

# Function to extract copyright information from RDF
def extract_copyright_status(rdf_file)
  if File.exist?(rdf_file)
    rdf_content = File.read(rdf_file)
    doc = Nokogiri::XML(rdf_content)
    rights = doc.at_xpath('//dcterms:rights')&.text
    return rights unless rights.nil?
  end
  return 'Unknown'
end

# Main script to check all books and identify non-public domain books
non_public_domain_books = []

FILES_TO_DOWNLOAD.each do |book_number|
  rdf_file = File.join(rdf_base_dir, "#{book_number}/pg#{book_number}.rdf")
  rights_status = extract_copyright_status(rdf_file)

  if rights_status != 'Public domain in the USA.'
    non_public_domain_books << book_number
    puts "Book #{book_number}: #{rights_status}"
  end
end

# Save the list to a file
File.open(output_file, 'w') do |file|
  non_public_domain_books.each { |book_number| file.puts(book_number) }
end

# Print a summary of results
puts "\nTotal non-public domain books: #{non_public_domain_books.count}"
puts "List saved to #{output_file}"
