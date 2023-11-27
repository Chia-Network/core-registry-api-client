const superagent = require("superagent");
const { logger } = require("../logger");
const { CONFIG } = require("../config");

const {
  generateUriForHostAndPort,
  waitFor,
  handleApiRequestWithRetries,
} = require("../utils");

class TokenDriverApi {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  tokenDriverUri = generateUriForHostAndPort(
    this.config.CHIA_CLIMATE_TOKENIZATION.PROTOCOL,
    this.config.CHIA_CLIMATE_TOKENIZATION.HOST,
    this.config.CHIA_CLIMATE_TOKENIZATION.PORT
  );

  /**
   * Adds Token Driver API Key to the request headers if available.
   * @param {Object} headers - Optional headers to extend
   * @returns {Object} Headers with API Key added if available
   */
  maybeAppendTokenDriverApiKey = (headers = {}) => {
    if (this.config.CHIA_CLIMATE_TOKENIZATION.API_KEY) {
      headers["x-api-key"] = this.config.CHIA_CLIMATE_TOKENIZATION.API_KEY;
    }
    return headers;
  };

  /**
   * @async
   * @function sendParseDetokRequest
   * @param {string} detokString - The string to be detokenized.
   * @throws Will throw an error if the request cannot be processed.
   * @return {Promise<Object>} The API response body.
   */
  sendParseDetokRequest = async (detokString) => {
    try {
      const url = `${this.tokenDriverUri}/v1/tokens/parse-detokenization?content=${detokString}`;

      this.logger.debug(`GET ${url}`);
      const response = await superagent
        .get(url)
        .set(this.maybeAppendTokenDriverApiKey());
      return response.body;
    } catch (error) {
      throw new Error(`Detokenize api could not process request: ${error}`);
    }
  };

  /**
   * Waits for confirmation of token creation.
   *
   * @param {string} transactionId - The transaction ID
   * @param {number} [retry=0] - The retry count
   * @returns {Promise<boolean>} True if confirmed, false otherwise
   */
  waitForTokenizationTransactionConfirmation = async (
    transactionId,
    retry = 0
  ) => {
    if (retry > 60) {
      return false;
    }

    try {
      await waitFor(30000);
      this.logger.debug(
        `GET ${this.tokenDriverUri}/v1/transactions/${transactionId}`
      );
      const response = await superagent
        .get(`${this.tokenDriverUri}/v1/transactions/${transactionId}`)
        .set(this.maybeAppendTokenDriverApiKey());

      if (response.body?.record?.confirmed) {
        return true;
      }

      await waitFor(30000);
      return this.waitForTokenizationTransactionConfirmation(
        transactionId,
        retry + 1
      );
    } catch (error) {
      this.logger.error(
        `Error confirming token creation: ${transactionId}, ${error.message}`
      );
      return false;
    }
  };

  /**
   * Confirms if detokenization has been completed.
   * @param {Object} payload - The body of the request containing details for confirmation
   * @returns {Promise<Object>} - A promise that resolves to an object containing the confirmation response.
   */
  confirmDetokanization = async (payload) => {
    try {
      const assetId = payload?.token?.asset_id;
      if (payload.unit) {
        delete payload.unit;
      }

      return handleApiRequestWithRetries(async () => {
        this.logger.debug(
          `PUT ${this.tokenDriverUri}/v1/tokens/${assetId}/detokenize`
        );
        return await superagent
          .put(`${this.tokenDriverUri}/v1/tokens/${assetId}/detokenize`)
          .send(payload)
          .set(
            this.maybeAppendTokenDriverApiKey({
              "Content-Type": "application/json",
            })
          );
      });
    } catch (error) {
      throw new Error(
        `Detokenization could not be confirmed: ${error.message}`
      );
    }
  };

  /**
   * Registers a token creation event on the registry and returns a TokenCreatedResponse.
   *
   * @async
   * @function
   * @param {TokenizationBody} tokenizationBody - The request body containing token and payment details.
   * @returns {Promise<TokenCreatedResponse>} The token creation response.
   * @throws {Error} If the Token Driver API key is invalid.
   */
  createToken = async (tokenizationBody) => {
    try {
      this.logger.debug(`POST ${this.tokenDriverUri}/v1/tokens`);
      const response = await superagent
        .post(`${this.tokenDriverUri}/v1/tokens`)
        .send(tokenizationBody)
        .set(
          this.maybeAppendTokenDriverApiKey({
            "Content-Type": "application/json",
          })
        );

      if (response.status === 403) {
        throw new Error(
          "Token Driver API key is invalid, please check your config.yaml."
        );
      }

      this.logger.trace(
        `Token creation response: ${JSON.stringify(response.body)}`
      );

      return response?.body;
    } catch (error) {
      this.logger.error(
        `Token creation could not be initiated: ${error.message}`
      );

      // Log additional information if present in the error object
      if (error.response && error.response.body) {
        this.logger.error(
          `Additional error details: ${JSON.stringify(error.response.body)}`
        );
      }

      return null;
    }
  };
}

module.exports = TokenDriverApi;
