# Flow Language

## Overview

DeepDialog flows enable developers to script interactions using an intuitive hierarchical data format.  Flows make it easier to use the primitives of the DeepDialog backend.  Starting dialogs, capturing results, programming action buttons, and using branching logic can be done with a fraction of the effort, and in a compact readable style.

### FlowDialog

To get started, you need to create an instance of FlowDialog, and pass an object containing the dialog name and a flows parameter.  The `onStart` flow commences when the dialog starts.

```javascript
import {FlowDialog} from 'deepdialog';

export const HelloWorld = new FlowDialog({
  name: "HelloWorld",
  flows: {
    onStart: [
      {
        type: 'text'
        text: "Hello human!"
      }
    ]
  }
});
```

### Flows and Commands

Flows let you to write a sequential set of steps for the bot to execute, including branching logic, responding to button clicks, and starting other dialogs and collecting results from them.

The compiler learns about top level flows by looking at the `flows` argument provided to the FlowDialog constructor.  It discovers new flows as it parses these flows, and generates names for them.  See the section below about Flow Paths.

#### The onStart flow is special

There is a special flow named onStart which is initiated automatically when a dialog is started.  You can add other flows in there too, if you need. Most of the time, you'll just have an onStart flow.

#### Commands

Commands are objects which have a type key.  For example, here is a command which sends a simple text message to the user:

```javascript
{
  type: 'text',
  text: 'Hello!'
}
```

##### Abbreviation

To improve readability, the developer can write abbreviated forms of some commands.  During compilation, the type of an abbreviation is inferred and it's substituted with a normalized form.  

For example, strings are interpreted as simple text message commands. The following are all equivalent.  The last being the normal form:

```javascript
"Hello!"
{ text: "Hello!" }
{ type:'text', text: 'Hello!'} // similar to the argument to session.send(...)
```

In addition, anywhere a flow is expected, it is permissible to supply a single command or an abbreviation of a command.

For example, the start flow above could have been written:

```javascript
export const MyDialog = new FlowDialog({
  name: "MyDialog",
  flows: {
    onStart: "Hello, sailor!"
  }
});
```

### Handlers

Many elements in a flow tree can be substituted with a function called a handler. Handlers enable a developer to dynamically generate messages, action buttons, and branch to other dialogs dynamically.  

Handlers always have the form:
```javascript
(vars, session, path) => { … }  
```
Where,
`vars` - an Object containing the variables associated with the session.
  `then` flow of a start command, the special `value` key will be set to the
  value returned by the dialog started by the command.
`session` - the session object if you need low-level access to it
`path` - an array containing the ids identifying the current element.  This
  can be useful if a programmer needs to compute the path of a flow relative
  to the current element, for example, when generating message items or actions.

#### Usage of Handlers

* Command handlers - a handler which appears in a flow executes arbitrary code.
  The value is ignored.
* Value handlers - handlers which dynamically compute values usually don't produce side effects and must return an appropriately structured Object. For example, the `actions` and `items` presented in messages may be generated at runtime by substituting a handler which returns part of the  tree.

   If dynamically computed action Objects need to trigger *not* contain `then` flows, since flows must be compiled at runtime. If a developer wishes to trigger a flow from a dynamically generated action.

#### Command types

##### Message commands

The flow language supports the same types available in Session.send():

* text - sends a text message. May include actions.
```javascript
{
  type: 'text',
  text: 'Would you like to proceed?',
  actions: {
    yes: "great"
    no: "oh well"
  }
}
```

* image - sends an image with an optional caption. May include actions.
```javascript
{
  type: 'text',
  text: 'What kind of dog is this?',
  mediaUrl: 'http://imgur.com/ad4by.png',
  mediaType: 'image/png', // inferred from file extension
  actions: {
    yes: "great"
    no: "oh well"
  }
}
```

* list - sends a vertical list.  Must include items. May include actions.
* carousel - sends a horizontal carousel.  Must include items. May include actions.
```javascript
{
  type: 'list', // or carousel
  displaySettings: { // optional
    imageAspectRatio: 'square' // 'square' or 'horizontal'
  },
  items: {
    chocolate: {
      title:'chocolate ice cream',
      description: 'yummy chocolate icecream',
      mediaUrl: 'https://aws.com/icecreambot/chocolate.png', // optional
      size: 'compact', // optional 'compact' or 'large' (default)
      actions: {
        order: {
          text: 'buy!'
          amount: 100
        },
        ingredients: {
          uri: 'http://icecreambot.com/ingredients/chocolate'
        }
      }
    },
    vanilla: {
      ...
    }
  }
}
```

###### Item Objects

Items represent elements in a list or carousel type message.  They have the following structure:

```javascript
{
  title: 'the title (40 chars)', //
  description: 'the description (80 chars)',
  mediaUrl: 'https://domain.com/image.png',
  mediaType: 'image/png', // optional if  type can be inferred from extension
  actions: {
    key1: action1,
    key2: action2,
    ...
  }
}
```
The items key can be generated dynamically using a handler.

###### Action Objects

There are several types of action buttons:

* reply - quick reply buttons that disappear after one is clicked
```javascript
{
  id: 'yes', // inferred from a key in actions, if actions is an object
  type: 'reply',
  text: 'why yes!',
  then: [ ... ] // or...
  thenFlow: ['path','to','a','flow']
}
```

* postback - postback buttons are clickable elements that persist in the
    conversation thread.  

  They have the same structure as reply buttons.  

* link - link buttons show a web page
  ```javascript
  {
    type: 'link', // not necessary, inferred
    uri: 'http://imgur.com/gallery/C3tx7'
  }
  ```
* share
  ```javascript
  { type: 'share' } // no 'text' value!!
  ```
* buy
```javascript
{ type: 'buy', amount: 100, currency:'USD'} // buy something for 1 dollar
// equivalent to
{ amount: 100 } // denomination in pennies!
```
* locationRequest
```javascript
{
  type:'locationRequest',
  text: 'Share my location!'
}
```

###### Inference of Reply and Postback Buttons

Actions in 'text' and 'image' messages are assumed to be type 'reply', if another type cannot be inferred.

Actions in carousel and list items are assumed to be of type 'postback', if another type cannot be inferred.

###### Dynamic Actions and Items

It is often necessary to generate actions and items at runtime.  For example, retrieving a number of items from a changing inventory based on a user's preferences.  This can be done by supplying a handler function instead of a list or object.

I.e., instead of sending a message with a set of hard-coded actions,
```javascript
{
  text: "What kind of ice cream do you want?"
  actions: {
    chocolate: { start: ["OrderIceCream", {type:"chocolate"},
                 then: "Hope you enjoy the chocolate!" },
    vanilla:   { start: ["OrderIceCream", {type:"vanilla"},
                 then: "Hope you enjoy the vanilla!" },
    strawberry:{ start: ["OrderIceCream", {type:"strawberry"},
                 then: "Hope you enjoy the strawberry!" }
  }
}
```

Generate them on the fly:
```javascript
{
  text: "What kind of ice cream do you want?",
  async actions (vars, session, path) { // ignore vars and session
    var iceCreamTypes = await db.getIceCreamTypes(); // ['chocolate', ...]
    return iceCreamTypes.map(type=>({
      id: type,
      text: type,
      start: ["OrderIceCream", {type:type}],
      value: type,
      thenFlow: [...path, 'orderComplete']
    }));
  },
  flows: {
    orderComplete: "Hope you enjoyed the {{value}}!"
    }
  }
}
```

Notice how we replaced `then` with `thenFlow`.  This is necessary because all flows must be named and known to the compiler at runtime.  It also has the benefit of allowing us to reuse an existing flow.  The `thenFlow` key takes a path to a particular flow.  

##### Wait command

Pauses the bot for a specified number of seconds

```javascript
{ type: 'wait', seconds: 5}
// same as:
{ seconds: 5}
```

##### Conditional command

Run flow conditionally: if/then/else logic

```javascript
{
  type: 'conditional',  // optional - type is inferred from if/then
  if: myPredicate,  // handler function which returns boolean
  then: ["Wow!", "It is true"], // flow if truthy
  else: "It is false :(" // flow if falsey
}

// same as:
{ if: myPredicate, then: ["Wow!", "It is true"], else: "It is false :(" }
```

##### Set command

Set session variables

```javascript
{
  type: 'set', // inferred
  set: {
    address: '420 Paper St.',
    city: 'Wilmington',
    state: 'DE'
    zip: '19886'
  }
}

// alternatively, use a handler:
{
  set: async ({userId})=>await db.getUserAddress(userId)
}
```

##### Start command

Starts a new dialog

```javascript
{
  type: 'start',
  start: "PromptDialog",
  args: {text: 'Enter your name'},
  async then(vars, session) { // value returned by PromptDialog
    await session.send(`Your name is ${vars.value}`);  
  }
}

// is equivalent to this abbreviation:
{ start: ["PromptDialog", {text:"Enter your name"}],
  then: "Your name is {{value}}" } // using interpolation
```

###### The value variable

When a dialog finishes, the value it returns can be accessed as `value` in the `then` handler's vars parameter, as shown above.

##### Finish command

Ends the current dialog, returning control to the calling dialog.

```javascript
{
  type: 'finish',
  finish: ({username})=>username; // this dialog returns the username
}
// equivalent to:
{ finish({username}) { return username; } }
```

#### String interpolation

Not yet implemented.  The system will interpolate values into strings so you can write:
```javascript
then: "So your favorite color is {{value}}"
```
as a shortcut for:
```javascript
async then(vars, session) {
  await session.send(`So your favorite color is ${vars.value}`);
}
```
