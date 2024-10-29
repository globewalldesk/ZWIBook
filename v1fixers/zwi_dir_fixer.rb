require 'fileutils'

# Paths to the directories
SOURCE_DIR = '/media/globewalldesk/DATA/ProjectGutenberg/new_zwis_unzipped'
DEST_DIR = '/media/globewalldesk/DATA/ProjectGutenberg/new_zwis'

# Make sure the destination directory exists
Dir.mkdir(DEST_DIR) unless Dir.exist?(DEST_DIR)

# Function to process the first five folders and create ZWI files
def process_first_five_folders(source_dir, dest_dir)
  # Get the first five folders in the directory
  folders = Dir.glob("#{source_dir}/*/").sort

  # Process each folder
  folders.each do |folder|
    folder_name = File.basename(folder)
    destination_file = File.join(dest_dir, "#{folder_name}.zwi")

    # Change directory to the folder to avoid absolute path issues
    Dir.chdir(folder) do
      # Quietly create the .zwi (ZIP) archive but show errors
      system("zip -r #{destination_file} . > /dev/null")
    end

    puts "Processed folder: #{folder_name}"
  end
end

# Call the function to process the first five folders
process_first_five_folders(SOURCE_DIR, DEST_DIR)
