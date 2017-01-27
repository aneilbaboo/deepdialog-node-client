export class NLPModel {
  constructor ({name, provider, accessId, accessToken}) {
    this.name = name;
    this.provider = provider;
    this.accessId = accessId;
    this.accessToken = accessToken;
  }

  toObject() {
    return {
      name: this.name,
      provider: this.provider,
      accessId: this.accessId,
      accessToken: this.accessToken
    };
  }
}
