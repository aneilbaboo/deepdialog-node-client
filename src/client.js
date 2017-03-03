import {Lokka} from 'lokka';
import {Transport} from 'lokka-transport-http';

import log from './log';

const GraphQLAPIURL = 'http://apistaging.deepdialog.ai/graphql';

export default class Client {
  constructor(appId, appSecret, serverURL) {
    serverURL = serverURL || GraphQLAPIURL;
    this.appId = appId;
    this.appSecret = appSecret;
    var headers = {
      'Authorization': `Bearer ${appSecret}`
    };

    this.client = new Lokka({
      transport: new Transport(serverURL, { headers: headers })
    });
  }

  async query(op, vars) {
    log.debug('GraphQL Query\nVariables: %j\nOp: %j', vars, op);
    return await this.client.query(op, vars);
  }

  async mutate(op, vars) {
    log.debug('GraphQL Mutation\nVariables: %j\nOp: %j', vars, op);
    return await this.client.mutate(op, vars);
  }
}
