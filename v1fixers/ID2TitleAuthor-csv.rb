require 'csv'

# Input list of Text#s (in the desired order)
text_numbers = [
  8218, 30151, 42911, 28363, 34419, 4742, 22746, 12479, 3204, 3203, 
  18609, 18608, 31978, 8290, 23053, 8291, 672, 8063, 24146, 303, 
  19394, 8064, 2840, 6419, 6348, 6161, 6349, 6420, 33730, 8284, 
  8057, 8371, 3202, 12701, 8214, 28409, 11262, 30154, 4663, 30152, 
  11261, 14557, 8421, 33374, 4662, 27204, 33375, 30153, 255, 8258, 
  2322, 8851, 8370, 8852, 8031
]


# Hash to store results in the order of the input list
results = {}

# Read the pg_catalog.csv file
CSV.foreach("pg_catalog.csv", headers: true) do |row|
  text_num = row['Text#'].to_i
  # Only store rows with a matching Text#
  if text_numbers.include?(text_num)
    results[text_num] = [row['Title'], row['Authors']]
  end
end

# Output the results in the order of the input list
CSV.open("output.csv", "w") do |output_csv|
  text_numbers.each do |text_num|
    if results[text_num]
      output_csv << [text_num, results[text_num][0], results[text_num][1]]
    end
  end
end

puts "Output CSV has been generated as 'output.csv'."
