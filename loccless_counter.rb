require 'json'
require 'set'

# Load the JSON data from 'metadatabase.json'
file = File.read('metadatabase.json')
data = JSON.parse(file)

# Initialize counters and sets
count_without_locc = 0
unique_topics = Set.new
count_without_topics = 0

# Iterate through each record to check for LoCC numbers and collect unique topics
data.each do |record|
  # Count records without an LoCC number
  count_without_locc += 1 if record['LoCC'].nil? || record['LoCC'].empty?
  
  # Process topics
  if record['Topics'].nil? || record['Topics'].empty?
    count_without_topics += 1
  else
    unique_topics.merge(record['Topics']) # Add topics to the set, which handles uniqueness automatically
  end
end

# Output the results
puts "Number of records without an LoCC number: #{count_without_locc}"
puts "Total number of unique topic types: #{unique_topics.size}"
puts "Number of records without Topics: #{count_without_topics}"
