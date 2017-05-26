//


// import {makeFlowDialog} from 'deepdialog';
//
// export const DeliDialog = makeFlowDialog("DeliDialog", [
//   "Hi, I'm a deli bot.  What can I do for you today?",
//   "Let me show you a list of things you can buy",
//   {
//     text: "Items for you",
//     async items (session) {
//       var products = await db.getProducts(session.get('userId'));
//       return products.map(item => ({
//         title: item.name,
//         description: "",
//         mediaUrl: item.image,
//         actions: [
//           { type: 'buy', text: 'buy' },
//           { type: 'postback',
//             text: 'save to cart',
//             postback: 'saveToCart',
//             args: {item:item.id} },
//           { type: 'link', uri: item.infoUrl }
//         ]
//       }));
//     },
//     async saveToCart (session, {itemId}) {
//       await session.set({cart: session.get('cart',[]).push(itemId) });
//       await session.start()
//     }
//   },
//   async (session) => {
//     return {
//       text: "Purchaseable items",
//
//     }
//   },
//   {
//     start: ["BuyingDialog", {item:':a'}]
//     start(session) { return ["BuyingDialog", {a:1, b:2}] },
//     onResult(session, result) {
//
//     },
//     ifResult: [
//
//     ],
//     ifNotResult: [
//
//     ]
//   },
//
//   dialogWhile((session)=> { session.get('tries')<4}, [
//
//   ]);
//   {
//     text: "Hi, {session.givenName} How are you doing today?",
//     replies: {
//       "yes": [
//         "Hi, I'd like to __",
//         "What are you up to?",
//         {
//           text: "hi",
//           mediaUrl:""
//         }
//       ]
//     },
//     items: {
//       "purchasable":  {
//         type: "dynamicList",
//         async items (session) {
//           {
//             type: 'postback',
//             title: session.get
//           }
//         },
//         async postback (session) {
//
//         }
//       },
//
//     },
//     actions: {
//       "share": {
//         type: "share",
//         next: {
//
//         }
//       },
//       "cheese": {
//         type: "buy",
//         amount: 1000,
//         currency: "USD"
//       },
//       "salami": {
//         type: "buy",
//         amount: 1599,
//         currency: "USD"
//       },
//       "dynamicItems": {
//
//       },
//       "human": {
//         postback: async (session) => {
//           await session.start("HumanEscalation");
//         }
//       },
//
//
//     }
//   ]);
