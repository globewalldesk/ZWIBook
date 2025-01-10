#!/usr/bin/env ruby

# Copies the master drive contents to a new empty flash drive.

# Get the drive number from the command-line arguments
if ARGV.length != 1
  puts "Usage: ruby #{__FILE__} <drive_number|none>"
  exit(1)
end

drive_number = ARGV[0] == "none" ? "" : ARGV[0]

puts "Starting copy process to flash drive ZWIBook#{drive_number}. Please ensure the drive is empty and mounted correctly."

# Define the rsync commands with placeholders for the drive number
commands = [
  "rsync -av --delete --info=progress2 /home/globewalldesk/ZWIBook/v1.1/Windows/ /media/globewalldesk/ZWIBook#{drive_number}/Windows/",
  "rsync -av --delete --info=progress2 --ignore-existing /home/globewalldesk/ZWIBook/book_zwis/ /media/globewalldesk/ZWIBook#{drive_number}/book_zwis/",
  "rsync -av --delete --info=progress2 /home/globewalldesk/ZWIBook/v1.1/Mac/ /media/globewalldesk/ZWIBook#{drive_number}/Mac/",
  "rsync -av --delete --info=progress2 /home/globewalldesk/ZWIBook/v1.1/Linux/ /media/globewalldesk/ZWIBook#{drive_number}/Linux/",
  "rsync -av --delete --info=progress2 /home/globewalldesk/ZWIBook/sample_bookshelf_notes/ /media/globewalldesk/ZWIBook#{drive_number}/sample_bookshelf_notes/",
  "rsync -av --delete --info=progress2 /home/globewalldesk/ZWIBook/START_HERE.pdf /media/globewalldesk/ZWIBook#{drive_number}/",
  "rsync -av --delete --info=progress2 /home/globewalldesk/ZWIBook/.metadata_never_index /media/globewalldesk/ZWIBook#{drive_number}/"
]

# Execute each command
commands.each do |command|
  puts "============================="
  puts "Running: #{command}"
  system(command)

  if $?.exitstatus != 0
    puts "Error encountered during the execution of the following command:"
    puts command
    exit(1)
  end
end

puts "All files successfully copied to flash drive ZWIBook#{drive_number}."
