// Pixel Gaffer '96: quick-fire scenarios that pop up during the season.
// Each division has its own set: tea urns in Division Three, takeover bids in the Premier.
// An answer is [text, effects, result] or [text, {chance, win: [effects, result], lose: [effects, result]}].
// Effects: fans, mor (whole squad), board, cash, fit (whole squad), pmor / pform / pinj / pwage / pskill (the player in the story),
// ticket, cap (ground capacity), train (training bonus this week), sign (a new player joins), list (player put on the transfer list).
'use strict';
const SCENARIOS = {
  // ---------- Division Three: proper non-glamour
  3: [
    {id: 'urn', from: 'The Tea Lady', q: "The tea urn's packed in. No hot drinks for the lads at half time on Saturday.", a: [
      ['Buy a shiny new urn (£600)', {cash: -600, mor: 3}, 'A proper brew. The dressing room is a happier place.'],
      ['Flasks from home will do', {mor: -3}, 'Lukewarm tea all round. The lads are grumbling.'],
      ['Ask the fans to bring urns', {chance: .5, win: [{fans: 4, mor: 2}, 'Three urns turn up! The supporters feel part of the club.'], lose: [{fans: -2, mor: -2}, 'Nobody brings one. Cold tea and cold looks.']}]]},
    {id: 'mower', from: 'The Groundsman', q: "The mower's broken. The pitch is starting to look like a hay meadow.", a: [
      ['Hire a mower (£1,500)', {cash: -1500, fans: 1}, 'Stripes you could set your watch by.'],
      ["Borrow a farmer's sheep", {chance: .6, win: [{fans: 6}, "The local paper loves it. 'SHEEPISH' says the back page. Pitch trimmed!"], lose: [{fans: -2, mor: -3}, 'The sheep ate the corner flags and left little presents in the six-yard box.']}],
      ['Leave it. It suits our long ball', {mor: -1, fans: -1}, 'The ball keeps getting stuck. Nobody is amused.']]},
    {id: 'bakery', who: 'p', from: '{p}', q: "Gaffer, can I miss Thursday training? I've been offered an extra shift at the bakery.", a: [
      ['Of course. Bills need paying', {pmor: 12, mor: -2}, '{p} is grateful. A couple of the lads mutter about favourites.'],
      ['Training comes first', {pmor: -12, mor: 1}, '{p} sulks, but turns up.'],
      ['Only if he brings pasties', {pmor: 6, mor: 4}, 'Warm pasties on Friday. Team spirit is sky high.']]},
    {id: 'minibus', from: 'The Kit Man', q: "The minibus has a flat on the way to the away game and the spare's flat too!", a: [
      ['Everyone out and push it to a garage', {fit: -8, mor: 5}, 'Two miles of pushing. Knackered, but it brings the lads together.'],
      ['Book taxis (£800)', {cash: -800}, 'You arrive on time. The taxi driver asks for an autograph.'],
      ['Thumb a lift', {chance: .5, win: [{mor: 4, fans: 3}, 'A passing coach of your own supporters picks you up. What a story!'], lose: [{mor: -5, board: -3}, 'You arrive ten minutes before kick-off, frazzled.']}]]},
    {id: 'school', who: 'young', from: 'Local Primary School', q: 'Could one of your players come in and read to the children on Friday?', a: [
      ['Send young {p}', {pmor: 6, fans: 4}, 'The kids adore him. {p} reads them a story about a goalkeeper dragon.'],
      ['Go yourself, gaffer', {fans: 5, board: 2}, 'You do all the voices. The headteacher is thrilled.'],
      ["Sorry, we're too busy", {fans: -4}, 'The school newsletter is not kind.']]},
    {id: 'stand', from: "Supporters' Club", q: 'We want to name the stand after Doreen, our oldest fan. She has not missed a home game in 52 years.', a: [
      ["Of course! The Doreen Stand it is", {fans: 8, board: -1}, 'Doreen cries. Half the town cries. Lovely stuff.'],
      ['Sell the name to the chippy (£4,000)', {cash: 4000, fans: -6}, "'The Golden Fry Stand'. Doreen is said to be 'disappointed'."],
      ["We'll think about it", {fans: -1}, 'The supporters are left hanging.']]},
    {id: 'shrunk', from: 'The Kit Man', q: "I've washed the home shirts too hot. They've shrunk. The lads look like they're wearing crop tops.", a: [
      ['Order a new set (£1,200)', {cash: -1200}, 'Shiny new shirts arrive just in time.'],
      ['Play in them anyway', {mor: -3, fans: 4}, 'The crowd finds it hilarious. The players less so.'],
      ['Wear the away kit', {}, 'Nobody notices. Crisis averted.']]},
    {id: 'chippy', who: 'p', from: 'Local Gossip', q: '{p} was spotted in the chip shop at midnight before a game.', a: [
      ['Fine him a week\'s wages', {pmor: -10, board: 2, mor: 1}, '{p} pays up. Everyone else is in bed by ten this week.'],
      ['Ask if he got a saveloy', {pmor: 5, mor: 3, board: -2}, 'The dressing room laughs. The chairman does not.'],
      ['Extra laps for him', {pmor: -5, pinj: 0, fit: 0}, '{p} runs it off. Lesson learned.']]},
    {id: 'radio', from: 'Radio Pixel FM', q: 'Will you come on the Saturday morning phone-in?', a: [
      ['Yes, and promise a promotion push', {fans: 5, board: -2, mor: 2}, 'The phones light up. No pressure, then.'],
      ['Yes, but keep it modest', {fans: 2, board: 1}, 'Sensible stuff. Everyone nods along.'],
      ['No thanks', {fans: -2}, 'The presenter calls you "camera shy" on air.']]},
    {id: 'dog', from: 'The Groundsman', q: 'A stray dog keeps running onto the training pitch and pinching the balls.', a: [
      ['Adopt him as the club mascot', {fans: 7, mor: 3, cash: -200}, "Meet 'Nutmeg'. Instant fan favourite."],
      ['Call the dog warden', {fans: -2}, 'The local paper runs a sad photo. Ouch.'],
      ['Use him in training', {chance: .5, win: [{mor: 4, train: .3}, 'Chasing the dog sharpens everyone up!'], lose: [{fit: -6, mor: -1}, 'The dog wins. The lads are exhausted.']}]]},
    {id: 'raffle', from: 'Club Secretary', q: "The half-time raffle prize hasn't turned up. It was meant to be a meat hamper.", a: [
      ['Offer a signed ball instead', {fans: 2}, 'The winner is chuffed.'],
      ['Buy a hamper from the butcher (£150)', {cash: -150, fans: 3}, 'Sausages for the winner. Smiles all round.'],
      ['Quietly forget about it', {fans: -4}, 'Somebody notices. Everybody hears about it.']]},
    {id: 'floodlight', from: 'The Groundsman', q: 'One of the floodlight bulbs has gone. That corner of the pitch is in darkness.', a: [
      ['Fix it properly (£2,500)', {cash: -2500, board: 1}, 'Lights back on.'],
      ['Kick off at 2pm instead', {fans: -3}, 'Fans leave work early to make it. They are not pleased.'],
      ['Our winger knows a bloke', {chance: .6, win: [{cash: -300, mor: 1}, 'Fixed for £300 and a signed shirt.'], lose: [{cash: -300, board: -3}, 'The bulb pops on Saturday. The ref is not happy.']}]]},
  ],
  // ---------- Division Two: local news and bigger budgets
  2: [
    {id: 'docu', from: 'Regional TV', q: 'We want to make a fly-on-the-wall documentary about your season.', a: [
      ['Lights, camera, action', {chance: .55, win: [{fans: 8, cash: 15000}, 'A hit! Ratings are great and the club shop sells out.'], lose: [{mor: -6, cash: 15000}, 'The cameras catch you shouting at the tea lady. The lads cringe.']}],
      ['No cameras in my dressing room', {mor: 2}, 'The players respect the decision.']]},
    {id: 'paint', who: 'top', from: 'The Groundsman', q: "Rival fans broke in and painted our goalposts in their club's colours!", a: [
      ['Laugh it off', {fans: -2, mor: 1}, 'Some fans think you should be angrier.'],
      ['Get {p} to fire up the dressing room', {mor: 5, pmor: 3, fans: 3}, 'The lads are raring to go.'],
      ['Sneak over and paint theirs', {chance: .5, win: [{fans: 9, mor: 3}, 'Legendary. The town talks of nothing else.'], lose: [{board: -8, cash: -5000, fans: 2}, "You're caught on CCTV. The league fines the club."]}]]},
    {id: 'payrise', who: 'top', from: '{p}', q: "Gaffer, I've been our best player. I want a pay rise.", a: [
      ['Give him 20% more', {pwage: .2, pmor: 15}, '{p} is delighted and wants to stay.'],
      ['No. Earn it', {pmor: -15}, '{p} storms off. His agent starts making calls.'],
      ['Only if we finish top half', {pmor: 4}, "{p} reluctantly agrees. He'll hold you to it."]]},
    {id: 'glazing', from: 'Shirt Sponsor', q: 'Our double-glazing firm wants three players in a TV advert. Filming all day Thursday.', a: [
      ['Do it (£12,000)', {cash: 12000, fit: -4, mor: -2}, '"Fit the best, fit Pixel Glaze!" The lads will never live it down.'],
      ['Training comes first', {board: -3}, 'The sponsor is miffed.'],
      ['Send the manager instead', {cash: 6000, fans: 3}, "You're a natural. Half the price, double the laughs."]]},
    {id: 'tickets', from: "Supporters' Trust", q: 'Fans are protesting about ticket prices outside the ground.', a: [
      ['Cut prices by £1', {ticket: -1, fans: 8}, 'The protest turns into a party.'],
      ['Hold firm', {fans: -7, board: 2}, 'The chairman is pleased. The fans are not.'],
      ['Kids get in free', {fans: 7, cash: -8000}, 'Families flood in. The future of the club!']]},
    {id: 'roof', from: 'Club Secretary', q: 'The away-end roof is leaking. Visiting fans are getting soaked.', a: [
      ['Fix it (£20,000)', {cash: -20000, board: 2}, 'Dry fans everywhere.'],
      ['Hand out bin bags', {fans: 2, board: -1}, 'Bin-bag ponchos become a cult fashion.'],
      ["It's their problem", {board: -3}, 'The league writes a stern letter.']]},
    {id: 'striker', who: 'p', from: '{p}', q: "Gaffer, I reckon I'm a striker really. Give me a go up front?", a: [
      ['Extra shooting practice for him', {pskill: 'sho', pmor: 8}, '{p} has been staying late. His finishing has improved!'],
      ['Stick to what you know', {pmor: -6}, '{p} looks crestfallen.'],
      ['Penalty competition. Beat the keeper', {chance: .5, win: [{pmor: 12, pskill: 'sho'}, '{p} scores five out of five! He gets his chance.'], lose: [{pmor: -4, mor: 3}, '{p} misses the lot. The lads are crying with laughter.']}]]},
    {id: 'youth', who: 'young', from: 'Youth Team Coach', q: "Young {p} is ready. I think he should be on the bench on Saturday.", a: [
      ['Put him on the bench', {pmor: 12, pform: 1, fans: 2}, '{p} is buzzing. The academy staff are thrilled.'],
      ['Not yet. Patience', {pmor: -5}, '{p} keeps working hard.'],
      ['Double training for him', {pskill: 'pas', pmor: 4, fit: 0}, '{p} is learning fast.']]},
    {id: 'seaside', from: 'Club Secretary', q: 'A seaside resort has invited us for a friendly and a weekend away.', a: [
      ['Go! Team bonding', {mor: 8, fit: -5, cash: -6000}, 'Donkey rides, ice creams and a 4-0 win. Spirits are high.'],
      ['Training camp instead', {train: .4, mor: -2}, 'Hard work, but the lads are sharper for it.'],
      ['Stay home and rest', {fit: 8}, 'Fresh legs for Saturday.']]},
    {id: 'rumour', from: 'Local Paper', q: "We hear you're being lined up by {rival}. Any comment?", a: [
      ["I'm going nowhere", {board: 5, fans: 4}, 'The chairman shakes your hand. The fans chant your name.'],
      ['Never say never', {board: -6, fans: -3, mor: -2}, 'Panic in the boardroom.'],
      ['No comment', {board: -2}, 'The rumours rumble on.']]},
    {id: 'charity', who: 'p', from: 'Local Hospice', q: 'Will your squad play a charity match against a team of local celebrities?', a: [
      ['Full squad, full effort', {chance: .7, win: [{fans: 8, board: 3}, 'The weather presenter scores a screamer. Thousands raised!'], lose: [{fans: 5, pinj: 2}, '{p} twists an ankle tackling a magician. Out for a bit.']}],
      ['Send the youth team', {fans: 4}, 'A lovely day out.'],
      ["Too risky, sorry", {fans: -5}, 'The hospice is very disappointed.']]},
    {id: 'pies', from: 'Catering Manager', q: 'Fans say our pies are the worst in the league. Some say they are dangerous.', a: [
      ['New pie supplier (£4,000)', {cash: -4000, fans: 6}, 'Steak and ale, proper pastry. A triumph.'],
      ['Gaffer\'s own recipe!', {chance: .4, win: [{fans: 9}, 'The "Gaffer Pie" sells out every week!'], lose: [{fans: -4, mor: -2}, 'The physio is treating more stomachs than hamstrings.']}],
      ['Pies are pies', {fans: -3}, 'The pie complaints continue.']]},
  ],
  // ---------- Division One: national papers and serious money
  1: [
    {id: 'story', from: 'A National Newspaper', q: "We'll pay big money for your story: 'MY LIFE IN THE DUGOUT'.", a: [
      ['Take the money (£60,000)', {cash: 60000, board: -4, mor: -4}, 'Juicy stuff. The players are not happy about what you said about their haircuts.'],
      ['Keep it in the family', {mor: 4, board: 2}, 'Respect from the dressing room.']]},
    {id: 'tapped', who: 'top', from: 'Your Assistant', q: "A Premier club is sniffing around {p}. His head might be turned.", a: [
      ['New contract, now', {pwage: .3, pmor: 15}, '{p} commits his future to the club. It costs, though.'],
      ['Let him talk to them', {list: 1, pmor: 5, mor: -2}, '{p} is now on the transfer list. Bids should follow.'],
      ['Blast them in the press', {fans: 6, pmor: -3, board: -2}, 'The fans love the fight. The league is less keen.']]},
    {id: 'monday', from: 'TV Company', q: 'We want to move your next home game to Monday night for live TV.', a: [
      ['Yes please (£80,000)', {cash: 80000, fans: -5}, 'Fans grumble about taking the day off work.'],
      ['Saturday 3pm is sacred', {fans: 6, board: -2}, 'The traditionalists cheer.']]},
    {id: 'kit', from: 'Kit Manufacturer', q: "Our designers have come up with a 'bold' away kit. Lime green with purple lightning bolts.", a: [
      ['Love it!', {chance: .5, win: [{cash: 70000, fans: 5}, 'An instant cult classic. Sells out in a day.'], lose: [{fans: -5, mor: -3}, 'The players say it makes them feel seasick.']}],
      ['Something classy please', {fans: 2}, 'Clean and simple. Nobody complains.']]},
    {id: 'gossip', who: 'top', from: 'The Gossip Columns', q: "{p} is dating a famous pop star. Photographers are camped outside the training ground.", a: [
      ['Ban cameras from training', {mor: 3, cash: -10000}, 'Security costs, but focus returns.'],
      ['Enjoy the publicity', {fans: 5, pmor: 5, pform: -1}, "Lots of attention. {p}'s mind may be elsewhere."],
      ['Have a quiet word', {pmor: -3, pform: 1}, '{p} gets the message.']]},
    {id: 'statue', from: "Supporters' Trust", q: "Fans want a statue of the club's 1950s legend outside the ground.", a: [
      ['Build it (£90,000)', {cash: -90000, fans: 12}, 'Unveiled to a teary crowd. A great day.'],
      ['Fans can raise half', {fans: 5, cash: -45000}, 'The fundraiser brings the town together.'],
      ["Can't afford it", {fans: -6}, '"Disrespectful" says the fanzine.']]},
    {id: 'video', from: 'Record Label', q: 'A chart-topping band wants to film their music video on your pitch.', a: [
      ['Yes (£50,000)', {cash: 50000, fans: 3, fit: -3}, 'Sequins, smoke machines and a very sore groundsman.'],
      ['Players appear in it too', {cash: 50000, mor: 6, board: -3}, 'The squad dance routine goes down in history.'],
      ['Not on my pitch', {board: 1}, 'The grass is safe.']]},
    {id: 'dinosaur', from: 'The Press Room', q: "{rival}'s manager says your tactics are 'from the Stone Age'.", a: [
      ['Fire back: we\'ll see on the pitch', {mor: 5, fans: 4}, 'The squad is fired up.'],
      ['Turn up dressed as a caveman', {chance: .5, win: [{fans: 10, mor: 4}, 'The press love it. Front page!'], lose: [{board: -6, fans: 2}, 'The chairman is mortified.']}],
      ['Rise above it', {board: 3}, 'Dignified.']]},
    {id: 'expand', from: 'The Chairman', q: 'We could build a new stand: 3,000 more seats. Should we spend the money?', a: [
      ['Build it (£400,000)', {cash: -400000, cap: 3000, fans: 6}, 'The new stand opens. Bigger crowds ahead!'],
      ['Spend it on players instead', {mor: 2}, 'The money stays in the transfer pot.'],
      ['A temporary stand (£120,000)', {cash: -120000, cap: 1000, fans: 2}, 'Scaffolding seats. Rattly but popular.']]},
    {id: 'bonus', from: 'Players\' Captain', q: "The lads want a win bonus for the next three games.", a: [
      ['Agree (£40,000 a win)', {cash: -40000, mor: 10}, 'The dressing room is buzzing.'],
      ['They\'re paid enough', {mor: -8, board: 3}, 'Muttering in the showers.'],
      ['Bonus for a clean sheet only', {mor: 3}, 'The defenders are suddenly very keen.']]},
    {id: 'marathon', who: 'old', from: '{p}', q: "Gaffer, I want to run the city marathon for charity next weekend.", a: [
      ['Go for it', {chance: .6, win: [{fans: 7, pmor: 10}, '{p} finishes in 3 hours dressed as a banana. A hero.'], lose: [{fans: 4, pinj: 3}, '{p} raises a fortune but pulls a hamstring at mile 20.']}],
      ['No. Save your legs', {pmor: -6}, '{p} is disappointed.']]},
    {id: 'agent', from: 'A Football Agent', q: "My client is a free agent and a proper player. He wants big wages, mind.", a: [
      ['Sign him', {sign: 1}, 'He signs on the dotted line!'],
      ['Not interested', {}, 'The agent goes elsewhere.']]},
  ],
  // ---------- Premier Division: global glamour
  0: [
    {id: 'takeover', from: 'The Chairman', q: 'A mysterious billionaire wants to buy the club. Your opinion matters.', a: [
      ['Back the takeover', {chance: .6, win: [{cash: 3000000, fans: 6, board: 5}, 'Champagne! Millions arrive for transfers.'], lose: [{board: -15, fans: -8}, 'The billionaire turns out to be a bit dodgy. The deal collapses in shame.']}],
      ['Oppose it. Keep the club local', {fans: 10, board: -5}, 'The fans love you. Some of the board do not.'],
      ['Stay neutral', {}, 'You keep your head down.']]},
    {id: 'single', who: 'top', from: '{p}', q: "Gaffer, I'm releasing a pop single. Can the lads sing backing vocals?", a: [
      ['Into the studio, everyone', {chance: .5, win: [{mor: 6, fans: 8, cash: 200000}, "It's number 4 in the charts!"], lose: [{mor: -4, fans: -3}, 'It is truly awful. The terraces sing it ironically.']}],
      ["Focus on football, son", {pmor: -8}, '{p} sulks in his mansion.'],
      ['Only him. Leave the lads out', {pmor: 6, pform: -1}, "{p} is on every chat show. Is he still training?"]]},
    {id: 'tour', from: 'Commercial Director', q: 'A pre-season-style tour of Asia, mid-season. Huge money, long flights.', a: [
      ['Go (£1,500,000)', {cash: 1500000, fit: -15, mor: -3}, 'Big crowds, jet lag and very tired legs.'],
      ['The league comes first', {board: -6, mor: 3}, 'The commercial department is furious.']]},
    {id: 'magazine', who: 'top', from: 'Glossy Magazine', q: '{p} wants to do a front-cover photo shoot in his pants.', a: [
      ['Let him', {pmor: 8, fans: 4, cash: 50000}, 'The cover sells out. The lads cut it up and stick it all over the dressing room.'],
      ['Absolutely not', {pmor: -10, board: 2}, '{p} calls you a dinosaur.'],
      ['Only if the whole squad does it', {chance: .5, win: [{mor: 8, fans: 6, cash: 100000}, 'The squad calendar is a bestseller!'], lose: [{mor: -6}, 'The goalkeeper refuses. Awkward.']}]]},
    {id: 'film', from: 'Hollywood Studio', q: 'We want your players as extras in a football film. Two days of shooting.', a: [
      ['Lights, camera, football! (£400,000)', {cash: 400000, fit: -5, mor: 5}, 'The lads mingle with film stars. Morale is sky high.'],
      ['We have a title to chase', {board: 2}, 'The studio finds another club.']]},
    {id: 'superstar', from: 'Super-Agent', q: 'A world-famous striker wants to play for you. He wants silly money and his own parking space.', a: [
      ['Sign him', {sign: 2}, 'The superstar arrives by helicopter!'],
      ['Our wage structure stays', {board: 4, mor: 2}, 'The board approves your discipline.']]},
    {id: 'airline', from: 'Commercial Director', q: 'An airline will pay a fortune to rename the stadium after itself.', a: [
      ['Take the money (£2,000,000)', {cash: 2000000, fans: -12}, '"The SkyPixel Arena". The fans hate it.'],
      ['The ground keeps its name', {fans: 10, board: -6}, 'Historic name saved. Banners thank you.']]},
    {id: 'freeze', from: "Supporters' Trust", q: 'Fans want a ticket price freeze for the next three seasons.', a: [
      ['Agree', {fans: 10, board: -5}, 'The fans hold up a giant THANK YOU banner.'],
      ['Prices go up £3', {ticket: 3, fans: -10, cash: 200000}, 'Boos at the next home game.'],
      ['Freeze for one season', {fans: 4}, 'A fair compromise.']]},
    {id: 'sportscar', who: 'p', from: 'Club Doctor', q: '{p} has crashed his new sports car. He is fine, but the press is everywhere.', a: [
      ['Public telling-off', {pmor: -8, board: 3, mor: 2}, 'Message received by the whole squad.'],
      ['Protect him from the press', {pmor: 10, fans: -3}, '{p} is grateful and loyal.'],
      ['Make him take the bus for a month', {pmor: -3, fans: 6}, 'Photos of {p} on the number 42 bus go everywhere.']]},
    {id: 'dugout', from: 'Club Secretary', q: 'A famous film star wants to sit in your dugout for the next game.', a: [
      ['Welcome aboard', {chance: .5, win: [{fans: 8, mor: 4}, 'The star leads the singing. The players love it.'], lose: [{mor: -5, board: -3}, 'The star keeps shouting tactics. Chaos.']}],
      ['VIP box only', {fans: 3}, 'Waves to the crowd. Lovely.']]},
    {id: 'tapping', from: 'The League', q: "{rival} accuse you of tapping up one of their players. There's an inquiry.", a: [
      ['Deny everything', {chance: .6, win: [{board: 3}, 'Cleared! Not a shred of evidence.'], lose: [{cash: -500000, board: -10}, 'A fax turns up. Heavy fine.']}],
      ['Settle quietly (£250,000)', {cash: -250000, board: -2}, 'It goes away.'],
      ['Counter-accuse them', {fans: 6, board: -4}, 'A proper war of words.']]},
    {id: 'bonuscup', from: "Players' Captain", q: 'The squad wants a massive bonus if we win a trophy this season.', a: [
      ['£1 million pot', {mor: 12, board: -3}, 'The lads are fired up. The finance director faints.'],
      ['Glory is its own reward', {mor: -8}, 'Not the answer they wanted.'],
      ['Holiday in the sun for everyone', {mor: 6, cash: -150000}, 'Sun cream at the ready.']]},
  ],
};

// ---------- the second set: they turn up once you've seen the first set for your division
const SCENARIOS2 = {
  3: [
    {id: 'pothole', from: 'Club Secretary', q: "There's a pothole in the car park. The sponsor's car has just disappeared into it up to the axle.", a: [
      ['Fill it in properly (£900)', {cash: -900, board: 2}, 'Smooth tarmac. The sponsor is mollified.'],
      ['Get the squad to tow him out', {mor: 3, fit: -3, fans: 2}, 'Ten players, one rope, one very muddy car. Great photo.'],
      ['Put a cone in it', {board: -3}, 'Somebody drives over the cone. Then into the pothole.']]},
    {id: 'badger', from: 'Commercial Manager', q: "Moths have eaten Billy the Badger, our mascot costume. He's got a hole where his face should be.", a: [
      ['New costume (£1,500)', {cash: -1500, fans: 4}, 'Billy is back and fluffier than ever.'],
      ['Let the fans design a new mascot', {chance: .6, win: [{fans: 7}, 'Say hello to Captain Crumpet, a giant teacake. The kids adore him.'], lose: [{fans: -2}, "The winning design is a confusing purple blob. Nobody knows what it is."]}],
      ['Patch it up with a tea towel', {fans: -2, mor: 1}, 'Billy now looks slightly terrifying.']]},
    {id: 'typo', from: 'The Printers', q: "The match programme's gone out with our club name spelt wrong on the front. 2,000 copies.", a: [
      ['Reprint them (£700)', {cash: -700}, 'Spelt right this time. Probably.'],
      ['Sell them as collectors\' items', {chance: .5, win: [{cash: 1500, fans: 3}, 'They sell out! People love a misprint.'], lose: [{fans: -3}, 'Nobody buys them. The local paper has a laugh at your expense.']}],
      ['Hand them out anyway', {fans: -1}, 'A few people notice. Most are reading the pie menu.']]},
    {id: 'pigeon', from: 'The Groundsman', q: 'A pigeon has built a nest in the back of the home goal. There are eggs in it.', a: [
      ['Move the nest carefully', {fans: 2, board: 1}, 'The RSPB sends a thank-you card.'],
      ['Leave it. Lucky pigeon!', {chance: .5, win: [{mor: 4, fans: 4}, 'We keep a clean sheet. The pigeon is our new talisman.'], lose: [{mor: -2}, 'Our keeper spends the whole game worrying about the eggs.']}],
      ['Play at the other end', {}, 'Easiest solution. Nobody minds.']]},
    {id: 'showers', from: 'The Kit Man', q: "The showers only run cold. The lads are threatening to go home muddy.", a: [
      ['Get a plumber in (£1,100)', {cash: -1100, mor: 3}, 'Piping hot showers. Happy players.'],
      ['Cold showers are good for you!', {mor: -4, fit: 3}, 'Bracing. The lads are not convinced.'],
      ['Ask the swimming baths if we can use theirs', {mor: 2, fans: 2}, 'The pensioners at aqua-aerobics get a surprise.']]},
    {id: 'bigboots', who: 'young', from: 'The Kit Man', q: 'Young {p} has turned up in borrowed boots two sizes too big. He keeps falling over.', a: [
      ['Buy him a proper pair (£80)', {cash: -80, pmor: 10}, '{p} nearly cries. Tidy.'],
      ['Stuff the toes with newspaper', {pmor: 2, mor: 2}, 'Old-school fix. Works a treat.'],
      ['Clown shoes build character', {pmor: -8}, '{p} trips over the ball in training. Again.']]},
    {id: 'quiz', from: "Supporters' Club", q: 'The supporters have challenged the players to a quiz night at the clubhouse.', a: [
      ['Accept! Players v fans', {chance: .5, win: [{mor: 5, fans: 4}, 'The players win on the tie-break: "Who won the 1966 World Cup?"'], lose: [{fans: 6, mor: -1}, 'The fans win easily. The lads are mocked for weeks. Everyone loves it.']}],
      ['Send the coaching staff', {fans: 3}, 'Your assistant is a quiz machine.'],
      ["No time for quizzes", {fans: -3}, 'The supporters feel snubbed.']]},
    {id: 'veg', from: 'The Groundsman', q: 'Can I grow some vegetables in the spare patch behind the away goal?', a: [
      ['Course you can', {fans: 2, mor: 1}, 'Prize-winning marrows by Easter.'],
      ['Only if the players get some', {mor: 3, fit: 2}, 'Fresh veg in the canteen. Very healthy.'],
      ['No. That patch is for warming up', {}, 'The groundsman sighs.']]},
    {id: 'nickname', from: 'Local Paper', q: "We're running a poll to give the team a new nickname. Want to suggest one?", a: [
      ['"The Mighty Ones"', {mor: 3, fans: 1}, 'Ambitious. The lads like it.'],
      ['Let the readers choose', {chance: .6, win: [{fans: 5}, 'The readers pick "The Gaffer\'s Grafters". Brilliant.'], lose: [{fans: 2, mor: -2}, 'The readers pick "The Soggy Biscuits". It sticks.']}],
      ["We don't need a nickname", {fans: -1}, 'The poll goes ahead anyway.']]},
    {id: 'snow', from: 'The Groundsman', q: "It's snowed overnight. The game's off unless we clear the pitch.", a: [
      ['Ask fans to bring shovels', {fans: 6, fit: -2, mor: 2}, 'A hundred fans turn up with shovels and flasks. The game goes ahead!'],
      ['Players clear it', {fit: -6, mor: 4}, 'Hard graft. Real team spirit.'],
      ['Call it off', {board: -2, cash: -1000}, 'Lost gate money. The chairman sighs.']]},
    {id: 'shorts', from: 'Garden Centre', q: "A local garden centre will sponsor us, but they want their logo on the back of the shorts.", a: [
      ['Deal (£5,000)', {cash: 5000, mor: -2, fans: -1}, '"BLOOMING MARVELLOUS" across every backside.'],
      ['On the training kit only (£2,000)', {cash: 2000}, 'A sensible compromise.'],
      ['Our shorts are sacred', {}, 'They sponsor the cricket club instead.']]},
    {id: 'cake', who: 'old', from: 'The Tea Lady', q: "It's {p}'s 35th birthday tomorrow. Shall I make a cake?", a: [
      ['A big one, with candles', {pmor: 10, mor: 3}, 'Happy birthday {p}! The cake is shaped like a football.'],
      ['A small one. We have a game', {pmor: 4}, 'Very nice. Very sensible.'],
      ['No cakes before a match', {pmor: -6, mor: -1}, '{p} feels his age.']]},
  ],
  2: [
    {id: 'police', from: 'Local Police', q: 'We want the derby moved to an 11am kick-off to keep the peace.', a: [
      ['Agree', {board: 3, fans: -4}, "Bacon rolls at the turnstiles. The fans are half asleep."],
      ['Fight to keep 3pm', {chance: .5, win: [{fans: 6}, 'The police back down. Proper atmosphere!'], lose: [{fans: -2, board: -4}, 'The police win, and the club is fined for the fuss.']}],
      ['Make it a family day', {fans: 4, cash: -3000}, 'Face painters and a bouncy castle. Lovely.']]},
    {id: 'lottery', from: 'A Lucky Fan', q: "I've won the lottery! I'd like to pay the wages of a new player for you. No strings!", a: [
      ['Yes please!', {sign: 1}, 'A new player arrives, courtesy of a very happy fan.'],
      ['Put it into the youth team', {youth: 1, fans: 5}, 'A new academy coach finds a gem.'],
      ['Keep your money, mate', {fans: 3}, 'The fan buys a season ticket for life instead.']]},
    {id: 'academy', who: 'young', from: 'Your Assistant', q: "A big club's scout keeps watching young {p}. They might make an offer.", a: [
      ['Lock him in with a new deal', {pwage: .5, pmor: 12}, '{p} signs a long contract. Delighted.'],
      ['Sell if the money is right', {sell: 1.6}, '{p} is sold. Good money for a kid.'],
      ['Ignore it', {pmor: -4}, "{p}'s head is a bit turned."]]},
    {id: 'pundit', from: 'Regional TV', q: 'Want to be a pundit on our Saturday night football show?', a: [
      ['Yes, and wear a loud jacket', {fans: 5, cash: 3000, board: -1}, 'Your jacket gets its own fan club.'],
      ['Yes, but keep it serious', {cash: 3000, board: 2}, 'Wise words. People are impressed.'],
      ['No. Saturday nights are for videos', {mor: 1}, 'You watch the opposition on tape instead.']]},
    {id: 'cartoon', from: 'The Fanzine', q: "The fanzine has printed a cartoon of you as a confused penguin.", a: [
      ['Frame it in your office', {fans: 6}, 'The fans love that you can laugh at yourself.'],
      ['Ban the fanzine from the ground', {fans: -8, board: 2}, 'Sales of the fanzine double.'],
      ['Write a reply for the next issue', {chance: .5, win: [{fans: 7}, 'Your piece is hilarious. Respect earned.'], lose: [{fans: -3}, 'It is very, very long and not funny.']}]]},
    {id: 'physio', from: 'The Physio', q: "There's a fancy new treatment machine. It could get injured lads back quicker.", a: [
      ['Buy it (£25,000)', {cash: -25000, heal: 2, fit: 4}, 'Space-age kit! The treatment room is emptying.'],
      ['Ice packs have always worked', {}, 'Frozen peas it is.'],
      ['Hire one for a month (£6,000)', {cash: -6000, heal: 1}, 'A short-term boost.']]},
    {id: 'swap', who: 'p', from: 'Angry Supporter', q: "{p} swapped shirts with a rival player and kissed their badge on camera!", a: [
      ['Make him apologise', {pmor: -6, fans: 5}, 'A grovelling apology. The fans forgive him. Mostly.'],
      ['Defend him. Just a shirt swap', {pmor: 6, fans: -6}, '{p} is grateful. The terraces are not.'],
      ['Fine him and donate it to charity', {pmor: -3, fans: 4, board: 2}, 'Everyone is happy-ish.']]},
    {id: 'mascotrace', from: 'The League', q: 'Our mascot has been invited to the famous Mascot Derby, a race at a big cup final.', a: [
      ['Train him hard', {chance: .4, win: [{fans: 9, cash: 5000}, 'Billy the Badger WINS by a whisker! National headlines!'], lose: [{fans: 3}, 'Billy trips over his own tail. Still, great publicity.']}],
      ['Just enjoy the day out', {fans: 3}, 'He finishes fifth and waves to everyone.'],
      ['Not interested', {}, 'Fair enough.']]},
    {id: 'motorway', from: 'Coach Driver', q: "We're stuck on the motorway. We'll be at least 40 minutes late for kick-off.", a: [
      ['Warm up in the services car park', {fit: -3, fans: 3}, 'The lads do stretches next to the petrol pumps. Fans love the photos.'],
      ['Ask the league to delay kick-off', {board: -2}, 'Granted, but they are not pleased.'],
      ['Get changed on the coach', {mor: 2}, 'Ready to go the second the doors open.']]},
    {id: 'hairdye', who: 'p', from: 'Club Photographer', q: "{p} has dyed his hair in the club colours. It's quite something.", a: [
      ['Love it. Club spirit!', {pmor: 8, fans: 5}, 'Half the kids in town copy him.'],
      ['Get it sorted before Saturday', {pmor: -6}, '{p} spends Friday at the barber.'],
      ['Everyone does it for the next home game!', {chance: .5, win: [{mor: 8, fans: 8}, 'An unforgettable day. The ground is a sea of colour.'], lose: [{mor: -4, fans: 3}, 'The dye runs in the rain. Pink sweat everywhere.']}]]},
    {id: 'trialist', from: 'Your Assistant', q: "A lad turned up from abroad asking for a trial. Says he's a 'very good'. Speaks no English.", a: [
      ['Give him a game in training', {chance: .4, win: [{sign: 1}, "He's brilliant! You sign him on the spot."], lose: [{mor: 2}, "He's a decent bloke but can't trap a bag of cement. Lovely lad though."]}],
      ['Politely say no', {}, 'He heads off to try the next club.']]},
    {id: 'ballboy', from: 'The League', q: 'Our ball boys have been reported for slowing the game down when we are winning.', a: [
      ['Tell them to cut it out', {board: 2}, 'The ball boys sulk.'],
      ['Deny everything', {chance: .5, win: [{fans: 3}, 'Nothing can be proved. The ball boys are heroes.'], lose: [{cash: -5000, board: -3}, 'Caught on camera. A fine.']}],
      ['Give them a medal', {fans: 5, board: -3}, 'Cult heroes. The league is not amused.']]},
  ],
  1: [
    {id: 'gameshow', who: 'top', from: '{p}', q: "Gaffer, I've been invited on a big Saturday night game show. It's filmed the day before a game.", a: [
      ['Go for it', {chance: .5, win: [{pmor: 10, fans: 7, cash: 10000}, '{p} wins a speedboat! The nation loves him.'], lose: [{pmor: -4, pform: -1, fans: 3}, '{p} is knocked out in round one and gets home at 2am.']}],
      ['Not the day before a game', {pmor: -6}, '{p} sulks but rests.'],
      ['Only after the season', {pmor: 2}, 'Fair enough, says {p}.']]},
    {id: 'europe', from: 'Foreign Club', q: 'A famous European club has invited us to a mid-season friendly abroad. Great money.', a: [
      ['Go (£120,000)', {cash: 120000, fit: -8, mor: 4}, 'A taste of the big time. Tired legs, though.'],
      ['Send the reserves (£50,000)', {cash: 50000, fans: 2}, 'The kids lose 7-0 but have the time of their lives.'],
      ["Not in the middle of a promotion push", {board: 2}, 'Focus is everything.']]},
    {id: 'leak', from: 'Your Assistant', q: "Someone in the boardroom is leaking our team news to the papers.", a: [
      ['Feed them fake news', {chance: .6, win: [{mor: 4, fans: 3}, 'The papers print a team full of retired players. The leak is found!'], lose: [{board: -6}, 'Wrong director accused. Awkward.']}],
      ['Confront the board', {board: -4, mor: 3}, 'Tense meeting. The leaking stops.'],
      ["Let it go", {mor: -3}, 'The leaks continue.']]},
    {id: 'forum', from: "Supporters' Trust", q: "Fans want an open forum to grill you about results. It'll be packed and probably angry.", a: [
      ['Face the music', {chance: .6, win: [{fans: 9, board: 3}, 'You win them round. Standing ovation!'], lose: [{fans: -4, board: -2}, 'Someone throws a sausage roll. It goes badly.']}],
      ['Send the chairman', {fans: -2, board: -3}, 'The chairman is not happy to be your human shield.'],
      ['Write an open letter instead', {fans: 2}, 'Polite and measured.']]},
    {id: 'diet', from: 'Club Nutritionist', q: 'I want to ban chips, cake and fizzy pop from the canteen.', a: [
      ['Ban the lot', {mor: -6, fit: 8, train: .3}, 'Grumpy, but fitter than ever.'],
      ['Chips on Fridays only', {mor: 2, fit: 3}, 'Chip Friday becomes a sacred ritual.'],
      ["Leave the lads' grub alone", {mor: 4, fit: -3}, 'Happy players. Slightly heavier players.']]},
    {id: 'helicopter', from: 'The Chairman', q: "I'd like to land my helicopter on the pitch before Saturday's game. Make an entrance!", a: [
      ['Fine by me', {fans: 4, mor: -2, board: 4}, 'Spectacular. The groundsman weeps over the divots.'],
      ['Not on my pitch', {board: -5, mor: 2}, 'The chairman walks in like everyone else. Grumpily.'],
      ['Land in the car park', {board: 2}, 'Compromise. Still quite impressive.']]},
    {id: 'retire', who: 'old', from: '{p}', q: "Gaffer, I'm thinking of retiring at the end of the season. My knees are shot.", a: [
      ['Persuade him to give it one more year', {pmor: 8, pwage: .1}, '{p} agrees to one last season. Legend.'],
      ['Offer him a coaching job for later', {pmor: 12, mor: 3, train: .2}, '{p} is touched. He starts mentoring the youngsters.'],
      ['Wish him well', {pmor: -2}, 'Fair enough. The end of an era beckons.']]},
    {id: 'bigbid', who: 'top', from: 'The Chairman', q: "A Premier club has bid double what {p} is worth. I want to sell. Do you?", a: [
      ['Sell him (double value)', {sell: 2}, '{p} leaves for a fortune. Time to rebuild.'],
      ['He stays', {board: -6, pmor: 6, fans: 5}, 'The fans love it. The chairman sulks.'],
      ["Ask {p} what he wants", {chance: .5, win: [{pmor: 12, board: -2}, "{p} wants to stay. 'This is my club.'"], lose: [{sell: 2}, '{p} wants the move. Off he goes.']}]]},
    {id: 'tunnelcam', from: 'TV Company', q: 'We want cameras in the tunnel and dressing room at half time for a new show.', a: [
      ['Fine (£40,000)', {cash: 40000, mor: -4}, 'You have to keep the hairdryer treatment family friendly.'],
      ['Tunnel only (£15,000)', {cash: 15000}, 'A tidy compromise.'],
      ['No chance', {mor: 3}, 'What happens in the dressing room stays there.']]},
    {id: 'shares', from: 'A Fan Who Won the Pools', q: 'I want to buy shares in the club and get a seat on the board.', a: [
      ['Welcome aboard (£250,000)', {cash: 250000, board: -3, fans: 5}, 'A fan on the board! The supporters approve.'],
      ['Shares, but no board seat (£100,000)', {cash: 100000}, 'A tidy sum.'],
      ['No thanks', {}, 'Things stay as they are.']]},
    {id: 'fruit', from: 'Delivery Man', q: "{rival}'s manager has sent you a fruit basket with a note: 'Enjoy it while you can'.", a: [
      ['Pin the note on the dressing room wall', {mor: 7}, 'The lads are seething. Good.'],
      ['Send back a bigger basket', {fans: 4, cash: -500}, 'The basket war is in all the papers.'],
      ['Eat the fruit', {fit: 1}, 'Delicious grapes, to be fair.']]},
    {id: 'academy2', from: 'The Chairman', q: 'We could finally build a proper youth academy. It will cost, but it is the future.', a: [
      ['Build it (£300,000)', {cash: -300000, youth: 2, board: 4}, 'The academy opens. Two promising kids join straight away.'],
      ['A smaller version (£100,000)', {cash: -100000, youth: 1}, 'A start.'],
      ['Buy ready-made players instead', {}, 'The money stays in the transfer pot.']]},
  ],
  0: [
    {id: 'videogame', who: 'top', from: 'Games Company', q: 'We want {p} on the cover of our new football computer game.', a: [
      ['Yes! (£300,000)', {cash: 300000, pmor: 10, fans: 5}, 'The game flies off the shelves. Every kid in the country plays as {p}.'],
      ['Only with the whole team on it', {cash: 200000, mor: 6}, 'A cracking cover.'],
      ['The cover curse is real. No', {pmor: -5}, 'Better safe than sorry.']]},
    {id: 'spy', from: 'Security', q: "{rival} have been spying on our training from a crane on the building site next door.", a: [
      ['Train behind closed doors at a secret ground', {cash: -50000, mor: 4}, 'Top-secret tactics. Mysterious.'],
      ['Practise a fake formation for them to see', {chance: .6, win: [{mor: 6, fans: 5}, 'They prepare for the wrong team. Ha!'], lose: [{mor: -3}, 'Your players get confused by the fake formation too.']}],
      ['Complain to the league', {board: 2}, 'They get a slap on the wrist.']]},
    {id: 'concert', from: 'Concert Promoter', q: 'The biggest band in the world wants to play our stadium this month. It will wreck the pitch.', a: [
      ['Let them (£1,200,000)', {cash: 1200000, fit: -6, fans: 4}, 'Amazing gig. The pitch looks like a ploughed field.'],
      ['Only after the season', {}, 'The band goes to a rival stadium.'],
      ['Players get backstage passes too', {cash: 1200000, mor: 8, fit: -8}, 'Best night of their lives. Worst pitch of their lives.']]},
    {id: 'satdoc', from: 'Satellite TV', q: "A satellite channel wants a weekly behind-the-scenes series about the club.", a: [
      ['Yes (£800,000)', {chance: .6, win: [{cash: 800000, fans: 8}, "The show's a hit around the world!"], lose: [{cash: 800000, mor: -8, board: -4}, 'They film a training ground punch-up. Disaster.']}],
      ['No cameras', {mor: 3}, 'The squad appreciates the privacy.']]},
    {id: 'goldboots', who: 'top', from: '{p}', q: "My boot sponsor wants me to wear solid gold boots. They're very shiny.", a: [
      ['Let him wear them', {chance: .5, win: [{pmor: 8, pform: 1, fans: 4}, '{p} scores a screamer in them. The Golden Boy!'], lose: [{pmor: 2, pform: -1, fans: -3}, '{p} skies three sitters. The fans are merciless.']}],
      ['Black boots only at this club', {pmor: -6, board: 2}, 'Traditional. {p} grumbles.']]},
    {id: 'float', from: 'The Chairman', q: "We're thinking of floating the club on the stock market. What do you think?", a: [
      ['Do it', {chance: .55, win: [{cash: 4000000, board: 6}, 'Shares soar! A war chest for transfers.'], lose: [{cash: 500000, board: -8, fans: -5}, 'The shares flop. Everyone looks a bit silly.']}],
      ["It's a football club, not a business", {fans: 8, board: -6}, 'The fans are with you. The suits are not.']]},
    {id: 'national', who: 'top', from: 'The National Team Manager', q: 'I want {p} for a midweek friendly in South America. Long flight, mind.', a: [
      ['Let him go. What an honour', {chance: .7, win: [{pmor: 12, fans: 4}, '{p} scores on his debut! The town is so proud.'], lose: [{pmor: 6, pinj: 3}, '{p} comes back with a knock. Gutted.']}],
      ['Tell them he is injured', {pmor: -12, board: -3}, '{p} finds out. He is furious.']]},
    {id: 'megabid', who: 'top', from: 'The Chairman', q: "A European giant has made a world-record bid for {p}. Three times what he's worth!", a: [
      ['Sell him (3x value)', {sell: 3}, '{p} is gone. A world-record fee to rebuild with.'],
      ['Not for sale. At any price', {fans: 10, board: -8, pmor: 4}, 'Banners everywhere: "WE LOVE YOU GAFFER".'],
      ["Let {p} decide", {chance: .5, win: [{pmor: 15, fans: 6}, '{p} turns them down. "My heart is here."'], lose: [{sell: 3}, '{p} takes the move. Fair play.']}]]},
    {id: 'pundit2', from: 'The Press Room', q: "A famous TV pundit called your team 'a load of overpaid show ponies'.", a: [
      ['Invite him to watch training', {chance: .5, win: [{fans: 6, mor: 4}, 'He is converted! Says so on live TV.'], lose: [{mor: -3}, '"Exactly as I thought," he says.']}],
      ['Pin his quote on the wall', {mor: 8}, 'The lads have a point to prove.'],
      ['Ignore him', {}, 'Nobody remembers it by Tuesday.']]},
    {id: 'fashion', from: 'Kit Manufacturer', q: 'We want to launch the new kit at a fashion show. Players on the catwalk!', a: [
      ['Strut your stuff (£250,000)', {cash: 250000, mor: 3, fans: 3}, 'The centre-back trips over his own feet. Still, a triumph.'],
      ['Models only, please', {cash: 150000}, 'Very glamorous. Not much to do with football.'],
      ['Launch it at the ground for the fans', {fans: 8}, 'Thousands turn up. Proper football.']]},
    {id: 'award', who: 'top', from: 'Football Writers', q: '{p} is shortlisted for Player of the Year. Shall we run a campaign?', a: [
      ['Full campaign!', {chance: .5, win: [{pmor: 15, fans: 6}, '{p} WINS! The trophy goes in the club museum.'], lose: [{pmor: -4}, '{p} finishes second. Robbed!']}],
      ['Let his football do the talking', {pmor: 4}, 'Classy.']]},
    {id: 'charitysingle', from: 'Record Label', q: 'Will the squad record a charity Christmas single?', a: [
      ['Into the studio', {chance: .5, win: [{fans: 9, mor: 6}, 'Christmas number one! A great cause and a great laugh.'], lose: [{fans: 4, mor: -2}, "It's dreadful, but it raises a fortune for charity."]}],
      ['Donate instead (£100,000)', {cash: -100000, fans: 4, board: 2}, 'Generous and tuneful.'],
      ['Footballers should not sing', {fans: -2}, 'Fair enough, honestly.']]},
  ],
};

// Pick a scenario for this week, or null.
function pickScenario() {
  const c = me(), first = SCENARIOS[c.div] || SCENARIOS[3], second = SCENARIOS2[c.div] || [];
  W.scenSeen = W.scenSeen || [];
  // the first set, then the second set, then start again
  let pool = first.filter(s => !W.scenSeen.includes(s.id));
  if (!pool.length) pool = second.filter(s => !W.scenSeen.includes(s.id));
  if (!pool.length) { W.scenSeen = W.scenSeen.filter(id => !first.concat(second).some(s => s.id === id)); pool = first.slice(); }
  const s = pick(pool);
  const squad = c.squad.map(P).filter(p => p && !p.inj);
  const by = {
    p: pick(squad.filter(p => p.pos !== 'GK')) || squad[0],
    top: squad.slice().sort((a, b) => ovrOf(b) - ovrOf(a))[0],
    young: squad.slice().sort((a, b) => a.age - b.age)[0],
    old: squad.slice().sort((a, b) => b.age - a.age)[0],
  };
  const rival = pick(W.clubs.filter(x => x.div === c.div && x.id !== c.id));
  return {s, pid: s.who ? (by[s.who] || by.p).id : null, rival: rival.id};
}
function scenText(t, sc) { return t.replace(/\{p\}/g, sc.pid != null && P(sc.pid) ? pname(P(sc.pid)) : 'one of the lads').replace(/\{rival\}/g, C(sc.rival).name); }
function applyScenario(eff, sc) {
  const c = me(), p = sc.pid != null ? P(sc.pid) : null, out = [];
  const sq = c.squad.map(P).filter(Boolean);
  if (eff.fans) { W.fans = clamp((W.fans ?? 60) + eff.fans, 0, 100); out.push(['Fans', eff.fans]); }
  if (eff.mor) { sq.forEach(x => x.mor = clamp(x.mor + eff.mor, 5, 100)); out.push(['Squad', eff.mor]); }
  if (eff.board) { W.board.conf = clamp(W.board.conf + eff.board, 0, 100); out.push(['Board', eff.board]); }
  if (eff.cash) { c.cash += eff.cash; out.push(['£', eff.cash]); }
  if (eff.fit) { sq.forEach(x => x.fit = clamp(x.fit + eff.fit, 30, 100)); out.push(['Fitness', eff.fit]); }
  if (eff.train) { W.drill = Math.min(1.5, (W.drill || 0) + eff.train); out.push(['Training', true]); }
  if (eff.ticket) { const base = BASE_TICKET[c.div]; c.ticket = clamp(c.ticket + eff.ticket, Math.ceil(base * .5), base * 2); out.push(['Tickets £' + c.ticket, eff.ticket < 0]); }
  if (eff.cap) { c.cap += eff.cap; out.push(['Ground +' + eff.cap.toLocaleString(), true]); }
  if (p) {
    if (eff.pmor) { p.mor = clamp(p.mor + eff.pmor, 5, 100); out.push([p.ln, eff.pmor]); }
    if (eff.pform) { p.form = clamp(p.form + eff.pform, -3, 3); out.push([p.ln + ' form', eff.pform]); }
    if (eff.pinj) { p.inj = Math.max(p.inj, eff.pinj); out.push([`${p.ln} injured ${eff.pinj}w`, false]); }
    if (eff.pwage) { const old = p.wage; p.wage = Math.round(p.wage * (1 + eff.pwage) / 10) * 10; p.con = Math.max(p.con, 3); out.push([`${p.ln} wage ${money(old)}→${money(p.wage)}`, false]); }
    if (eff.pskill) { p.a[eff.pskill] = clamp(p.a[eff.pskill] + 1, 1, 20); out.push([`${p.ln} ${({sho: 'shooting', pas: 'passing', tkl: 'tackling', pac: 'pace'})[eff.pskill]} +1`, true]); }
    if (eff.list && p.loanFrom == null) { p.listed = true; out.push([`${p.ln} listed`, false]); }
  }
  if (eff.heal) {
    let n = 0; sq.forEach(x => { if (x.inj) { x.inj = Math.max(0, x.inj - eff.heal); n++; } });
    out.push([n ? `${n} injured player${n > 1 ? 's' : ''} back sooner` : 'Physio ready for the next knock', true]);
  }
  if (eff.youth) {
    NEXT_ID = W.nextId;
    for (let i = 0; i < eff.youth && c.squad.length < 26; i++) {
      const kid = makePlayer(pick(['DF', 'MF', 'FW', 'MF']), [10, 8.5, 7, 6][c.div] + R() * 1.5, 17, {div: c.div, pot: [17, 15.5, 14, 13][c.div] + R() * 2.5});
      kid.club = c.id; kid.con = 3; kid.wage = Math.round(wageFor(kid, c.div) * .6 / 10) * 10; kid.val = valueOf(kid);
      W.players[kid.id] = kid; c.squad.push(kid.id);
      out.push([`Youngster ${pname(kid)} joins`, true]);
    }
    W.nextId = NEXT_ID;
  }
  if (eff.sell && p && p.loanFrom == null) {
    if (c.squad.length <= 14) out.push([`${p.ln} stays: squad too small to sell`, false]);
    else {
      const fee = Math.round(valueOf(p) * eff.sell / 1000) * 1000;
      const buyer = pick(W.clubs.filter(x => x.id !== c.id && x.div <= Math.max(0, c.div - (eff.sell >= 2 ? 1 : 0)) && x.squad.length < 24)) || pick(W.clubs.filter(x => x.id !== c.id));
      moveP(p, buyer, 0); c.cash += fee; buyer.cash -= fee; fixTeam(c);
      news(`${pname(p).toUpperCase()} JOINS ${buyer.name.toUpperCase()} FROM ${c.short} FOR ${money(fee)}`);
      out.push([`${p.ln} sold to ${buyer.short}`, false]); out.push(['£', fee]);
    }
  }
  if (eff.sign) {
    if (c.squad.length >= 26) out.push(['Squad full: he went elsewhere', false]);
    else {
      NEXT_ID = W.nextId;
      const lvl = Math.max(...W.clubs.filter(x => x.div === c.div).map(squadStrength)) + (eff.sign > 1 ? 3.5 : 1.5);
      const np = makePlayer(pick(['FW', 'MF', 'FW']), clamp(lvl, 1, 19.5), ri(26, 31), {div: c.div});
      np.club = c.id; np.con = 2; np.wage = Math.round(wageFor(np, c.div) * (eff.sign > 1 ? 2.2 : 1.6) / 10) * 10; np.val = valueOf(np);
      W.players[np.id] = np; c.squad.push(np.id); W.nextId = NEXT_ID;
      sc.pid = np.id;
      out.push([`${pname(np)} (${ovr(np)}) signs, ${money(np.wage)}/wk`, true]);
      news(`${pname(np).toUpperCase()} SIGNS FOR ${c.name.toUpperCase()}`);
    }
  }
  return out;
}
