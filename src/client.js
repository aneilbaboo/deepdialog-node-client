import {Lokka} from 'lokka';
import {Transport} from 'lokka-transport-http';

const GraphQLAPIURL = 'http://localhost:3000/graphql'; //'http://apistaging.deepdialog.ai/graphql';


export class Client {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    var headers = {
      'Authorization': `Bearer ${appSecret}`
    };

    this.client = new Lokka({
      transport: new Transport(GraphQLAPIURL, { headers: headers })
    });
  }

  async query(op) {
    return await this.client.query(op);
  }

  async mutate(op, vars) {
    return await this.client.mutate(op, vars);
  }
}
