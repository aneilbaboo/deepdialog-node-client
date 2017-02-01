import {Lokka} from 'lokka';
import {Transport} from 'lokka-transport-http';

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

  async query(op) {
    return await this.client.query(op);
  }

  async mutate(op, vars) {
    return await this.client.mutate(op, vars);
  }
}
