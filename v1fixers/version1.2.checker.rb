#!/usr/bin/env ruby
require 'fileutils'

# Paths
HOME_BOOK_ZWIS_DIR = '/home/globewalldesk/ZWIBook/book_zwis'         # The main home book_zwis directory
SOURCE_BOOK_ZWIS_DIR = '../book_zwis'                                # Source directory with potentially higher-numbered ZWIs
NEW_BOOK_ZWIS_DIR = '/home/globewalldesk/ZWIBook/v1.2.book_zwis'     # New folder for higher-numbered ZWIs

# Step 1: Find the highest-numbered ZWI in the home book_zwis directory
def find_highest_zwi_number
  zwi_files = Dir.glob("#{HOME_BOOK_ZWIS_DIR}/*.zwi")
  highest_number = zwi_files.map { |f| File.basename(f, '.zwi').to_i }.max
  puts "The highest-numbered ZWI file in the home book_zwis directory is: #{highest_number}"
  highest_number
end

# Step 2: Copy higher-numbered ZWI files from the source directory to the new directory
def copy_higher_numbered_zwi_files(highest_zwi)
  # Create the new directory if it doesn't exist
  FileUtils.mkdir_p(NEW_BOOK_ZWIS_DIR)

  # Get all ZWI files in the source directory
  source_zwi_files = Dir.glob("#{SOURCE_BOOK_ZWIS_DIR}/*.zwi").map { |f| File.basename(f, '.zwi').to_i }

  # Find and copy files with numbers higher than the highest found in the home directory
  source_zwi_files.each do |file_number|
    if file_number > highest_zwi
      source_file = File.join(SOURCE_BOOK_ZWIS_DIR, "#{file_number}.zwi")
      dest_file = File.join(NEW_BOOK_ZWIS_DIR, "#{file_number}.zwi")
      
      # Skip if the file already exists in the destination
      unless File.exist?(dest_file)
        FileUtils.cp(source_file, dest_file)
        puts "Copied #{source_file} to #{dest_file}"
      end
    end
  end

  puts "All higher-numbered ZWI files copied to #{NEW_BOOK_ZWIS_DIR}."
end

# Main execution
puts "Step 1: Finding the highest-numbered ZWI in the home book_zwis directory..."
highest_zwi = find_highest_zwi_number

puts "\nStep 2: Copying higher-numbered ZWI files from ../book_zwis to /v1.2.book_zwis..."
copy_higher_numbered_zwi_files(highest_zwi)



######################
# script that checks if the combination of the two directories
# (/home/globewalldesk/ZWIBook/book_zwis and /home/globewalldesk/ZWIBook/v1.2.book_zwis)
# contains all and only the ZWI files listed in ../metadatabase1.2.json.

require 'json'

# Paths
META_DB_1_2_PATH = '../metadatabase1.2.json'

# Step 1: Get all ZWI files from both directories (home and new directory)
def get_all_zwi_files
  home_zwi_files = Dir.glob("#{HOME_BOOK_ZWIS_DIR}/*.zwi").map { |f| File.basename(f, '.zwi') }
  new_zwi_files = Dir.glob("#{NEW_BOOK_ZWIS_DIR}/*.zwi").map { |f| File.basename(f, '.zwi') }

  all_zwi_files = (home_zwi_files + new_zwi_files).uniq
  puts "Total ZWI files found in both directories: #{all_zwi_files.size}"
  all_zwi_files
end

# Step 2: Get all ZWI PG_IDs from metadatabase1.2.json
def get_metadatabase_pg_ids
  metadatabase = JSON.parse(File.read(META_DB_1_2_PATH))
  metadatabase_pg_ids = metadatabase.map { |entry| entry["PG_ID"] }
  puts "Total ZWI PG_IDs in metadatabase1.2.json: #{metadatabase_pg_ids.size}"
  metadatabase_pg_ids
end

# Step 3: Check if the combination of the two directories has all and only the files in metadatabase1.2.json
def check_zwi_files_vs_metadatabase(all_zwi_files, metadatabase_pg_ids)
  # Convert arrays to sets for easier comparison
  zwi_file_set = all_zwi_files.map(&:to_i).to_set
  meta_pg_id_set = metadatabase_pg_ids.map(&:to_i).to_set

  # Find any files in the directories that are not in the metadatabase
  extra_files = zwi_file_set - meta_pg_id_set
  if extra_files.empty?
    puts "No extra ZWI files found in the directories."
  else
    puts "Extra ZWI files found in the directories: #{extra_files.to_a.join(', ')}"
  end

  # Find any files in the metadatabase that are not in the directories
  missing_files = meta_pg_id_set - zwi_file_set
  if missing_files.empty?
    puts "No missing ZWI files from the directories."
  else
    puts "Missing ZWI files from the directories: #{missing_files.to_a.join(', ')}"
  end
end

# Main execution
puts "Step 1: Gathering all ZWI files from both directories..."
all_zwi_files = get_all_zwi_files

puts "\nStep 2: Gathering all ZWI PG_IDs from metadatabase1.2.json..."
metadatabase_pg_ids = get_metadatabase_pg_ids

puts "\nStep 3: Checking for discrepancies between the ZWI files and the metadatabase..."
check_zwi_files_vs_metadatabase(all_zwi_files, metadatabase_pg_ids)