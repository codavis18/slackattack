// example bot
import botkit from 'botkit';
const Yelp = require('yelp');

const yelp = new Yelp({
  consumer_key: process.env.YELP_CONSUMER_KEY,
  consumer_secret: process.env.YELP_CONSUMER_SECRET,
  token: process.env.YELP_TOKEN,
  token_secret: process.env.YELP_TOKEN_SECRET,
});

console.log('starting bot');

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'I\'m up!');
});


// example hello response
controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// food request
controller.hears(['food'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'food!');

  yelp.search({ term: 'food', location: 'Montreal' })
  .then((data) => {
    console.log(data);
    data.businesses.forEach(business => {
      console.log(business.name);
      bot.reply(message, business.name);
    });
  })
  .catch((err) => {
    console.error(err);
  });
});


controller.hears(['hungry'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  let askWhere;
  let askType;
  let location;
  let foodType;

  // start a conversation to handle this response.
  bot.startConversation(message, (err, convo) => {
    console.log('someone is hungry...');
    convo.say('beep boop you hungry son?');

    askWhere = (response, convo) => {
      convo.ask('Where are you?', (response, convo) => {
        console.log(response);
        location = response.text;
        convo.say(`Okay, I'll look for food in ${location}.`);
        askType(response, convo);
        convo.next();
      });
    };

    askType = (response, convo) => {
      convo.ask('What kind of food are you in the mood for?', (response, convo) => {
        console.log(response);
        foodType = response.text;
        convo.say(`Okay, searching for ${foodType} in ${location}.`);

        yelp.search({ term: `${foodType}`, location: `${location}`, actionlinks: 'true' })
        .then((data) => {
          console.log(data);
          data.businesses.forEach(business => {
            console.log(business.name);

            bot.reply(message, {
              username: 'codbot',
              // text: `${business.name}, ${business.display_phone}, Rating: ${business.rating}/5`,
              attachments: [
                {
                  fallback: 'To be useful, I need you to invite me in a channel.',
                  title: business.name,
                  title_link: business.url,
                  text: business.snippet_text,
                  color: '#7CD197',
                  thumb_url: business.image_url,

                  fields: [
                    {
                      title: 'Rating',
                      value: `${business.rating}/5`,
                      short: true,
                    },
                    {
                      title: 'Phone',
                      value: business.display_phone,
                      short: true,
                    },
                  ],
                },
              ],
            });
          });
        })
        .catch((err) => {
          console.error(err);
        });
        convo.next();
      });
    };
  });
  bot.startConversation(message, askWhere);
});
