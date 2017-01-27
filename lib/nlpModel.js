export default class NLPModel {
  constructor ({name, provider, accessId, accessToken}) {
    this.name = name;
    this.provider = provider;
    this.accessId = accessId;
    this.accessToken = accessToken;
  }
}
