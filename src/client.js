import {Lokka} from 'lokka';
import {Transport} from 'lokka-transport-http';

import log from './log';

const GraphQLAPIURL = 'https://api.deepdialog.ai/graphql';

export default class Client {
  constructor(appId, accessToken, serverURL) {
    this.serverURL = serverURL || GraphQLAPIURL;
    this.appId = appId;
    this.accessToken = accessToken;
    var headers = {
      'Authorization': `Bearer ${accessToken}`
    };

    this.client = new Lokka({
      transport: new Transport(this.serverURL, { headers: headers })
    });
  }

  async query(op, vars) {
    log.debug('GraphQL Query\nVariables: %j\nOp: %s', vars, op);
    return await this.client.query(op, vars).catch(function(e) { throw e; });
  }

  async mutate(op, vars) {
    log.debug('GraphQL Mutation\nVariables: %j\nOp: %s', vars, op);
    return await this.client.mutate(op, vars);
  }

  clientWithAccessToken(accessToken) {
    return new Client(this.appId, accessToken, this.serverURL);
  }
}
