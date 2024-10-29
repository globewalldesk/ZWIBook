#!/usr/bin/env ruby
require 'json'
require 'fileutils'
require 'digest'
require 'charlock_holmes'
require 'nokogiri'

# Function to detect and convert file encoding to UTF-8
def read_file_with_encoding_handling(file_path)
  file_content = File.read(file_path)
  detection = CharlockHolmes::EncodingDetector.detect(file_content)

  # If encoding is not UTF-8, convert it
  if detection && detection[:encoding] && detection[:encoding] != 'UTF-8'
    file_content = CharlockHolmes::Converter.convert(file_content, detection[:encoding], 'UTF-8')
  end

  file_content
end

# Function to extract the <title> tag from the HTML file for ShortTitle
def extract_html_title(html_file)
  return nil unless File.exist?(html_file)

  html_content = read_file_with_encoding_handling(html_file)
  doc = Nokogiri::HTML(html_content)
  doc.at_xpath('//title')&.text.strip
end

# Base directories
BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/redone_zwis"
RDF_BASE_DIR = "/media/globewalldesk/DATA/ProjectGutenberg/v1fixers/PG_data/cache/epub"

# Function to extract RDF data, including Title, Lang, CreatorNames, Subjects, and PublicationDate
def extract_rdf_data(book_id)
  rdf_file = File.join(RDF_BASE_DIR, book_id, "pg#{book_id}.rdf")
  return nil unless File.exist?(rdf_file)

  rdf_data = File.read(rdf_file)
  doc = Nokogiri::XML(rdf_data)

  # Define namespaces
  namespaces = {
    "dcterms" => "http://purl.org/dc/terms/",
    "rdf" => "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "pgterms" => "http://www.gutenberg.org/2009/pgterms/",
    "dcam" => "http://purl.org/dc/dcam/"
  }

  # Extract basic fields, clean up the title by removing MARC-style notations like $b
  title = doc.at_xpath('//dcterms:title', namespaces)&.text&.gsub(/\$[a-z]\s+?/, '')&.strip || "Unknown Title"

  lang = doc.xpath('//dcterms:language/rdf:Description/rdf:value', namespaces)&.map(&:text) || []
  creator_names = doc.xpath('//dcterms:creator/pgterms:agent/pgterms:name', namespaces)&.map(&:text) || []
  publication_date = doc.at_xpath('//dcterms:issued', namespaces)&.text || "Unknown Date"

  # Extract subjects and differentiate between Topics and LoCC
  topics = []
  locc = []

  doc.xpath('//dcterms:subject', namespaces).each do |subject|
    # Query the dcam:memberOf attribute explicitly, ensuring correct namespace
    resource = subject.at_xpath('.//dcam:memberOf/@rdf:resource', namespaces)&.value
    value = subject.at_xpath('.//rdf:value', namespaces)&.text&.strip
  
    if resource == "http://purl.org/dc/terms/LCC"
      locc << value
    elsif resource == "http://purl.org/dc/terms/LCSH"
      topics << value
    end
  end

  { 
    title: title, 
    lang: lang, 
    creator_names: creator_names, 
    publication_date: publication_date, 
    topics: topics, 
    locc: locc 
  }
end
  

# Function to set Primary based on available .htm or .txt files
def set_primary_file(directory, metadata)
  # Check if .htm file exists
  htm_file = Dir.glob(File.join(directory, '*.htm')).first
  txt_file = Dir.glob(File.join(directory, '*.txt')).first

  if htm_file
    metadata["Primary"] = File.basename(htm_file)
  elsif txt_file
    metadata["Primary"] = File.basename(txt_file)
  else
    # Loud STDOUT report if neither file is found
    puts "WARNING: No .htm or .txt file found in #{directory}!"
  end
end

# Function to create the metadata.json file with extracted and static fields
def create_metadata_json(directory, book_id, rdf_data)
  metadata = {
    "ZWIversion" => 1.3,
    "Title" => rdf_data[:title],
    "ShortTitle" => rdf_data[:title],  # Placeholder, to be replaced by HTML title if available
    "Topics" => rdf_data[:topics],     # Corrected extraction for topics
    "Lang" => rdf_data[:lang],
    "Content" => {},  # Placeholder for Content (already populated in Part 2)
    "Primary" => "Placeholder Primary",  # Placeholder for Primary (already populated in Part 2)
    "Publisher" => "ProjectGutenberg",
    "CreatorNames" => rdf_data[:creator_names],
    "ContributorNames" => "",
    "LastModified" => Time.now.to_i,
    "TimeCreated" => Time.now.to_i,
    "PublicationDate" => rdf_data[:publication_date],
    "Categories" => "",  # Leave Categories blank as per original plan
    "LoCC" => rdf_data[:locc],         # Corrected extraction for LoCC
    "Rating" => "",
    "Description" => "ZWIBook Archive - Project Gutenberg eBook ##{book_id} titled: #{rdf_data[:title]}",
    "Comment" => "",
    "License" => "Public Domain in the USA",
    "GeneratorName" => "Knowledge Standards Foundation, ZWIBook Project",
    "SourceURL" => "https://gutenberg.org/files/#{book_id}"
  }

  # Function to clean up the ShortTitle by removing unwanted newlines, tabs, and excessive spaces
  def clean_up_title(title)
    # Remove newlines, tabs, and extra spaces
    cleaned_title = title.gsub(/\s+/, ' ').strip
  
    # Remove any trailing year (e.g., "\n1896", " 1896")
    cleaned_title = cleaned_title.gsub(/\s+\d{4}$/, '').strip
  
    cleaned_title
  end
  
  # Extract the <title> tag from HTML file (if available) for ShortTitle, fallback to cleaned RDF title
  html_file = File.join(directory, "#{book_id}.htm")
  short_title = clean_up_title(extract_html_title(html_file) || rdf_data[:title])

  # Clean the Title from RDF data
  title = clean_up_title(rdf_data[:title])

  metadata["Title"] = title
  metadata["ShortTitle"] = short_title
  metadata["Description"] = "ZWIBook Archive - Project Gutenberg eBook ##{book_id} titled: #{title}"

  # Set primary
  metadata["Primary"] = set_primary_file(directory, metadata)

  # Write the metadata.json file in the directory
  metadata_file_path = File.join(directory, 'metadata.json')
  File.open(metadata_file_path, 'w') do |file|
    file.write(JSON.pretty_generate(metadata, indent: '    '))  # Use 4 spaces for indentation
  end
  puts "Generated metadata.json in #{directory}"
end

# Function to process a numbered directory
def process_directory(directory)
  book_id = File.basename(directory)

  # Extract RDF data
  rdf_data = extract_rdf_data(book_id)
  if rdf_data.nil?
    puts "No RDF data found for #{book_id}, skipping."
    return
  end

  # Create the metadata.json file with extracted and static fields
  create_metadata_json(directory, book_id, rdf_data)
end

# Process the directories
Dir.glob("#{BASE_DIR}/*/").sort.each do |directory|
  process_directory(directory)
end

puts "Processing completed."
