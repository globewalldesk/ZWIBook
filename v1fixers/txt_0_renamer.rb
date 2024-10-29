#!/usr/bin/env ruby
require 'fileutils'

# Directory where the files and directories are stored
base_directory = "/media/globewalldesk/DATA/ProjectGutenberg/new_zwis"

# List of numbered directories where we expect to find '-0.txt' files
directories_to_fix = [
  70770, 70772, 70773, 70798, 70800, 70890, 70892, 70896, 70897, 70915, 70916,
  70931, 70933, 70940, 70941, 70948, 70949, 70960, 70961, 70974, 70975, 70988,
  70990, 71005, 71006, 71014, 71016, 71025, 71040, 71056, 71070, 71071, 71076,
  71077, 71083, 71084, 71102, 71120, 71121, 71136, 71137, 71149, 71161, 71183,
  71189, 71210, 71211, 71216, 71217, 71241, 71242, 71265, 71269, 71270, 71281,
  71288, 71289, 71310, 71311, 71336
]

# Function to rename '-0.txt' files to '.txt'
def rename_txt_files(base_directory, directories_to_fix)
  directories_to_fix.each do |dir_num|
    dir_path = File.join(base_directory, dir_num.to_s)
    old_txt_path = File.join(dir_path, "#{dir_num}-0.txt")
    new_txt_path = File.join(dir_path, "#{dir_num}.txt")

    if File.exist?(old_txt_path)
      FileUtils.mv(old_txt_path, new_txt_path)
      puts "Renamed: #{old_txt_path} -> #{new_txt_path}"
    else
      puts "File not found: #{old_txt_path}"
    end
  end
end

# Run the renaming function
rename_txt_files(base_directory, directories_to_fix)

puts "Renaming process completed."
