# FlowScript

FlowScript is a high-level language that lets a chatbot developer write conversational flows using JSON or YAML. A flow is a sequence of commands for the bot to execute, such as sending messages with images and buttons, branching logic, and the ability to start modules called conversational procedures called dialogs.

In practical terms, a flow is a JS Array, and commands are JS Objects, strings or functions.  This means a developer can generate flows programmatically.  Arguments to commands can be generated dynamically by providing a function in place of the string or other literal which is expected.  For example, you can dynamically generate action buttons by providing a function to the `actions` parameter of a message command.  

 FlowScript provides a high level interface to the DeepDialog API, but also provides access to the lower level service objects (such as the DeepDialog Session). See the documentation [here](./index.md).


### Example

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
  name: "ReadHoroscope",
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

## FlowDialog

To get started, you create an instance of FlowDialog, and pass an object containing the dialog name and a flows parameter.  The `onStart` flow commences when the dialog starts.

```javascript
import {FlowDialog} from 'deepdialog';

export const HelloWorld = new FlowDialog({
  name: "HelloWorld",
  flows: {
    onStart: [
      {
        type: "text"
        text: "Hello human!"
      }
    ]
  }
});
```

## Flows

Flows are sequences of commands, such as sending images and messages to a user, setting variables, etc. Some commands act like control structures in traditional programming languages, enabling conditional branching, iteration, etc.  A complete list of all the places flows can appear is covered in [Where Flows Appear](#where-flows-appear).

Each branch in the flow is given a unique name.  This is covered in  [Ids And Flow Paths](#ids-and-flow-paths).

### The onStart flow

Top level flows are defined in the `flows` argument provided to the FlowDialog constructor.  When a FlowDialog starts, it automatically runs the special onStart flow.  Arguments provided to the dialog are also available in the first argument of handler functions, which are discussed below. The flows parameter also accepts other flows.  See the [Top Level Flows](#top-level-flows) section.

## Commands

Commands are objects which have a type key.  For example, here is a command which sends a simple text message to the user:

```javascript
{
  type: "text",
  text: "Hello!"
}
```

### Abbreviation

To improve readability, the developer can write abbreviated forms of some commands.  During compilation, the type of an abbreviation is inferred and the command is normalized to a standard form, a JS Object which always contains a `type` key.  

For example, strings are interpreted as simple text message commands. The following are all equivalent.  The last being the normal form:

```javascript
"Hello!"
{ text: "Hello!" }
{ type:"text", text: "Hello!"} // similar to the argument to session.send(...)
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

#### Dollar operator

Access and transform session variables quickly using this syntactic sugar for value handlers.

```javascript
$.a // a short hand for ({a})=>a

// access class methods using $
// E.g., if a is a string,
$.a.$toLowerCase() // equivalent to ({a})=>a.toLowerCase()

// a handful of extra $methods are provided
$.a.$gt($.b) // sugar for ({a,b})=>a>b
$.a.$gte($.b) // sugar for ({a,b})=>a>=b
// also: $lt, $lte, $equal, $add, $sub, $mul, $div, $pow

```

See also the [Advanced Topics](#advanced-topics) section.

### Named Handlers

In some situations, it may be useful to keep code separate from content, for example, to separate the work of content writers and coders. The FlowDialog takes a `handlers` argument which is a hash from names to handlers.  Like unnamed handlers, named handlers can be sync or async. To invoke a named handler, provide an object of the form:

```javascript
{ exec: "nameOfHandler"}
```

For example:

```javascript
const MyDialog = new FlowDialog({
  name: "MyDialog",
  flows: {
    onStart: [
      { exec: "doSomethingHandler" },
      { text: {exec: "returnsTextHandler"} }
    ]
  },
  handlers: {
    async doSomethingHandler(vars, session, path) {
      // do somthing here
    },
    returnsTextHandler(vars, session, path) { return "hello"; }
  }
});
```

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

The most basic kind of command is sending a message to the user.  FlowScript provides commands for each of the message types supported by the DeepDialog API's messageSend endpoint.  

### text Command

Sends a text message and optional action buttons.

```javascript
{
  type: "text",
  text: "Would you like to proceed?",
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
  type: "text",
  text: "What kind of dog is this?",
  mediaUrl: "http://i.imgur.com/YRCG8eP.jpg",
  mediaType: "image/png", // inferred from file extension
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
  type: "list", // or carousel
  displaySettings: { // optional
    imageAspectRatio: "square" // 'square' or 'horizontal"
  },
  items: {
    chocolate: {
      title:"chocolate ice cream",
      description: "yummy chocolate icecream",
      mediaUrl: "https://aws.com/icecreambot/chocolate.png", // optional
      size: "compact", // optional 'compact' or 'large" (default)
      actions: {
        order: {
          text: "buy!"
          amount: 100
        },
        ingredients: {
          uri: "http://icecreambot.com/ingredients/chocolate"
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
    { id: "a", ... },
    { id: "b", ... }
  ]
}
```

Each item has the following structure:

```javascript
{
  id: "item1", // required for items in an array; default is key in Object format
  title: "the title (40 chars)", //
  description: "the description (80 chars)",
  mediaUrl: "https://domain.com/image.png",
  mediaType: "image/png", // optional if  type can be inferred from extension
  actions: {
    key1: action1,
    key2: action2,
    ...
  }
}
```
The `items` key can be generated dynamically using a handler.  See the section in [Advanced Topics](#dynamically-generate-message-items) section.

#### Action Objects

Like `items`, the `actions` can be provided as an Array or Object, or dynamically generated using a handler.  If `actions` is an array, each object should have an `id` key.

There are several types of action buttons:

* reply - quick reply buttons that disappear after one is clicked
```javascript
{
  id: "yes", // inferred from a key in actions, if actions is an object
  type: "reply",
  text: "why yes!",
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
    type: "link", // not necessary, inferred
    uri: "http://imgur.com/gallery/C3tx7"
  }
  ```
* share
  ```javascript
  { type: "share" } // no 'text" value!!
  ```
* buy
```javascript
{ type: "buy", amount: 100, currency:"USD" } // buy something for 1 dollar
// equivalent to
{ amount: 100 } // denomination in pennies
```
* locationRequest
```javascript
{
  type:"locationRequest",
  text: "Share my location!"
}
```

### Analyses
Analyses

analyses
* intent

```javascript
analyses: [
  {
    intent:"buyTickets",
    then: {

    }
  }
]
```

*

#### Inference of Reply and Postback Buttons

Actions in 'text' and 'image' messages are assumed to be type 'reply', if another type cannot be inferred.

Actions in carousel and list items are assumed to be of type 'postback', if another type cannot be inferred.

### Wait command

Pauses the bot for a specified number of seconds

```javascript
{ type: "wait", wait: 5}
// same as:
{ wait: 5}
```

### Conditional command

Run flow conditionally: if/then/else logic

```javascript
{
  id: "firstIfBlock', // optional - defaults to 'if" if not provided
  type: "conditional",  // optional - type is inferred from if/then
  if: myPredicate,  // handler function which returns boolean
  then: ["Wow!", "It is true"], // flow if truthy
  else: "It is false :(" // flow if falsey
}

// same as (except for id):
{ if: myPredicate, then: ["Wow!", "It is true"], else: "It is false :(" }

// when and unless syntactic sugar is also supported:
{ when: condition,  do: [...] }

{ unless: condition, do: [...] }
```

### Set command

Set session variables

```javascript
{
  type: "set", // inferred
  set: {
    address: "420 Paper St.",
    city: "Wilmington",
    state: "DE"
    zip: "19886"
  }
}

// alternatively, use a handler:
{ // assuming this db method returns a JS Object:
  // note: this doesn't set userId.  The handler uses userId to
  // retrieve an object containing key-value pairs.  It is these
  // returned key-value pairs which will be set.
  async set({userId}) {return await db.getUserAddress(userId); }
}

// shorthand for setting a deep attribute
// child objects are created automatically
// existing keys in parent objects are retained:
{ set: {"user.home.address": "420 Paper St."}}

// destructuring functionality can be useful
//   find vars are sequences of word chars between {}
//      split on "," and trim spaces
function myHandler() { return {a:1, b:2, c:3, d:4}; }
...
{ set: {"{ a, c}": myHandler}} // sets the keys a and c
```

Variables set using this command are persisted to the backend.  Each session frame can store slightly under 4K of data, and bloating your session variables will negatively impact performance, as all the values are loaded for each request, even if those values are not used.  If you need to persist a large object, save it elsewhere and only store a token in the session.  You can use volatile variables (see the (setv command)[#setv-command]) to temporarily store a large object in the session.

### SetV Command

Sets volatile variables.

```javascript
{ setv: { myvolatile: 'value' } }
```

Unlike regular variables which are saved to the DeepDialog back end, volatile variables persist only for the duration of a request.  This is useful when you want to store a large data structure without incurring the overhead of regular variables, which are loaded for each session.  

### Start command

Starts a new dialog.

```javascript
{
  id: "myId", // defaults to start(MyDialog) or start() if not provided
  type: "start",
  start: "PromptDialog",
  args: {text: "Enter your name"},
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
    // save the result to the global var X
    { set: {
        X: ({value})=>value,
        // alternatively,
        Y: $.value // see the $ operator
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
  type: "finish",
  finish: ({username})=>username; // this dialog returns the username
}
// or
{ finish({username}) { return username; } }
```

### iteration Command

This command has a number of alternate forms:

#### for iteration
Loops over one or more variables while a condition is true, incrementing each by a specified value.

```javascript
{
  id: "optional-flow-id", // optional identifier; defaults to 'for'
  for: [initializer, condition, increment],
  do: [...] // flow
}
```

Example:
```javascript
{
  for: [{x:1}, ({x})=>x<100, {x:1}],
  do: [ ... ]
}
```
#### while Iteration
Continues executing the then flow while the value returned by the while handler is truthy.

```javascript
{
  id: "...", // optional, defaults to 'while'
  while: condition,
  do: [ ... ]
}
```

And the converse of `while`, `until`:
```javascript
{
  id: "...", // optional, defaults to 'until'
  until: condition,
  do: [ ... ]
}
```

#### forEach Command

Coming soon.

Iterates over one or more Arrays until the end of the shortest array is reached.

```javascript
{ forEach: {
    elt1:[4,3,2,1,0],  // 0 is not reached
    elt2:['earth', 'below us', 'drifting', 'falling']
  },
  do: "{{elt1}}... {{elt2}}" }
  // sends:
  // 4... earth
  // 3... below us
  // 2... drifting
  // 1... falling

// alternative form takes a dynamically generated list
{ forEach: { post: async ({userId}) => await Blog.getPosts(userId) },
  then: "You wrote {{post.title}} on {{post.created}}"
}
```

## Advanced Topics

### Where Flows Appear

Flows can be provided in the following places:
1. keys of the `flows` Object in the FlowDialog constructor
2. `then` and `else` in the conditional command
3. `then` key in the `start` command
4. `then` key in message actions
5. keys of the `flows` Object in a message command
6. `do` key in the iteration command

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
    return iceCreamTypes.map(iceCreamType=>({
      type: 'postback', // persistent button, takes a value
      text: iceCreamType, // button text
      value: iceCreamType, // let the postback flow know which type was selected
      thenFlow: '#orderIceCream'
    }));
  },
  postbackFlows: {
    "#orderIceCream": [
      {
        start: ({value})=>["OrderIceCream", {iceCreamType:value}],
        // when ordering  complete, send a message:
        then:"Hope you enjoy the {{value}} ice cream!"
      }
    ]
  }
}
```

Notice how we replaced `then` with `thenFlow`.  This is necessary because all flows must be named and known to the compiler at runtime.  It also has the benefit of allowing us to reuse an existing flow.  The `thenFlow` key takes a path to a particular flow.  

At the current time, only postback actions can contain values.  This may change in a future release.


### Ids and Flow Paths

Each flow is identified by an array of `id`s called a flow path or "path" representing the set of transitions from the top level to a particular element.  The ids are inferred or written explicitly for particular commands which represent branch points or points where the dialog resumes control of the conversation.  

A point in the conversation flow where the user clicked "yes" then "no" after a dialog started would be referred to as:
```javascript
['onStart', 'yes', 'no']
```
A related concept is the flowKey which is a string written:`"onStart.yes.no"`.

#### Explicitly Starting Flows

Use the FlowDialog `startFlow` method to provides a method to explicitly start a flow.  E.g.:

```javascript
export const MyFlowDialog = new FlowDialog({
  name: "MyFlowDialog",
  flows: {
    myFlow: [...]
  }
})
MyFlowDialog.onIntent('some_intent', async (session) => {
  await this.startFlow('myFlow', session);
});
```

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

### Top level flows

We've seen the `onStart` top level flow, which is run when a dialog is started.  It appears in the FlowDialog's constructor.    You're free to name additional top-level flows.  You can trigger them by using the `thenFlow` key available in certain commands.

```javascript
export const MyDialog = new FlowDialog({
  name: "MyDialog",
  flows: {
    onStart: [ ... ],
    differentTopLevelFlow: [ ... ], // not executed when MyDialog starts
    ...
  }
});
```

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
        customerConcernsDialog: "ApplianceConcernsDialog",
        productsDialog: "ApplianceProduct"
      }]
    }
  }
})
```
