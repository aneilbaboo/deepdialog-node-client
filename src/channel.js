// const endpointConfigurationUpdateOp = `(
//   $endpointType: EndpointConfigurationTypeEnum, $webhookSecret: String,
//   $appKeyId: String, $appKeySecret: String) {
//     endpointConfigurationCreate(endpointType: $endpointType,
//       appKeyId: $appKeyId, appKeySecret: $appKeySecret) {
//         id endpointType appKeyId appKeySecret webhook
//       }
//     // }`;
//
// const endpointConfigurationUpdateOp = `($id: String,
//   $endpointType: EndpointConfigurationTypeEnum, $webhookSecret: String,
//   $appKeyId: String, $appKeySecret: String) {
//     endpointConfigurationUpdate(id: $id, endpointType: $endpointType,
//       appKeyId: $appKeyId, appKeySecret: $appKeySecret) {
//         id endpointType appKeyId appKeySecret webhook
//       }
//     }`;
//
// const endpointConfigurationDeleteOp = `($id: String) {
//       endpointConfigurationDelete(id: $id)
//     }`;
//
// const endpointConfigurationGetOp = `($id: String) {
//   app {
//     endpointConfigurations(id: $id) {
//       id endpointType webhookSecret appKeyId appKeySecret webhook
//     }
//   }
// }`;
