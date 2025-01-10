#!/usr/bin/env ruby

# Checks whether a flash drive matches the master drive directories.

# Get the drive identifier from the command-line arguments
if ARGV.length != 1
  puts "Usage: ruby #{__FILE__} <drive_number|none>"
  exit(1)
end

drive_identifier = ARGV[0]
drive_path = drive_identifier == "none" ? "ZWIBook" : "ZWIBook#{drive_identifier}"

puts "Starting verification process for flash drive #{drive_path}."
puts "If there are differences, they will be listed below."

# Define the rsync commands for comparison with placeholders for the drive path
commands = [
  {
    source: "/home/globewalldesk/ZWIBook/v1.1/Windows/",
    target: "/media/globewalldesk/#{drive_path}/Windows/"
  },
  {
    source: "/home/globewalldesk/ZWIBook/book_zwis/",
    target: "/media/globewalldesk/#{drive_path}/book_zwis/"
  },
  {
    source: "/home/globewalldesk/ZWIBook/v1.1/Mac/",
    target: "/media/globewalldesk/#{drive_path}/Mac/"
  },
  {
    source: "/home/globewalldesk/ZWIBook/v1.1/Linux/",
    target: "/media/globewalldesk/#{drive_path}/Linux/"
  }
]

# Verify each directory
commands.each do |cmd|
  source = cmd[:source]
  target = cmd[:target]

  puts "============================="
  puts "Verifying: #{source} -> #{target}"

  # Run rsync command and capture the output
  diff_command = "rsync -avn --itemize-changes #{source} #{target}"
  raw_output = `#{diff_command}`

  # Process the output: Exclude lines with specified patterns
  filtered_output = raw_output.lines.reject do |line|
    line.start_with?(".f...p.....") || # Files with only permission changes
    line.start_with?(">f..tp.....") || # Files with timestamp and permission changes
    line.start_with?(">f..t......") || # Files with only timestamp changes
    line.start_with?(".d") ||          # Directory metadata changes
    line.strip.empty?                  # Empty lines
  end

  # Print results
  if filtered_output.empty?
    puts "No differences found for #{source}."
  else
    puts "Differences detected for #{source}:"
    puts filtered_output.join
  end
end

puts "Verification process completed for flash drive #{drive_path}."
