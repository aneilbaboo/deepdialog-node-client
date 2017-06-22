# Overview

## How it works

DeepDialog helps you write more sophisticated chatbots.  Currently, you can connect to Facebook, Twitter, WhatsApp, Kik and many other services through Smooch.io.  

## FlowScript

[FlowScript](./flowscript.md) is a high level language that makes it easy to script conversational flows.  The rest of this document explains how the DeepDialog service works and describes the core service objects.

### FlowScript Example

```javascript
// dialogs/astrologer.js
import {FlowDialog} from 'deepdialog';

export const Astrologer = new FlowDialog({
  name: "Astrologer",
  flows: {
    onStart: [
      "Hi, I'm Sybil the Astrologer...",
      { wait: 2 }, // 2 second pause
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

### Dialogs: Functions for Conversational Logic

In DeepDialog, you create and deploy apps to the web.  An app is a container for dialogs, which are bits of reusable conversational logic that are modeled on functions.  Similar to how functions call functions, dialogs can start other dialogs.  When a dialog finishes, it returns a value to the dialog that started it.  

At any point in a conversation, one dialog is in control.  When a user first interacts with your app, the app's main dialog gets control.  As the main dialog interacts with the user, it can choose to start other dialogs, including dialogs provided by other DeepDialog apps.  As a bot developer this allows you to develop and reuse conversational logic that same way you do with functions.  

### Postbacks

#### Postback buttons
Here, we create two postback buttons which call the subscribe postback.  Note how we include an argument in the postback token.

```javascript
MainDialog.onText("hello", async (session) => {
  session.send({
    text: "Which plan do you want to subscribe to?",
    actions: [
      session.postbackActionButton('subscribe', 'Premium', {subscriptionLevel:"premium"}),
      session.postbackActionButton('subscribe', 'Basic', {subscriptionLevel:"basic"})
    ]
  });
});

MainDialog.onPostback('subscribe', async (session, args) => {
  var result = await myBackend.subscribe(args.subscriptionLevel); // premium or Basic
  await session.send(`Congrats, you are subscribed at level ${args.subscriptionLevel}`);
  return result; // true or false
});
```

#### Higher order programming using postbacks

Just like you pass functions as arguments in modern programming languages, you can pass a postback to other dialogs which is an easy way to invoke a piece of code across dialogs or even across separate apps.

In this somewhat contrived example, the main dialog starts a generic dialog optimized for upselling customers, passing it a postback token.  The UpsellDialog invokes the postback handler when the user says they want to buy a particular plan.

```javascript
MainDialog.onIntent('enjoyed_freemium', async (session) => {
  await session.start('UpsellDialog', {
    subscription: session.postbackToken('subscribe');
  });
});

// Generic UpsellDialog can invoke the postback in the MainDialog
// Note how the upsell dialog passes parameters back to the postback
UpsellDialog.onIntent('wants_to_subscribe', async (session, args)=> {
  var result = await session.invokePostback(session.get('subscription'), {subscriptionLevel: args.subscription.level});
  // result will be true or false
});
```

#### Arguments to the postback handler

```javascript
MainDialog.onPostback(async (session, args, notification) {
  // session = the current user's session
  // args = args provided in
});
```


## Classes

This library provides the following classes.

### App
Represents an app on the deepdialog server. Each app contains many dialogs, and provides facilities for resetting its state.

#### getSessions

```javascript
app.getSessions({id, limit, before});
```
If `id` is provided, a single session is returned.
If `before` is provided, sessions with ids lexicographically before this are returned.
If `limit` is provided, up to that many sessions is returned (or up to the API's limit)

##### Examples
```javascript
// loop through all sessions in the app
var sessions = await app.getSessions();
while (sessions && sessions.length>0) {
  // do something

  // get next page
  let lastSession = sessions[sessions.length-1];
  sessions = await app.getSessions({before: lastSession.id});
}
```

### AppServer
Encapsulates a web server which allows your app to respond to events from the DeepDialog service.

### Dialog
An app contains a set of uniquely named dialogs.  Developers specify handlers which are called at different parts of the dialog's life cycle.

#### onStart
#### onInput
#### onResult
```javascript

```
#### onPostback
Names a postback handler.  

```javascript
MyDialog.onPostback(methodName, async (session, args, notification) {
  // session of the current user
  // args - arguments provided in the postback token or while invoking
  //        the postback
  // notification - an object of the structure:
  //      {
  //        session { ... } // data about the current user session
  //        message { ... } // optional data about the message that associated
  //                        // with this postback (e.g., the message which
  //                        // displayed the postback button)
  //        postback {
  //          id // the postback's id
  //          session {
  //            // the session which created the postback
  //            // usually, the same as the user's session, but may be different
  //            // e.g., when an item containing a postback button
  //            //   is shared to another user
  //            id: string,
  //            globals: Object
  //            stack: [ {
  //              id: string, locals: Object, tag:string
  //            } ]
  //          }
  //        }
});
```
### Session

#### send
Sends a message to the user.

```javascript
await session.send({type, text, mediaUrl, mediaType, actions, items});
```

* type - string, one of 'text', 'image', 'list', 'carousel'.  This value is inferred for text and image type messages (see Message Types below)
* text - string, text to be displayed
* mediaUrl - string, url to image or video
* mediaType - string, mimeType inferred if mediaUrl contains a recognized mimeType
* actions - array of Objects representing action buttons (see Actions below)
* items - array of Objects representing message items in list or carousel format (see Message Items below)

##### send: Message types
* text - text only message
* image - image or video (mediaUrl must be set)
* list - one or more vertically scrollable message items (items must be provided)
* carousel - one or more horizontal scrollable message items (items must be provided)

##### send: Actions
Actions are clickable buttons of different types:
* reply - quick reply button which disappears after being pressed
* link - opens a link in a web browser
* postback - invokes a postback handler
* share - opens a dialog that permits sharing of the message or message item with another user
* buy - enables the user to buy the item represented in the message item
* locationRequest - gets the location of the user

Each action type has a different structure.

###### send: Reply Action Button
```javascript
{
  type: 'reply',
  text: 'Yes',
  payload: 'replied_yes'
}
```

###### send: Link Action Button
```javascript
{
  type: 'link',
  text: 'Open Google',
  uri: 'https://google.com'
}
```

###### send: Postback Action Button
```javascript
{
  type: 'postback',
  text: 'Save Settings',
  payload: session.postbackToken('saveSettings', {preferences:'basic'})
}
// which is equivalent to
session.postbackActionButton('SaveSettings', 'saveSettings')
```

Where the postback handler was defined in the dialog as follows:

```javascript
MyDialog.onPostback('SaveSettings', async (session, args, notification) {
  // args will be {preferences:'basic'}
});
```

###### send: Share Button
```javascript
{
  type: 'share'  // note: button text is always "Share"
                 // cannot be set to custom value
}
```

###### send: Buy Action Button
```javascript
{
  type: 'buy',
  amount: 1000, // specified in cents (1000 = $10.00)
  currency: 'USD' // see https://support.stripe.com/questions/which-currencies-does-stripe-support
}
```

###### send: LocationRequest Action Button
```javascript
{
  type: 'locationRequest',
  text: 'Share Location'
}
```

##### send: Message Items
```javascript
{
  mediaUrl: 'http://images.com/someimage.jpg', // optional
  mediaType: 'image/jpeg', // inferred if not provided
  title: 'bold text', // 80 chars max
  description: 'lighter text below title', // 80 chars max
  actions: [ {...} ], // optional array of action objects
}
```

##### send: Carousel / List example
```javascript
session.send({
  type: 'carousel', // or list
  text: "Here are some choices",
  actions: [{
    type: 'postback',
    text: "Show More",
    payload: session.
  },
  items: [
    {
      title: 'First Choice',
      description: 'Explain Choice1',
      mediaUrl: 'https://mysite.com/images/choice1.jpeg',
      actions: [
        {
          type: 'link',
          uri: 'https://mysite.com/information/choice1.html'
        }
      ]
    },
    {
      title: 'Second Choice',
      description: 'Explain Choice2',
      mediaUrl: 'https://mysite.com/images/choice2.jpeg',
      actions: [
        {
          type: 'link',
          uri: 'https://mysite.com/information/choice2.html'
        }
      ]
  }
]
});
```

#### start
Starts a dialog, transferring control to it. The dialog's onStart handler will be called.

```javascript
await session.start(dialog, [locals, [tag]]);
```

* dialog - string,
#### finish
Called to end the current dialog, transferring control back to the dialog that called it.

```javascript
await session.finish([result]);
```
If the optional `result` is provided, it is sent to the parent dialog's onResult handler.

#### reset
Resets the stack, locals and/or global variables of the session.

### Useful properties of the session

* username
* displayName - usually, first + last name
* givenName
* surname
* email


```javascript
session.userFullName // returns the user's name
```

```javascript
await session.reset({globals:Boolean, locals:Boolean, frameId:String});
```

If frameId is null, the session is reset back to the initial frame.
If locals is true, the local variables of the new top frame will be cleared.
If globals is true, the global variables will be cleared.

##### Examples
```javascript
await session.reset(); // reset the stack back to the main frame
```

```javascript
await session.reset({globals:true, locals:true}); // completely reset the session state
```

```javascript
await session.reset({frameId:session.frameId}); // useful during recovery
              // conversation starts at the current frame frameId
```
