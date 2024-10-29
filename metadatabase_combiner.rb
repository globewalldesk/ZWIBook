require 'json'

# Read the existing metadatabase
metadatabase_path = './database/metadatabase.json'
old_path = './metadatabase1.2.json'
update_path = './database/missing_data_generated.json'

# Load existing data
metadatabase = JSON.parse(File.read(old_path))
# Load the update data
update_data = JSON.parse(File.read(update_path))

# Combine the two datasets
combined_data = metadatabase + update_data

# Save the combined data back to metadatabase.json
File.write(metadatabase_path, JSON.pretty_generate(combined_data))
