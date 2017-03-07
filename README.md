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

#### send
Sends a message to the user.

```javascript
await session.send({text, type, mediaUrl, mediaType, actions, items});
```

#### start
Starts a dialog, transferring control to it. The dialog's onStart handler will be called.

```javascript
await session.start(dialog, [locals, [tag]]);
```
#### finish
Called to end the current dialog, transferring control back to the dialog that called it.

```javascript
await session.finish([result]);
```
If the optional `result` is provided, it is sent to the parent dialog's onResult handler.

#### reset
Resets the stack, locals and/or global variables of the session.

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
                                                // conversation starts at current frame
```

### App

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
