require 'json'

# Read the contents of dirfiles.txt
lines = File.readlines('dirfiles.txt').map(&:chomp)

# Prepare the list to include in the package.json
included_files = []

lines.each do |line|
  next if line.strip.end_with?(' x') # Skip lines marked with 'x'
  # Check if it is a directory
  if line.strip.end_with?('/')
    included_files << "#{line.strip}**/*" # Include all contents of the directory
  else
    included_files << line.strip # Include the file
  end
end

# Generate the JSON part for the files attribute
json_output = JSON.pretty_generate(included_files)

# Output to stdout or you can write it to a file
puts json_output
