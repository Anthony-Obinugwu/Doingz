// Daily word answers. Every word is exactly 5 letters, A–Z only.
// `cat` is shown to the player as a free clue; `meaning` is shown once the puzzle is over.
// Add new words at the END of this list: the daily order is a fixed shuffle of the list,
// so editing or reordering existing entries changes which word falls on which day.

export const ANSWERS = [
  // Food
  { word: "AKARA", cat: "Food", meaning: "Deep-fried bean cakes, a classic breakfast with pap or bread." },
  { word: "AMALA", cat: "Food", meaning: "Smooth brown swallow made from yam flour (elubo), loved with ewedu and gbegiri." },
  { word: "EGUSI", cat: "Food", meaning: "Soup thickened with ground melon seeds and cooked with leafy greens." },
  { word: "EWEDU", cat: "Food", meaning: "Silky soup made from jute leaves, usually served with amala." },
  { word: "GARRI", cat: "Food", meaning: "Granules made from processed cassava, soaked as a drink or turned into eba." },
  { word: "KPOMO", cat: "Food", meaning: "Cooked cow skin, a chewy favourite in stews and pepper soup." },
  { word: "SHAKI", cat: "Food", meaning: "Cow tripe, a regular in Lagos stews and pepper soup." },
  { word: "OFADA", cat: "Food", meaning: "Local unpolished rice named after a town in Ogun State, eaten with spicy ayamase stew." },
  { word: "AGIDI", cat: "Food", meaning: "Firm corn-starch pudding wrapped in leaves, also called eko." },
  { word: "ABULA", cat: "Food", meaning: "The full combo: amala served with both gbegiri and ewedu." },
  { word: "OGIRI", cat: "Food", meaning: "Fermented seed seasoning with a strong aroma, used to flavour soups." },
  { word: "OKAZI", cat: "Food", meaning: "Leafy vegetable, also called afang, used in Igbo and Efik soups." },
  { word: "UTAZI", cat: "Food", meaning: "Slightly bitter leaf used in Igbo dishes such as nkwobi and pepper soup." },
  { word: "BUKKA", cat: "Food", meaning: "A local roadside restaurant serving home-style meals." },

  // Getting around
  { word: "DANFO", cat: "Transport", meaning: "The yellow minibus with black stripes that carries Lagos around." },
  { word: "OKADA", cat: "Transport", meaning: "A motorcycle taxi." },

  // Lagos
  { word: "IKEJA", cat: "Lagos", meaning: "The capital of Lagos State." },
  { word: "LEKKI", cat: "Lagos", meaning: "Fast-growing peninsula east of Victoria Island, full of estates and beaches." },
  { word: "IKOYI", cat: "Lagos", meaning: "Upscale neighbourhood on the island side of Lagos." },
  { word: "APAPA", cat: "Lagos", meaning: "Lagos district that is home to a major seaport." },
  { word: "ALABA", cat: "Lagos", meaning: "Alaba International Market in Ojo, famous for electronics." },
  { word: "OJOTA", cat: "Lagos", meaning: "Lagos area with a major bus park and interchange." },
  { word: "IJORA", cat: "Lagos", meaning: "Lagos district near Apapa, known for the Ijora causeway." },
  { word: "AGEGE", cat: "Lagos", meaning: "Lagos suburb that gave its name to soft, dense Agege bread." },

  // Naija cities
  { word: "ABUJA", cat: "Naija city", meaning: "The Federal Capital Territory, Nigeria's capital since 1991." },
  { word: "BENIN", cat: "Naija city", meaning: "Benin City, capital of Edo State, famous for its bronzes." },
  { word: "ENUGU", cat: "Naija city", meaning: "Capital of Enugu State, known as the Coal City." },
  { word: "WARRI", cat: "Naija city", meaning: "Oil city in Delta State." },
  { word: "ASABA", cat: "Naija city", meaning: "Capital of Delta State, across the River Niger from Onitsha." },
  { word: "AKURE", cat: "Naija city", meaning: "Capital of Ondo State." },
  { word: "MINNA", cat: "Naija city", meaning: "Capital of Niger State." },
  { word: "ZARIA", cat: "Naija city", meaning: "Ancient city in Kaduna State, home to Ahmadu Bello University." },
  { word: "GOMBE", cat: "Naija city", meaning: "Capital of Gombe State." },
  { word: "NNEWI", cat: "Naija city", meaning: "Anambra commercial town known for its motor parts trade." },
  { word: "LAFIA", cat: "Naija city", meaning: "Capital of Nasarawa State." },
  { word: "DUTSE", cat: "Naija city", meaning: "Capital of Jigawa State." },
  { word: "GUSAU", cat: "Naija city", meaning: "Capital of Zamfara State." },

  // Slang and everyday words
  { word: "NAIJA", cat: "Slang", meaning: "Nigeria, the way we say it." },
  { word: "WETIN", cat: "Slang", meaning: "Pidgin for \"what\". Wetin dey happen?" },
  { word: "GBESE", cat: "Slang", meaning: "Debt, or trouble you didn't ask for." },
  { word: "OSHEY", cat: "Slang", meaning: "A shout of praise: well done!" },
  { word: "OLODO", cat: "Slang", meaning: "Playful word for someone who didn't read their books." },
  { word: "OJORO", cat: "Slang", meaning: "Cheating or foul play." },
  { word: "AJEBO", cat: "Slang", meaning: "Short for ajebutter: someone raised soft and comfortable." },
  { word: "SOFRI", cat: "Slang", meaning: "Pidgin for gently or slowly. Sofri sofri." },
  { word: "OLOWO", cat: "Slang", meaning: "Yoruba for a rich person." },
  { word: "ALAYE", cat: "Slang", meaning: "Lagos street slang for a guy, a big boy." },
  { word: "SANNU", cat: "Slang", meaning: "Hausa greeting: hello, well done." },
  { word: "OBODO", cat: "Slang", meaning: "Igbo for town or country, as in obodo oyibo (abroad)." },
  { word: "GBEDU", cat: "Slang", meaning: "Music, or a party vibe. This gbedu sweet!" },
  { word: "PADDY", cat: "Slang", meaning: "Pidgin for a close friend." },
  { word: "OMOGE", cat: "Slang", meaning: "Yoruba slang for a beautiful young lady." },
  { word: "AWOOF", cat: "Slang", meaning: "Something free. Awoof dey run belle." },

  // Culture
  { word: "ADIRE", cat: "Culture", meaning: "Yoruba indigo tie-dye cloth, famously made in Abeokuta." },
  { word: "NAIRA", cat: "Culture", meaning: "Nigeria's currency, introduced in 1973." },
  { word: "OLORI", cat: "Culture", meaning: "Yoruba for a queen, the wife of an oba." },
  { word: "BAALE", cat: "Culture", meaning: "Yoruba title for a community or village head." },
  { word: "APALA", cat: "Culture", meaning: "Yoruba music style built on talking drums and percussion." },
  { word: "ZANKU", cat: "Culture", meaning: "Popular Nigerian dance, also called legwork." },
  { word: "SHAKU", cat: "Culture", meaning: "Shaku shaku, the Lagos street dance that blew up in the late 2010s." },
];

// Extra 5-letter Naija words accepted as guesses but never used as answers.
// Every answer above is already accepted as a guess.
export const EXTRA_GUESSES = ["KEKES", "SUYAS"];
