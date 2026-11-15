export type TriviaQuestion = { q: string; options: [string, string, string, string]; answer: number };

export const TRIVIA_BANK: TriviaQuestion[] = [
  { q: "What is the name of Roblox's virtual currency?", options: ["Robux", "Bloxcoin", "Tix Gold", "V-Bucks"], answer: 0 },
  { q: "In what year was Roblox officially released?", options: ["2004", "2006", "2009", "2012"], answer: 1 },
  { q: "Who co-founded Roblox with Erik Cassel?", options: ["Markus Persson", "Tim Sweeney", "David Baszucki", "Gabe Newell"], answer: 2 },
  { q: "Which scripting language do Roblox creators use?", options: ["Python", "JavaScript", "C#", "Luau"], answer: 3 },
  { q: "What is the free app used to build Roblox experiences?", options: ["Roblox Studio", "Blox Maker", "Roblox Forge", "Builder Pro"], answer: 0 },
  { q: "What does Roblox officially call its games?", options: ["Worlds", "Experiences", "Realms", "Servers"], answer: 1 },
  { q: "What was Roblox Premium called before 2019?", options: ["Robux Plus", "Gold Club", "Builders Club", "Blox Pass"], answer: 2 },
  { q: "Which classic sound did players call the Roblox death sound?", options: ["Bonk", "Yikes", "Ouch", "Oof"], answer: 3 },
  { q: "Which Roblox experience is about adopting and raising pets?", options: ["Adopt Me!", "Pet Simulator X", "Bee Swarm", "Petville"], answer: 0 },
  { q: "In which experience do you survive a hotel full of numbered doors?", options: ["Piggy", "DOORS", "The Mimic", "Rainbow Friends"], answer: 1 },
  { q: "Which experience is a cops-and-robbers prison escape game?", options: ["Brookhaven", "Arsenal", "Jailbreak", "Tower of Hell"], answer: 2 },
  { q: "What does UGC stand for in the Avatar Marketplace?", options: ["Ultra Gear Collection", "Unique Game Code", "Universal Gift Card", "User-Generated Content"], answer: 3 },
  { q: "What do creators use to turn earned Robux into real money?", options: ["Developer Exchange", "Robux Bank", "Creator Wallet", "Blox Cashout"], answer: 0 },
  { q: "What share of a Game Pass sale does the creator receive?", options: ["50%", "70%", "80%", "100%"], answer: 1 },
  { q: "What do you buy to unlock perks inside one specific experience?", options: ["A badge", "An emote", "A Game Pass", "A limited"], answer: 2 },
  { q: "What's the term for an item sold for a limited time or quantity?", options: ["Rare", "Epic", "Exotic", "Limited"], answer: 3 },
  { q: "What is Roblox's yearly developer conference called?", options: ["RDC", "BloxCon Live", "RobloxFest", "DevSummit"], answer: 0 },
  { q: "In which California city is Roblox headquartered?", options: ["Los Angeles", "San Mateo", "San Diego", "Sacramento"], answer: 1 },
  { q: "What was Roblox's original working name?", options: ["BlockLand", "Goblox Prime", "DynaBlocks", "BrickWorld"], answer: 2 },
  { q: "Which anime inspired the Roblox hit Blox Fruits?", options: ["Naruto", "Dragon Ball", "Demon Slayer", "One Piece"], answer: 3 },
  { q: "Which experience broke records in 2025 by letting you plant and sell crops?", options: ["Grow a Garden", "Farm Life", "Harvest Town", "Crop Kings"], answer: 0 },
  { q: "What is Roblox's stock ticker on the New York Stock Exchange?", options: ["RBX", "RBLX", "BLOX", "ROBL"], answer: 1 },
  { q: "Brookhaven RP is best known as what kind of experience?", options: ["Obby", "Tycoon", "Town roleplay", "Shooter"], answer: 2 },
  { q: "What do Roblox players call an obstacle course game?", options: ["Runner", "Parkour", "Dash", "Obby"], answer: 3 },
  { q: "Tower of Hell is famous for what?", options: ["A no-checkpoint climbing obby", "Racing cars", "Building houses", "Fishing"], answer: 0 },
  { q: "What do you earn in an experience to show you completed a challenge?", options: ["A token", "A badge", "A trophy pass", "A star"], answer: 1 },
  { q: "Which Roblox currency was retired in 2016?", options: ["Bloxbucks", "Coins", "Tix", "Gems"], answer: 2 },
  { q: "What subscription gives a monthly Robux stipend?", options: ["Roblox Plus", "Roblox VIP", "Roblox Pro", "Roblox Premium"], answer: 3 },
  { q: "In Roblox Studio, which panel lists every object in a place?", options: ["Explorer", "Toolbox", "Output", "Terminal"], answer: 0 },
  { q: "What is the yellow default Roblox avatar figure based on?", options: ["A robot", "A LEGO-like minifigure", "A pixel sprite", "A stick figure"], answer: 1 },
];

const DAY = 86_400_000;

export function triviaDayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Today's 3 questions. They change every 24 hours at 00:00 UTC. */
export function dailyQuestions(now: number, bank: TriviaQuestion[] = TRIVIA_BANK) {
  const day = Math.floor(now / DAY);
  const start = (day * 3) % bank.length;
  return [0, 1, 2].map((i) => bank[(start + i) % bank.length]!);
}

export function nextTriviaReset(now: number) {
  return (Math.floor(now / DAY) + 1) * DAY;
}
