# Flow Language

## Overview

DeepDialog flows enable developers to script interactions using an intuitive hierarchical data format.  Flows make it easier to use the primitives of the DeepDialog backend.  Starting dialogs, capturing results, programming action buttons, and using branching logic and iterating a sequence of commands can be done with a fraction of the effort, and in a compact readable style.

## FlowDialog

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

## Flows

Flows are sequences of commands, such as sending images and messages to a user, setting variables, etc. Some commands act like control structures in traditional programming languages, enabling conditional branching, iteration, etc.  Each branch in the flow is given a unique name.  This is covered in [Advanced Topics](#advanced-topics) under [Ids And Flow Paths](#ids-and-flow-paths)


### The onStart flow

Top level flows are defined in the `flows` argument provided to the FlowDialog constructor.  When a FlowDialog starts, it automatically runs the special onStart flow.  Arguments provided to the dialog are also available in the first argument of handler functions, which are discussed below. The flows parameter also accepts other flows.  See the [Advanced Topics](#advanced-topics) section for more information on how to use these.  

## Commands

Commands are objects which have a type key.  For example, here is a command which sends a simple text message to the user:

```javascript
{
  type: 'text',
  text: 'Hello!'
}
```

### Abbreviation

To improve readability, the developer can write abbreviated forms of some commands.  During compilation, the type of an abbreviation is inferred and the command is normalized to a standard form, a JS Object which always contains a `type` key.  

For example, strings are interpreted as simple text message commands. The following are all equivalent.  The last being the normal form:

```javascript
"Hello!"
{ text: "Hello!" }
{ type:'text', text: 'Hello!'} // similar to the argument to session.send(...)
```

In addition, anywhere a flow is expected, it is permissible to supply a single command or an abbreviation of a command.

For example, the onStart flow in [the HelloWorld dialog](#flowdialog) could have been written:

```javascript
import {FlowDialog} from 'deepdialog';

export const HelloWorld = new FlowDialog({
  name: "HelloWorld",
  flows: {
    onStart: "Hello, human!"
  }
});
```

## Handlers

Many elements in a flow tree can be substituted with a function called a handler. Handlers enable a developer to dynamically generate messages, action buttons, branch to other dialogs dynamically, or run arbitrary code.  Handlers make it easy to write highly dynamic, responsive conversational flows.

### Command versus Value Handlers

* **Command Handler** - function that appears where a flow or flow command is expected.  Command handlers have the following form:

```javascript
// command handler
(vars, session, path) => {
  // do something
}  
```
They are useful for executing arbitrary code, including producing side-effects.  Commands and command handlers are executed in sequential order within a flow.

* **Value Handler** - function that appears where a value is expected.  Value handlers are not guaranteed to run sequentially, and should not produce side effects.  They have the same form as command handlers, but are expected to return a value.

```javascript
// value handler
(vars, session, path) => value
```

Where,

`vars` - an Object containing the variables associated with the session.
`session` - the session object if you need low-level access to it.
`path` - an array containing the ids identifying the current element.  

See also the [Advanced Topics](#advanced-topics) section.

## String interpolation

The system interpolates keys in vars into strings so you can write:

```javascript
{ ...
  then: "So your favorite color is {{value}}"
}
```
as a shortcut for:
```javascript
{
  ...
  async then(vars, session) {
    await session.send(`So your favorite color is ${vars.value}`)
  }
}
```

Note that strings returned by handlers will not be interpolated.  Within a handler, use Javascript backquote interpolation.

## Command Types

### Message commands

The flow language supports the same types available in Session.send():

### text Command

Sends a text message and optional action buttons.
```javascript
{
  type: 'text',
  text: 'Would you like to proceed?',
  actions: {
    yes: "great"    // these are highly abbreviated forms of actions
    no: "oh well"   // see the section on [Action Objects] (#action-objects)
  }
}
```

### image Command

Sends an image with an optional caption and/or buttons buttons.

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

### list and carousel Commands

Sends a vertical scrolling list or horizontally scrolling carousel.  Must include items. May include actions.  These two items have identical structure except for the type keyword.  The type of these commands cannot be inferred.  

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

#### Item Objects

Items represent elements in a list or carousel type message.  Items are provided as arrays or lists:

```javascript
{ ...
  items: {
    a: { ... }, // item a - "a" is the id
    b: { ... }, // item b
  }
}
// is equivalent to
{ ...
  items: [
    { id: a, ... },
    { id: b, ... }
  ]
}
```

Each item has the following structure:

```javascript
{
  id: "item1", // required for items in an array; default is key in Object format
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
The items key can be generated dynamically using a handler.  See the Advanced Topics section.

#### Action Objects

Like items, the actions can be provided as an Array or Object, or dynamically generated using a handler.

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
{ amount: 100 } // denomination in pennies
```
* locationRequest
```javascript
{
  type:'locationRequest',
  text: 'Share my location!'
}
```

#### Inference of Reply and Postback Buttons

Actions in 'text' and 'image' messages are assumed to be type 'reply', if another type cannot be inferred.

Actions in carousel and list items are assumed to be of type 'postback', if another type cannot be inferred.

### Wait command

Pauses the bot for a specified number of seconds

```javascript
{ type: 'wait', seconds: 5}
// same as:
{ seconds: 5}
```

### Conditional command

Run flow conditionally: if/then/else logic

```javascript
{
  id: 'firstIfBlock', // optional - defaults to 'if' if not provided
  type: 'conditional',  // optional - type is inferred from if/then
  if: myPredicate,  // handler function which returns boolean
  then: ["Wow!", "It is true"], // flow if truthy
  else: "It is false :(" // flow if falsey
}

// same as (except for id):
{ if: myPredicate, then: ["Wow!", "It is true"], else: "It is false :(" }
```

### Set command

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
{ // assuming this db method returns a JS Object:
  // note: this doesn't set userId.  The handler uses userId to
  // retrieve an object containing key-value pairs.  It is these
  // returned key-value pairs which will be set.
  async set({userId}) {return await db.getUserAddress(userId); }
}
```

### Start command

Starts a new dialog.

```javascript
{
  id: 'myId', // defaults to start(MyDialog) or start() if not provided
  type: 'start',
  start: "PromptDialog",
  args: {text: 'Enter your name'},
  async then(vars, session) { // vars.value returned by PromptDialog
    await session.send(`Your name is ${vars.value}`);  
  }
}

// is equivalent to this abbreviation:
{ start: ["PromptDialog", {text:"Enter your name"}],
  then: "Your name is {{value}}" } // using interpolation
```

#### Start handler

The start parameter has three forms:

```javascript
 // 1. start MyDialog with no args
{ start: "MyDialog" }
// 2. pass args to dialog
{ start: ["MyDialog", {arg1:1, arg2:2}] }
// 3. use a handler to generate the params
//    (more in the advanced section)
{ start: ()=>["MyDialog", {arg1:, arg2:2}]}
```

#### Getting the returned value

When the dialog finishes, the `then` flow will execute and the vars parameter will contain a special key `value` that holds the result.  This is the same value that was passed to session.finish() or the finish command (see following).

The value can be accessed via handlers or string interpolation.

```javascript
{ start: "MyDialog",
  then: [
    // use a handler
    ({value})=> {
    // do something with the value returned by MyDialog
    },
    // save the result into a variable
    { set: {
        X: ({value})=>value
      }
    },
    // use the result in a message:
    "MyDialog returned {{value}}"
  ]
}
```

### finish Command

Ends the current dialog, returning control to the calling dialog.
```javascript
{ type:'finish', finish: true}
// equivalent to
{ finish: true}
```

The finish argument can be a handler:

```javascript
{
  type: 'finish',
  finish: ({username})=>username; // this dialog returns the username
}
// or
{ finish({username}) { return username; } }
```

### while Command

Coming soon.

Continues executing the then flow while the value returned by the while handler is truthy.

```javascript
{ id: 'firstWhile', // required if >1 iteration exists in a then block -
                    // defaults to 'while'
  while: ({condition})=>condition,
  then: [ ... ] }
```

### forEach Command

Coming soon.

Iterates over a list.  On each iteration, the special variable `value` is bound to each subsequent element of the list.

```javascript
{ forEach: [4,3,2,1],
  then: "{{value}}..." }
  // sends:
  // 4...
  // 3...
  // 2...
  // 1...

// alternative form takes a dynamically determined list
{ forEach({mylist}) { return myList; },
  then({value}, session) {
    // do something with each list element
  }
}
```

## Advanced Topics

### Dynamically Generate Message Items

It is sometimes necessary to generate parts of the flow at runtime.  For example, retrieving a number of items from a changing inventory based on a user's preferences.  This can be done by supplying a handler function instead of a list or object.

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


### Ids and Flow Paths

Each flow is identified by an array of `id`s called a flow path or "path" representing the set of transitions from the top level to a particular element.  The ids are inferred or written explicitly for particular commands which represent branch points or points where the dialog resumes control of the conversation.  

A point in the conversation flow where the user clicked "yes" then "no" after a dialog started would be referred to as:
```javascript
['onStart', 'yes', 'no']
```
A related concept is the flowKey which is a string written:`"onStart.yes.no"`.


#### Why set the id explicitly?

Some commands - conditional and start commands - create default ids.  Why override them?  The system uses flow paths to trigger actions.  For example, when postback buttons persist in a user's message thread.  If you change the flow, the ids referenced by those buttons will not longer exist.  Explicitly naming the ids so they are invariant is one solution to this problem.

#### Hashed ids escape nesting

You can ignore the nesting context by providing an id that starts with a # character.  For example, if you have a deeply nested button at `"onStart.yes.no.certainly.ok.placeOrder"`, you may want to make the path to this important action accessible even in the event that the conversation flow changes.  To do this, instead of writing

```javascript
...
actions: {
  placeOrder: { ... }
}
```

Use a hashed id:

```javascript
...
actions: {
  "#placeOrder": { ... }
}
```

The flow path of this element will be `#placeOrder` and children of this element will have this id as root.

### Starting other flows

The FlowDialog constructor takes a flows parameter.  We've already seen the onStart flow.  

### Chaining

We can pass a result obtained from one dialog to another:

```javascript
{ start: "FirstDialog",
  then: {
    start:({value})=>["SecondDialog", value]
    then: ...
  }
}
```

### Higher Order Programming

In this fanciful example, a SalesDialog implements high level logic for conducting an interaction with a customer.  The SalesDialog takes several string parameters - customerConcernsDialog, productsDialog, and salesDialog - which represents dialogs which carry out the detailed logic for a particular domain, such as appliance sales.


```javascript
export const SalesDialog = new FlowDialog({
  name: "SalesDialog ",
  flows: {
    onStart: [
      {
        // understand what the customer wants...
        start: ({customerConcernsDialog})=>customerConcernsDialog,
        then: {
          // discuss appropriate products with the customer
          // output of the products dialog will be a product
          // the customer wants to buy
          start:({value, productsDialog})=>[
            productsDialog,
            {customerConcerns: value}
          ],
          then: {
            // allow customer to place an order
            start:({value, placeOrderDialog})=>[
              placeOrderDialog,
              {product: value}
            ],
            "Thank you, nice doing business with you!"
          }
        }
      }
    ]
  }
});

export const ApplianceSalesDialog = new FlowDialog({
  name: "ApplianceSalesDialog",
  flows: {
    onStart: {
      start: ['GenericSalesmanDialog', {
        customerConcernsDialog: 'ApplianceConcernsDialog',
        productsDialog: 'ApplianceProduct'
      }]
    }
  }
})
```
