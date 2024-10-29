#!/usr/bin/env ruby
require 'json'

# Paths
META_DB_PATH = '../metadatabase1.1.json'  # Path to metadatabase1.1.json
HOME_DIR = '/home/globewalldesk/ZWIBook/book_zwis'  # Path to the book_zwis directory in the home directory

# Step 1: Read the metadatabase1.1.json
def read_metadatabase
  unless File.exist?(META_DB_PATH)
    puts "File #{META_DB_PATH} not found."
    exit
  end

  JSON.parse(File.read(META_DB_PATH))
end

# Step 2: Collect ZWI files in the home directory
def read_zwi_files
  Dir.glob("#{HOME_DIR}/*.zwi").map { |f| File.basename(f, '.zwi').to_i }
end

# Step 3: Check if the metadatabase matches the ZWI files in the home directory
def check_metadatabase_vs_home(metadatabase, zwi_files)
  json_pg_ids = metadatabase.map { |entry| entry["PG_ID"].to_i }

  # Find ZWI files with no corresponding JSON record
  missing_json = zwi_files - json_pg_ids
  unless missing_json.empty?
    puts "ZWI files with no JSON record: #{missing_json.join(', ')}"
  end

  # Find JSON records with no corresponding ZWI file
  missing_zwi = json_pg_ids - zwi_files
  unless missing_zwi.empty?
    puts "JSON records with no ZWI file: #{missing_zwi.join(', ')}"
  end

  # Report if all matches are found
  if missing_json.empty? && missing_zwi.empty?
    puts "All ZWI files have corresponding JSON records, and all JSON records have corresponding ZWI files."
  end
end

# Main execution
puts "Checking metadatabase1.1.json against the home directory ZWI files..."

metadatabase = read_metadatabase
zwi_files = read_zwi_files

check_metadatabase_vs_home(metadatabase, zwi_files)
