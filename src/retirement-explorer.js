const superagent = require("superagent");

const { generateUriForHostAndPort } = require("../utils");

class RetirementExplorerApi {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  retirementExplorerUri = generateUriForHostAndPort(
    this.config.RETIREMENT_EXPLORER.PROTOCOL,
    this.config.RETIREMENT_EXPLORER.HOST,
    this.config.RETIREMENT_EXPLORER.PORT
  );

  /**
   * Adds Retirement Explorer API Key to the request headers if available.
   * @param {Object} headers - Optional headers to extend
   * @returns {Object} Headers with API Key added if available
   */
  maybeAppendRetirementExplorerApiKey = (headers = {}) => {
    if (this.config.RETIREMENT_EXPLORER.API_KEY) {
      headers["x-api-key"] = this.config.RETIREMENT_EXPLORER.API_KEY;
    }
    return headers;
  };

  /**
   * Function to get retirement activities from the explorer API.
   *
   * @param {number} page - Page number.
   * @param {number} limit - Number of activities per page.
   * @param {number} minHeight - Minimum block height to start.
   * @returns {Promise<Object>} - A promise that resolves to an array of retirement activities.
   */
  getRetirementActivities = async (page, limit, minHeight) => {
    try {
      this.logger.debug(`GET ${this.retirementExplorerUri}/v1/activities`);
      const response = await superagent
        .get(`${this.retirementExplorerUri}/v1/activities`)
        .query({
          page,
          limit,
          minHeight: Number(minHeight) + 1,
          sort: "asc",
        })
        .set(this.maybeAppendRetirementExplorerApiKey())
        .timeout({ response: 300000, deadline: 600000 });

      if (response.status === 403) {
        throw new Error(
          "Retirement Explorer API key is invalid, please check your config.yaml."
        );
      }

      const activities = response.body?.activities || [];

      const retirements = activities?.filter(
        (activity) => activity.mode === "PERMISSIONLESS_RETIREMENT"
      );

      return retirements;
    } catch (error) {
      this.logger.error("Cannot get retirement activities", error);

      // Log additional information if present in the error object
      if (error.response && error.response.body) {
        this.logger.error(
          `Additional error details: ${JSON.stringify(error.response.body)}`
        );
      }

      return [];
    }
  };
}

module.exports = RetirementExplorerApi;
