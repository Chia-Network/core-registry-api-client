const Registry = require('./src/registry');
const RetirementExplorerApi = require("./src/retirement-explorer");
const TokenDriver = require('./src/token-driver');

export class CoreRegistryClient {
  constructor(config, logger) {
    this.retirementExplorerApi = new RetirementExplorerApi(config, logger);
    this.tokenDriver = new TokenDriver(config, logger);
    this.registry = new Registry(config, logger);
  }
}