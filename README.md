# DeepDialog Node Client

Bot building superpowers.

### Get started

#### 1. Write Dialogs

```javascript
# maindialog.js
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

#### 3. Start the App Server

#### 4. Synchronize your App with DeepDialog

## How it works

DeepDialog gives you bot building superpowers.  Write reusable a complex
chatbot into smaller pieces which can be reused and call each other.  These
building blocks are called dialogs.  

At any point in a conversation with a user, one dialog has control, and responds
to events like button presses, raw text, or text processed by a natural language
processing engine.  

Any messages sent will be processed by that dialog.  You can break down a complex
problem into many smaller dialogs.  

## Classes

### Dialog

### Session

### App
