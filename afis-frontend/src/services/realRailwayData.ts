export const REAL_STATION_DISTANCES: Record<string, Record<string, number>> = {
  Mumbai:     { Delhi:1447, Ahmedabad:491, Pune:192, Surat:263, Nagpur:837, Jaipur:1196, Chennai:1338, Kolkata:1968, Hyderabad:711, Bengaluru:1212, Howrah:1968, Raipur:1176, Bhopal:838, Lucknow:1364, Vizag:1400, Patna:1922, Varanasi:1493, Vijayawada:1085 },
  Delhi:      { Mumbai:1447, Kolkata:1453, Chennai:2182, Bengaluru:2444, Hyderabad:1661, Ahmedabad:935, Jaipur:309, Lucknow:512, Patna:998, Varanasi:764, Nagpur:1093, Bhopal:704, Howrah:1453, Raipur:1312, Surat:1155, Pune:1461, Vizag:1890 },
  Chennai:    { Mumbai:1338, Delhi:2182, Kolkata:1659, Bengaluru:346, Hyderabad:794, Coimbatore:497, Mysuru:497, Vizag:791, Howrah:1659, Nagpur:1073, Vijayawada:432, Pune:1150 },
  Kolkata:    { Mumbai:1968, Delhi:1453, Chennai:1659, Bengaluru:1871, Hyderabad:1495, Patna:531, Howrah:7, Varanasi:671, Nagpur:1085, Raipur:957, Vizag:793, Bhopal:1140, Lucknow:941 },
  Bengaluru:  { Mumbai:1212, Delhi:2444, Chennai:346, Kolkata:1871, Hyderabad:574, Mysuru:138, Coimbatore:361, Vijayawada:729, Pune:840, Vizag:1088 },
  Hyderabad:  { Mumbai:711, Delhi:1661, Chennai:794, Kolkata:1495, Bengaluru:574, Nagpur:489, Vijayawada:275, Vizag:703, Pune:519, Raipur:633, Bhopal:710 },
  Nagpur:     { Mumbai:837, Delhi:1093, Kolkata:1085, Chennai:1073, Hyderabad:489, Raipur:290, Bhopal:338, Pune:645, Vizag:866, Howrah:1078 },
  Ahmedabad:  { Mumbai:491, Delhi:935, Surat:265, Jaipur:627, Bhopal:632, Pune:670 },
  Jaipur:     { Delhi:309, Mumbai:1196, Ahmedabad:627, Lucknow:575, Agra:232, Bhopal:553 },
  Howrah:     { Kolkata:7, Delhi:1453, Chennai:1659, Mumbai:1968, Patna:524, Vizag:792, Varanasi:668, Raipur:950 },
  Vizag:      { Chennai:791, Kolkata:793, Hyderabad:703, Howrah:792, Vijayawada:359, Mumbai:1400, Delhi:1890, Raipur:740 },
  Raipur:     { Mumbai:1176, Nagpur:290, Kolkata:957, Bhopal:495, Howrah:936, Hyderabad:633, Vizag:740 },
  Lucknow:    { Delhi:512, Kolkata:941, Patna:467, Varanasi:286, Agra:370, Bhopal:500 },
  Patna:      { Delhi:998, Kolkata:531, Lucknow:467, Varanasi:212, Howrah:524 },
  Pune:       { Mumbai:192, Hyderabad:519, Nagpur:645, Bengaluru:840, Chennai:1150, Ahmedabad:670 },
  Surat:      { Mumbai:263, Ahmedabad:265, Delhi:1155 },
  Bhopal:     { Delhi:704, Mumbai:838, Nagpur:338, Raipur:495, Ahmedabad:632, Jaipur:553, Lucknow:500, Hyderabad:710 },
  Varanasi:   { Delhi:764, Kolkata:671, Lucknow:286, Patna:212, Howrah:668 },
  Vijayawada: { Chennai:432, Hyderabad:275, Vizag:359, Bengaluru:729 },
  Coimbatore: { Chennai:497, Bengaluru:361 },
  Mysuru:     { Bengaluru:138, Chennai:497 },
  Agra:       { Delhi:195, Jaipur:232, Lucknow:370 },
};

export const REAL_FREIGHT_VOLUMES: Record<string, Record<string, number>> = {
  Coal:       { Kolkata:4850000, Howrah:4200000, Raipur:3900000, Nagpur:3200000, Mumbai:2800000, Delhi:2600000, Patna:2400000, Vizag:2100000, Hyderabad:1900000, Bhopal:1700000 },
  Steel:      { Mumbai:3200000, Kolkata:2800000, Delhi:2400000, Bengaluru:1900000, Hyderabad:1700000, Chennai:1600000, Howrah:2100000, Nagpur:1400000, Vizag:1300000 },
  Petroleum:  { Mumbai:5100000, Chennai:4200000, Kolkata:3100000, Delhi:2900000, Vizag:2400000, Hyderabad:2100000, Ahmedabad:1800000, Bengaluru:1600000, Pune:1200000 },
  Cement:     { Mumbai:2900000, Delhi:2400000, Chennai:1900000, Hyderabad:1700000, Bengaluru:1500000, Ahmedabad:1400000, Jaipur:1200000, Nagpur:1100000, Raipur:1000000 },
  Fertilizer: { Chennai:1800000, Mumbai:1600000, Kolkata:1400000, Vizag:1300000, Delhi:1200000, Hyderabad:1100000, Bengaluru:900000 },
  Grains:     { Delhi:2100000, Lucknow:1800000, Patna:1600000, Kolkata:1400000, Mumbai:1300000, Jaipur:1100000, Bhopal:900000 },
};

export const SEASONAL_FACTORS: Record<number, number> = {
  1:0.92, 2:0.95, 3:1.02, 4:0.98, 5:0.96,
  6:0.90, 7:0.88, 8:0.89, 9:0.95, 10:1.05, 11:1.08, 12:1.10,
};
