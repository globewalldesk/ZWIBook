require 'json'
require 'csv'

# Helper method to validate LoCC codes
def valid_locc_code?(code, valid_codes)
  valid_codes.include?(code)
end

# Load metadata from JSON file
file = File.read('metadatabase.json')
data = JSON.parse(file)

# Load valid LoCC codes from codes.csv into an array
valid_codes = []
CSV.foreach('codes.csv', col_sep: '|') do |row|
  valid_codes << row[0]
end

# Hash to store counts of each cleaned LoCC
locc_counts = Hash.new(0)
# Hash to store counts of each original LoCC
original_locc_counts = Hash.new(0)

# Process each book's LoCC codes
data.each do |book|
  if book["LoCC"].nil? || book["LoCC"].empty?
    locc_counts['Amisc'] += 1
    original_locc_counts['Amisc'] += 1
  else
    book["LoCC"].each do |code|
      # Count original code
      original_locc_counts[code] += 1

      # Remove trailing numbers
      cleaned_code = code.gsub(/[0-9]+\.?\d*$/, '')
      # Use 'Amisc' if the cleaned code isn't a valid LoCC code
      cleaned_code = 'Amisc' unless valid_locc_code?(cleaned_code, valid_codes)
      locc_counts[cleaned_code] += 1
    end
  end
end

# Write counts to new CSV file for cleaned codes
CSV.open('locc_counts.csv', 'wb') do |csv|
  csv << ['Cleaned LoCC Code', 'Count']
  locc_counts.each do |code, count|
    csv << [code, count]
  end
end

# Write counts to new CSV file for original codes
CSV.open('original_locc_counts.csv', 'wb') do |csv|
  csv << ['Original LoCC Code', 'Count']
  original_locc_counts.sort.each do |code, count|
    csv << [code, count]
  end
end
