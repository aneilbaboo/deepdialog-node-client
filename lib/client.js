import {Lokka} from 'lokka';
import {Transport} from 'lokka-transport-http';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';

//import promiseRouter from 'express-promise-router';

import log from './log';
import Session from './session';

const GraphQLAPIURL = 'https://apistaging.deepdialog.ai/graphql';


export default class Client {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    var headers = {
      'Authorization': `Bearer ${appSecret}`
    };

    this.client = new Lokka({
      transport: new Transport(GraphQLAPIURL, headers)
    });
  }

  async query(op) {
    return await this.client.query(op);
  }

  async mutate(op, vars) {
    return await this.client.mutate(op, vars);
  }
}
