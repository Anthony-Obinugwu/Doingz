// Quick fire question bank. `a` is the right answer, `w` the three wrong ones.
// The server shuffles the options per player, and never sends `a` to the phone before an answer.
// Keep facts stable: no current office holders, prices or "latest" anything.

const Q = (cat, q, a, ...w) => ({ cat, q, a, w });

const HAND_WRITTEN = [
  // Slang and Pidgin
  Q("Slang", "In Pidgin, \"Wetin\" means…", "What", "Where", "When", "Who"),
  Q("Slang", "If your friend says they want to \"japa\", they plan to…", "Move abroad", "Get married", "Start a business", "Go to sleep"),
  Q("Slang", "\"Sapa\" is slang for…", "Being broke", "A long journey", "A big party", "Heavy rain"),
  Q("Slang", "\"No wahala\" means…", "No problem", "No money", "No light", "No food"),
  Q("Slang", "In Pidgin, to \"chop\" is to…", "Eat", "Cut", "Run", "Dance"),
  Q("Slang", "\"Gist\" usually means…", "Gossip or news", "Small change", "A traffic jam", "A dance move"),
  Q("Slang", "\"Shine your eye\" is advice to…", "Stay alert", "Wear sunglasses", "Sleep early", "Smile more"),
  Q("Slang", "\"Abeg\" means…", "Please", "Thank you", "Goodbye", "Hurry"),
  Q("Slang", "\"Go-slow\" is Naija talk for…", "A traffic jam", "A lazy worker", "A slow song", "A long queue at the bank"),
  Q("Slang", "\"Sharp sharp\" means…", "Quickly", "Carefully", "Expensive", "Very clever"),
  Q("Slang", "In Naija slang, \"NEPA has taken light\" means…", "There's a power cut", "The sun has set", "A bulb is broken", "The phone is dead"),
  Q("Slang", "An \"agbero\" is…", "A motor park tout", "A market seller", "A night guard", "A palm wine tapper"),
  Q("Slang", "\"Awoof\" means something that is…", "Free", "Stolen", "Spoilt", "Borrowed"),
  Q("Slang", "\"Gbese\" means…", "Debt", "Luck", "Food", "Friend"),
  Q("Slang", "\"Owambe\" is a…", "Lavish party", "Market day", "Kind of soup", "School exam"),
  Q("Slang", "\"Aso ebi\" is…", "Matching fabric worn by a group at an event", "A kind of bead", "A wedding cake", "A talking drum"),
  Q("Slang", "\"How far?\" is a Pidgin way to say…", "How are you?", "How much?", "Is it far?", "Where are you going?"),
  Q("Slang", "\"Oyinbo\" refers to…", "A foreigner, especially a white person", "A rich person", "An elder", "A village chief"),
  Q("Slang", "In Naija slang, a \"mumu\" is…", "A fool", "A mother", "A baby", "A spirit"),
  Q("Slang", "\"Yawa\" means…", "Trouble or embarrassment", "Good luck", "Free food", "Fresh clothes"),
  Q("Slang", "\"Small chops\" are…", "Party finger foods", "Coins", "Short trips", "Little children"),

  // Languages
  Q("Languages", "\"Kedu\" is a greeting in which language?", "Igbo", "Yoruba", "Hausa", "Efik"),
  Q("Languages", "\"Sannu\" is a greeting in which language?", "Hausa", "Igbo", "Yoruba", "Tiv"),
  Q("Languages", "\"E kaaro\" means good morning in…", "Yoruba", "Igbo", "Hausa", "Ijaw"),
  Q("Languages", "\"Nagode\" means \"thank you\" in…", "Hausa", "Yoruba", "Igbo", "Edo"),
  Q("Languages", "\"Daalu\" means \"thank you\" in…", "Igbo", "Hausa", "Yoruba", "Fulfulde"),
  Q("Languages", "In Igbo, \"biko\" means…", "Please", "Come", "Thank you", "Goodbye"),
  Q("Languages", "\"Ina kwana\" is a morning greeting in…", "Hausa", "Igbo", "Yoruba", "Efik"),
  Q("Languages", "\"Ndewo\" is a greeting in…", "Igbo", "Hausa", "Yoruba", "Kanuri"),
  Q("Languages", "\"Eko\" is the Yoruba name for…", "Lagos", "Ibadan", "Abeokuta", "Ilorin"),
  Q("Languages", "In Igbo, \"ofe\" means…", "Soup", "Rice", "Water", "Meat"),
  Q("Languages", "In Yoruba, \"omo\" means…", "Child", "Water", "Money", "House"),

  // Food
  Q("Food", "Which of these is made from yam flour?", "Amala", "Eba", "Fufu", "Tuwo shinkafa"),
  Q("Food", "Eba is made from…", "Garri", "Yam", "Rice", "Corn"),
  Q("Food", "Ewedu soup is made from…", "Jute leaves", "Bitter leaf", "Pumpkin leaves", "Waterleaf"),
  Q("Food", "Gbegiri is a soup made from…", "Beans", "Melon seeds", "Okra", "Palm nuts"),
  Q("Food", "Egusi soup is thickened with ground…", "Melon seeds", "Groundnuts", "Crayfish", "Beans"),
  Q("Food", "Ogbono soup is known for being…", "Drawy", "Crunchy", "Sweet", "Clear"),
  Q("Food", "Akara is made from…", "Beans", "Yam", "Plantain", "Corn"),
  Q("Food", "Moi moi is a steamed pudding made from…", "Beans", "Rice", "Cassava", "Millet"),
  Q("Food", "Dodo is fried…", "Plantain", "Yam", "Potato", "Breadfruit"),
  Q("Food", "Boli is roasted…", "Plantain", "Corn", "Yam", "Fish"),
  Q("Food", "Suya is…", "Spiced grilled meat", "Fried fish", "Bean soup", "Rice cake"),
  Q("Food", "The spice mix rubbed on suya is called…", "Yaji", "Iru", "Ogiri", "Uziza"),
  Q("Food", "Zobo is a drink made from…", "Hibiscus leaves", "Palm sap", "Millet", "Tiger nuts"),
  Q("Food", "Kunu is a drink usually made from…", "Millet or other grains", "Hibiscus", "Coconut", "Palm sap"),
  Q("Food", "Ofada rice is usually eaten with…", "Ayamase stew", "Egusi soup", "Gbegiri", "Banga soup"),
  Q("Food", "Abacha, or African salad, is made from…", "Cassava", "Cabbage", "Yam", "Cocoyam"),
  Q("Food", "Nkwobi is made from…", "Cow foot", "Goat head", "Chicken", "Fish"),
  Q("Food", "Isi ewu is a dish made from…", "Goat head", "Cow tail", "Chicken feet", "Snail"),
  Q("Food", "Tuwo shinkafa is a swallow made from…", "Rice", "Yam", "Cassava", "Plantain"),
  Q("Food", "Miyan kuka is a soup made with…", "Baobab leaves", "Jute leaves", "Bitter leaf", "Okra"),
  Q("Food", "Kuli kuli is a snack made from…", "Groundnuts", "Plantain", "Coconut", "Corn"),
  Q("Food", "Banga soup is made from…", "Palm nut extract", "Melon seeds", "Beans", "Ogbono seeds"),
  Q("Food", "Afang soup comes mainly from which people?", "Efik and Ibibio", "Hausa", "Yoruba", "Kanuri"),
  Q("Food", "Ewa agoyin is…", "Mashed beans with a dark pepper sauce", "Fried yam", "Rice and stew", "Corn pap"),
  Q("Food", "Puff-puff is…", "Fried dough balls", "Steamed rice", "Bean soup", "Grilled corn"),
  Q("Food", "Kilishi is…", "Dried spiced meat", "Fried fish", "Rice pudding", "Groundnut soup"),

  // Lagos
  Q("Lagos", "What is the capital of Lagos State?", "Ikeja", "Lagos Island", "Lekki", "Yaba"),
  Q("Lagos", "The Third Mainland Bridge links Lagos Island to…", "The mainland", "Lekki", "Badagry", "Apapa"),
  Q("Lagos", "Which Lagos market is famous for electronics?", "Alaba", "Balogun", "Mile 12", "Oyingbo"),
  Q("Lagos", "Computer Village is in which part of Lagos?", "Ikeja", "Lekki", "Apapa", "Badagry"),
  Q("Lagos", "Balogun Market on Lagos Island is best known for…", "Fabrics and clothing", "Cars", "Livestock", "Building materials"),
  Q("Lagos", "Nigeria's first storey building, from 1845, is in…", "Badagry", "Epe", "Ikorodu", "Yaba"),
  Q("Lagos", "The National Theatre in Iganmu is said to be shaped like…", "A military cap", "A crown", "A ship", "A calabash"),
  Q("Lagos", "Lagos was Nigeria's capital until…", "1991", "1960", "1976", "2000"),
  Q("Lagos", "The yellow Lagos minibus with black stripes is called a…", "Danfo", "Molue", "Keke", "Okada"),
  Q("Lagos", "A keke is a…", "Tricycle", "Ferry", "Minibus", "Motorbike"),
  Q("Lagos", "Lagos State's slogan is…", "Centre of Excellence", "Gateway State", "Coal City", "Pace Setter"),
  Q("Lagos", "By land area, Lagos is Nigeria's…", "Smallest state", "Largest state", "Third-largest state", "Most northern state"),
  Q("Lagos", "Tarkwa Bay beach in Lagos is mainly reached by…", "Boat", "Train", "Okada", "Cable car"),

  // Naija geography and history
  Q("Naija", "Nigeria became independent on 1 October…", "1960", "1957", "1963", "1966"),
  Q("Naija", "Nigeria became a republic in…", "1963", "1960", "1970", "1979"),
  Q("Naija", "The naira replaced the Nigerian pound in…", "1973", "1960", "1980", "1966"),
  Q("Naija", "How many kobo make one naira?", "100", "10", "50", "1,000"),
  Q("Naija", "How many states does Nigeria have?", "36", "30", "37", "19"),
  Q("Naija", "How many geopolitical zones does Nigeria have?", "6", "4", "5", "8"),
  Q("Naija", "The colours of Nigeria's flag are…", "Green and white", "Green and yellow", "Red and green", "White and blue"),
  Q("Naija", "The Niger and Benue rivers meet at…", "Lokoja", "Onitsha", "Makurdi", "Jebba"),
  Q("Naija", "Nigeria's highest point, Chappal Waddi, is in…", "Taraba State", "Plateau State", "Adamawa State", "Ekiti State"),
  Q("Naija", "Zuma Rock is near…", "Abuja", "Abeokuta", "Jos", "Enugu"),
  Q("Naija", "Olumo Rock is in…", "Abeokuta", "Ibadan", "Osogbo", "Akure"),
  Q("Naija", "Yankari Game Reserve is in…", "Bauchi State", "Kano State", "Oyo State", "Cross River State"),
  Q("Naija", "Obudu Mountain Resort is in…", "Cross River State", "Plateau State", "Ondo State", "Benue State"),
  Q("Naija", "The Osun-Osogbo Sacred Grove is a UNESCO site in…", "Osun State", "Oyo State", "Ogun State", "Kwara State"),
  Q("Naija", "Nigeria's longest river is the…", "Niger", "Benue", "Ogun", "Cross River"),
  Q("Naija", "Which state is called the Food Basket of the Nation?", "Benue", "Kano", "Ogun", "Rivers"),
  Q("Naija", "Which city is known as the Coal City?", "Enugu", "Jos", "Kaduna", "Port Harcourt"),
  Q("Naija", "Which state's slogan is \"Home of Peace and Tourism\"?", "Plateau", "Lagos", "Kwara", "Akwa Ibom"),
  Q("Naija", "Which state is called the Gateway State?", "Ogun", "Lagos", "Kwara", "Niger"),
  Q("Naija", "Which state is known as the Centre of Commerce?", "Kano", "Lagos", "Anambra", "Kaduna"),
  Q("Naija", "Which state is called \"God's Own State\"?", "Abia", "Imo", "Enugu", "Ebonyi"),
  Q("Naija", "Which state is called the Pace Setter State?", "Oyo", "Ogun", "Ondo", "Osun"),
  Q("Naija", "The Kainji Dam is on which river?", "Niger", "Benue", "Kaduna", "Sokoto"),
  Q("Naija", "Nigeria's federal capital moved to Abuja in…", "1991", "1976", "1985", "1999"),
  Q("Naija", "Democracy Day in Nigeria is celebrated on…", "12 June", "1 October", "29 May", "27 May"),
  Q("Naija", "Children's Day in Nigeria is on…", "27 May", "12 June", "1 October", "1 May"),
  Q("Naija", "Nigeria's flag was designed by…", "Taiwo Akinkunmi", "Herbert Macaulay", "Nnamdi Azikiwe", "Obafemi Awolowo"),

  // Culture
  Q("Culture", "Who wrote \"Things Fall Apart\"?", "Chinua Achebe", "Wole Soyinka", "Cyprian Ekwensi", "Buchi Emecheta"),
  Q("Culture", "Wole Soyinka won the Nobel Prize in Literature in…", "1986", "1960", "1999", "1975"),
  Q("Culture", "Afrobeat was pioneered by…", "Fela Kuti", "King Sunny Ade", "Osita Osadebe", "Haruna Ishola"),
  Q("Culture", "The gangan is a kind of…", "Talking drum", "Flute", "Guitar", "Xylophone"),
  Q("Culture", "The udu is an Igbo instrument made from…", "Clay", "Brass", "Bamboo", "Animal horn"),
  Q("Culture", "Fuji music comes mainly from…", "Yoruba culture", "Igbo culture", "Hausa culture", "Efik culture"),
  Q("Culture", "Adire cloth is made by…", "Tie-dyeing or resist-dyeing", "Weaving with gold thread", "Printing on leather", "Knitting"),
  Q("Culture", "The Benin Bronzes come from the historic Kingdom of…", "Benin", "Oyo", "Kano", "Nri"),
  Q("Culture", "An agbada is a…", "Flowing wide-sleeved robe", "Head tie", "Beaded necklace", "Pair of sandals"),
  Q("Culture", "A gele is a…", "Head tie", "Wrapper", "Cap", "Necklace"),
  Q("Culture", "The Argungu Fishing Festival takes place in…", "Kebbi State", "Lagos State", "Rivers State", "Bayelsa State"),
  Q("Culture", "The Eyo Festival is celebrated in…", "Lagos", "Kano", "Calabar", "Jos"),
  Q("Culture", "The Durbar festival is famous for…", "Horse riders in procession", "Boat races", "Masquerades on stilts", "Wrestling"),
  Q("Culture", "The Calabar Carnival is held mainly in…", "December", "April", "July", "February"),
];

// State capitals, built into questions with other capitals as wrong options.
const CAPITALS = [
  ["Abia", "Umuahia"], ["Adamawa", "Yola"], ["Akwa Ibom", "Uyo"], ["Anambra", "Awka"],
  ["Bauchi", "Bauchi"], ["Bayelsa", "Yenagoa"], ["Benue", "Makurdi"], ["Borno", "Maiduguri"],
  ["Cross River", "Calabar"], ["Delta", "Asaba"], ["Ebonyi", "Abakaliki"], ["Edo", "Benin City"],
  ["Ekiti", "Ado-Ekiti"], ["Enugu", "Enugu"], ["Gombe", "Gombe"], ["Imo", "Owerri"],
  ["Jigawa", "Dutse"], ["Kaduna", "Kaduna"], ["Kano", "Kano"], ["Katsina", "Katsina"],
  ["Kebbi", "Birnin Kebbi"], ["Kogi", "Lokoja"], ["Kwara", "Ilorin"], ["Lagos", "Ikeja"],
  ["Nasarawa", "Lafia"], ["Niger", "Minna"], ["Ogun", "Abeokuta"], ["Ondo", "Akure"],
  ["Osun", "Osogbo"], ["Oyo", "Ibadan"], ["Plateau", "Jos"], ["Rivers", "Port Harcourt"],
  ["Sokoto", "Sokoto"], ["Taraba", "Jalingo"], ["Yobe", "Damaturu"], ["Zamfara", "Gusau"],
];

// Deterministic wrong options so a question's options don't change between server restarts.
const capitalQuestions = CAPITALS.filter(([state]) => state !== "Lagos").map(([state, capital], i) => {
  const others = CAPITALS.map(([, c]) => c).filter((c) => c !== capital);
  const pick = (k) => others[(i * 7 + k * 11) % others.length];
  const wrong = [...new Set([pick(1), pick(2), pick(3), pick(4), pick(5)])].slice(0, 3);
  return Q("States", `What is the capital of ${state} State?`, capital, ...wrong);
});

export const TRIVIA = [...HAND_WRITTEN, ...capitalQuestions].map((t, id) => ({ id, ...t }));
