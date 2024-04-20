loc_codes = %w|a ac ae ag am ap as ay az b bc bd bf bh bj bl bm bp bq br bs bt bv bx cb cc cd ce cj cn cr cs ct d da db dc dd de df dg dh dj dk dl dp dq dr ds dt du dx e f g ga gb gc gf gn gr gt gv h ha hb hc hd he hf hg hj hm hn hq hs ht hv hx j ja jc jf jk jl jn jq js jv jx jz k kb kd ke kf kh kj kl kn kp ku kz l la lb lc ld le lf lh lt m ml mt n na nb nc nd ne nk nx p pa pb pc pd pe pf pg ph pj pk pl pm pn pq pr ps pt pz q qa qb qc qd qe qh qk ql qm qp qr r ra rb rc rd re rf rg rj rk rl rm rs rt rv rx rz s sb sd sf sh sk t ta tc td te tf tg th tj tk tl tn tp tr ts tt tx u ua ub uc ud ue uf ug uh v va vb ve vf vg vk vm z za|

# Define the input and output file paths
input_file = 'codes.txt'
tossed_file = 'tossed.txt'
filtered_file = 'codes_filtered.txt'

# Open the input file for reading
File.open(input_file, 'r') do |input|
  # Open the output files for writing
  File.open(tossed_file, 'w') do |tossed_output|
    File.open(filtered_file, 'w') do |filtered_output|
      # Iterate over each line in the input file
      input.each_line do |line|
        # Check if the line matches the specified patterns
        if line.match?(/^\w\ ?: ?/) || line.match?(/^\w\w\: /)
          # Write the line to the filtered output file
          filtered_output.puts(line)
        else
          # Write the line to the tossed output file
          tossed_output.puts(line)
        end
      end
    end
  end
end

puts "Processing complete. Filtered codes written to #{filtered_file}, tossed codes written to #{tossed_file}."
