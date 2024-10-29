require 'fileutils'

# Paths for home and flash drive
HOME_PATH = "/home/globewalldesk/ZWIBook/book_zwis"
FLASH_DRIVE_PATH = "/media/globewalldesk/ZWIBook1/book_zwis"

# Step 1: Get all ZWI files from both directories
def get_zwi_files(path)
  Dir.glob("#{path}/*.zwi").map { |file| File.basename(file) }
end

# Step 2: Remove files from the flash drive that are not in the home directory
def remove_extra_files(home_files, flash_files)
  files_to_remove = flash_files - home_files
  files_to_remove.each do |file|
    file_path = File.join(FLASH_DRIVE_PATH, file)
    if File.exist?(file_path)
      FileUtils.rm(file_path)
      puts "Removed: #{file_path}"
    end
  end
end

# Step 3: Copy missing files from home directory to flash drive
def copy_missing_files(home_files, flash_files)
  files_to_copy = home_files - flash_files
  files_to_copy.each do |file|
    source_file = File.join(HOME_PATH, file)
    destination_file = File.join(FLASH_DRIVE_PATH, file)
    if File.exist?(source_file)
      FileUtils.cp(source_file, destination_file)
      puts "Copied: #{file} to #{FLASH_DRIVE_PATH}"
    end
  end
end

# Main Execution
home_files = get_zwi_files(HOME_PATH)
flash_files = get_zwi_files(FLASH_DRIVE_PATH)

puts "Checking files..."
remove_extra_files(home_files, flash_files)
copy_missing_files(home_files, flash_files)

puts "Synchronization complete."
