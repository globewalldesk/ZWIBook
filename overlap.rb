require 'csv'

# Define the arrays for loc_codes and codes.csv data
loc_codes = %w|a ac ae ag am ap as ay az b bc bd bf bh bj bl bm bp bq br bs bt bv bx cb cc cd ce cj cn cr cs ct d da db dc dd de df dg dh dj dk dl dp dq dr ds dt du dx e f g ga gb gc gf gn gr gt gv h ha hb hc hd he hf hg hj hm hn hq hs ht hv hx j ja jc jf jk jl jn jq js jv jx jz k kb kd ke kf kh kj kl kn kp ku kz l la lb lc ld le lf lh lt m ml mt n na nb nc nd ne nk nx p pa pb pc pd pe pf pg ph pj pk pl pm pn pq pr ps pt pz q qa qb qc qd qe qh qk ql qm qp qr r ra rb rc rd re rf rg rj rk rl rm rs rt rv rx rz s sb sd sf sh sk t ta tc td te tf tg th tj tk tl tn tp tr ts tt tx u ua ub uc ud ue uf ug uh v va vb ve vf vg vk vm z za|
csv_data = CSV.read('codes.csv', col_sep: '|')

# Extract codes from codes.csv
codes_csv = csv_data.map { |row| row[0].downcase }

# Items on loc_codes only
loc_only = loc_codes - codes_csv

# Items on codes.csv only
csv_only = codes_csv - loc_codes

# Items on both lists (disregarding case)
both = loc_codes.select { |code| codes_csv.include?(code.downcase) }

# Display the lists
puts "Items on loc_codes only:"
puts loc_only.join(', ')

puts "\nItems on codes.csv only:"
puts csv_only.join(', ')

puts "\nItems on both lists (disregarding case):"
puts both.join(', ')
