require 'json'

# Paths
META_DB_1_2_PATH = '../metadatabase1.2.json'
META_DB_1_1_PATH = '../metadatabase1.1.json'
FILES_TO_DELETE_PATH = 'files_to_delete.txt'
HOME_DIR = '/home/globewalldesk/ZWIBook/book_zwis'

# Step 1: Find the highest-numbered ZWI in the home directory
def find_highest_zwi_number
  zwi_files = Dir.glob("#{HOME_DIR}/*.zwi")
  highest_number = zwi_files.map { |f| File.basename(f, '.zwi').to_i }.max
  highest_number
end

# Step 2: Read the files_to_delete list
def read_files_to_delete
  if File.exist?(FILES_TO_DELETE_PATH)
    File.readlines(FILES_TO_DELETE_PATH).map(&:chomp).map(&:to_i).uniq
  else
    puts "File #{FILES_TO_DELETE_PATH} not found."
    exit
  end
end

# Step 3: Filter metadatabase
def filter_metadatabase(highest_zwi, files_to_delete)
  # Read the original metadatabase
  metadatabase = JSON.parse(File.read(META_DB_1_2_PATH))
  
  # Filter out entries where PG_ID is in files_to_delete or higher than highest_zwi
  filtered_metadatabase = metadatabase.reject do |entry|
    pg_id = entry["PG_ID"].to_i
    pg_id > highest_zwi || files_to_delete.include?(pg_id)
  end
  
  filtered_metadatabase
end

# Step 4: Write the filtered metadatabase to metadatabase1.1.json
def write_filtered_metadatabase(filtered_metadatabase)
  File.open(META_DB_1_1_PATH, 'w') do |file|
    file.write(JSON.pretty_generate(filtered_metadatabase))
  end
  puts "New metadatabase written to #{META_DB_1_1_PATH}."
end

# Step 5: Ensure each ZWI file has a JSON record, and each JSON record has a ZWI file
def check_zwi_vs_json(filtered_metadatabase)
  zwi_files = Dir.glob("#{HOME_DIR}/*.zwi").map { |f| File.basename(f, '.zwi') }
  json_pg_ids = filtered_metadatabase.map { |entry| entry["PG_ID"] }

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
end

# Main execution
highest_zwi = find_highest_zwi_number
files_to_delete = read_files_to_delete
filtered_metadatabase = filter_metadatabase(highest_zwi, files_to_delete)
write_filtered_metadatabase(filtered_metadatabase)
check_zwi_vs_json(filtered_metadatabase)
