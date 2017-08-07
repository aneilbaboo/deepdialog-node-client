[![CircleCI](https://circleci.com/gh/aneilbaboo/deepdialog-node-client.svg?style=shield&circle-token=aa75773740dfa392f2564fb3b4ee0fe30fe298f5)](https://circleci.com/gh/aneilbaboo/deepdialog-node-client)

# DeepDialog Node Client

Bot building superpowers.

## Documentation

* [How it Works](docs/index.md)
* [The DeepDialog Scripting Language](docs/scripting.md)

## Example

```javascript
// dialogs/astrologer.js
import {FlowDialog} from 'deepdialog';

export const Astrologer = new FlowDialog({
  name: "Astrologer",
  flows: {
    onStart: [
      "Hi, I'm Sybil the Astrologer...",
      { type:'wait', seconds:2 }, // a pregnant pause
      {
        start: ["Sys:YesNoPrompt", {
          text: "I can read your horoscope. Would you like that?"
        }],
        then: {
          if: ({value})=>value,
          then: {
            text: "Would you like to subscribe for daily readings?",
            actions: {
              yes: [
                { set: {Subscribed: true} }, //
                "You are now subscribed for daily readings"
              ],
              no: [
                { set: {Subscribed: false} },
                "Ok, I won't subscribe you to daily readings"
              ]
            }
          },
          else: "I'm sorry, I'm just a simple bot.  I can only tell horoscopes."
        }
      }
    ]
  }
});

// dialogs/readhoroscope.js
export {FlowDialog} from 'deepdialog';

export const ReadHoroscope = new FlowDialog({
  name: 'ReadHoroscope',
  flows: {
    start: {
      if: ({ZodiacSign})=>!ZodiacSign,
      then: async ({ZodiacSign}) => {
        var horoscope = await retrieveHoroscope(ZodiacSign),
        session.send(horoscope);
      },
      else: {
        start: "PickSign",
        then: {
          if: {result}=>result,
          then: async ({result}) => await session.save({ZodiacSign: result});
        }
      }
    }
  }
});

// dialogs/picksign.js
// A dialog which enables the user to choose their Zodiac sign
// etc.
```

### Get started

Step by step instructions - or checkout the starter bot:

#### 1. Write Dialogs

Checkout [DeepDialog Script](docs/scripting.md) for a high-level approach
to writing dynamic conversations.

```javascript
// maindialog.js
import {Dialog} from 'deepdialog';

export const MainDialog = new Dialog({
  name: 'MainDialog',
});

// When the dialog starts:
MainDialog.onStart(async function (session, localVars) {
  await session.send("I'm a bot, what can I help you with?");
});

// When the dialog receives text:
MainDialog.onText(/hello.*/, async function (session, text) {
  // respond to the hello message
  await session.send("Hello to you!");
});

```

#### 2. Create the App

And add the dialogs:

```javascript
import {MainDialog} from './maindialog';

var app = new App({
  appId: process.env.DEEPDIALOG_APPID,
  appSecret: process.env.DEEPDIALOG_APPSECRET,
  hostURL: process.env.HOST_URL,
  mainDialog: 'MainDialog', // point at the starting dialog
  deepDialogServer: process.env.DEEPDIALOG_SERVER_URL,
  automaticTypingState: true
});

app.addDialogs(MainDialog);
```

#### 3. Start the App Server and save the state
```javascript

app.server.start(process.env.PORT, async function () {
  log.info('Bot started');
  await app.save();
});
```
