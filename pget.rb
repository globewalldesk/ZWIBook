require 'httparty'
require 'ruby-progressbar'

# Function to download a file and return true on success
def download_file(url, save_path)
  begin
    response = HTTParty.get(url, stream_body: true) do |fragment|
      if fragment.code == 200
        open(save_path, "ab") { |file| file.write(fragment) }
      else
        raise "Failed to download: #{url}, received status code: #{fragment.code}"
      end
    end
    true
  rescue => e
    [false, e.message]
  end
end

# Setup directories
Dir.mkdir('book_zwis') unless Dir.exist?('book_zwis')

# Get a list of already downloaded .zwi files
downloaded_files = Dir.glob('./book_zwis/*.zwi').map { |f| File.basename(f) }

# Read the list of URLs
urls = File.readlines('book_urls.txt').map(&:strip)

# Modify each URL for direct .zwi download
urls.map! do |url|
  filename = File.basename(url, ".*") # Removed .zwi here to keep original basename for filename modification
  "#{url}&download&filename=#{filename}.zwi"
end

# Initialize the progress bar
progressbar = ProgressBar.create(total: urls.size, format: '%a %B %p%% %t')

# Logs and errors
errors = []

# Iterate over the list and download each file
urls.each do |url|
  # Extract the correct filename from the modified URL
  filename = url.split('&').first.split('/').last

  # Skip if already downloaded
  next if downloaded_files.include?(filename)

  save_path = "./book_zwis/#{filename}"
  success, error_message = download_file(url, save_path)

  unless success
    errors << url
    File.open('errors.txt', 'a') { |file| file.puts("#{url} - #{error_message}") }
  end

  # Update progress bar
  progressbar.increment

  # Sleep for 1 second to be polite and avoid overloading the server
  sleep(1)
end

progressbar.finish

puts "Download process complete."
puts "#{errors.size} errors encountered. Check errors.txt for details."
