# SCRIPT PURPOSE: extract PG_IDs from list of books deleted from PG.

# Sample text as a string
text = <<-TEXT
Donkeys to bald pate, by Samuel Mines                                    68429
Victorious failure, by Bryce Walton                                      68432
The Gregory circle, by William Fitzgerald                                68435
In the cards, by George O. Smith                                         68441
The deadly dust, by Murray Leinster                                      68455
The jet jockeys, by R. W. Stockheker                                     68456
Quest to Centaurus, by George O. Smith                                   68477
Skit-tree planet, by Murray Leinster                                     68478
The stroller, by Margaret St. Clair                                      68484
A hitch in time, by James MacCreigh                                      68959
You are forbidden!, by Jerry Shelton                                     68968
From beyond the stars, by Will F. Jenkins                                68982
The sky was full of ships, by Theodore Sturgeon                          68992
The nameless something, by William Fitzgerald                            69028
The boomerang circuit, by Murray Leinster                                69048
Atomic Station, by Frank Belknap Long                                    69264
Clutch of Morpheus, by Larry Sternig                                     69278
Come home from Earth, by Edmond  Hamilton                                69279
Information please, by Stanley Whiteside                                 69291
A matter of size, by Samuel Mines                                        69292
The pleasure age, by Joed Cahill                                         69293
Forgotten world, by Edmond Hamilton                                      69357
Siren satellite, by Arthur K. Barnes                                     69358
The disciplinary circuit, by Murray Leinster                             69448
The manless worlds, by Murray Leinster                                   69465
They wouldn't dare, by Samuel Mines                                      69505
The irritated people, by Ray Bradbury                                    69506
Piety, by Margaret St. Clair                                             69516
The long way back, by John Barrett                                       69564
The admiral's walk, by Sam Merwin                                        69565
The timeless tomorrow, by Manly Wade Wellman                             69652
Quarantine, by George O. Smith                                           69658
Space-Can, by Murray Leinster                                            69659
The knowledge machine, by Edmond Hamilton                                69665
Regulations, by Murray Leinster                                          69666
Referent, by Brett Sterling                                              69687
Softie, by Noel Loomis                                                   69688
The Devil of East Lupton, Vermont, by William Fitzgerald                 69694
The square pegs, by Ray Bradbury                                         69708
Date line, by Benj. Miller                                               69709
Reverse English, by John S. Carroll                                      69713
Galactic heritage, by Frank Belknap Long                                 69719
The shape of things, by Ray Bradbury                                     69722
The cosmic jackpot, by George O. Smith                                   69731
Transuranic, by Edmond Hamilton                                          69729
Memory, by Theodore Sturgeon                                             69733
"I like you, too--", by Joe Gibson                                       69742
The sleeper is a rebel, by Bryce Walton                                  69778
The seven temporary moons, by William Fitzgerald                         69796
Climate--incorporated, by Wesley Long                                    69820
Consulate, by William Tenn                                               69821
Ahead of his time, by Ray Cummings                                       69833
The foxholes of Mars, by Fritz Leiber                                    69919
Schizophrenic, by Noel Loomis                                            69921
Papa knows best, by Wallace Umphrey                                      69926
Fuzzy head, by Frank Belknap Long                                        69931
A horse on me, by Benj. Miller                                           69932
The ionian cycle, by William Tenn                                        69940
Jigsaw, by Tom McMorrow                                                  69999
Metamorphosis, by Mike Curry                                             70001
Flight Eighteen, by Paul A. Torak                                        70003
If at first, by Bill Venable                                             70005
Moon dust, by Oliver Saari                                               70012
The Trans-Galactic Twins, by George O. Smith                             70015
Sibling, by Leslie Waltham                                               70155
Bombs awry, by George O. Smith                                           70160
Arbiter, by Sam Merwin                                                   70173
The dreamers, by Lu Kella                                                70183
Daughter, by Philip José Farmer                                          70184
The agile Algolian, by Kendell Foster Crossen                            70212
The belly of Gor Jeetl, by Charles A. Stearns                            70215
Booby prize, by George O. Smith                                          70216
The gadget had a ghost, by Murray Leinster                               70218
The Mobius trail, by George O. Smith                                     70227
The ghost planet, by Murray Leinster                                     70230
Whistle stop in space, by Kendell Foster Crossen                         70239
Fruits of the agathon, by Charles L. Harness                             70240
Prize ship, by Philip K. Dick                                            70242
Second landing, by Murray Leinster                                       70247
The moon that vanished, by Leigh Brackett                                70250
Yesterday's doors, by Arthur J. Burks                                    70251
Mr. Zytztz goes to Mars, by Noel Loomis                                  70257
TEXT

# Extract all five-digit numbers at the end of each line
numbers = text.scan(/\d{5}$/)

# Output the array of numbers in the required format
puts numbers.map(&:to_i).inspect

