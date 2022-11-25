import {
  customHandleContractTokens,
  customHandleToken,
  hasCustomHandler,
} from "../../../../../src/custom";
import { extendMetadata } from "../../../../../src/extend";

import * as opensea from "../../../../../src/fetchers/opensea";
import * as rarible from "../../../../../src/fetchers/rarible";
import * as simplehash from "../../../../../src/fetchers/simplehash";
import * as centerdev from "../../../../../src/fetchers/centerdev";
import * as soundxyz from "../../../../../src/fetchers/soundxyz";
import * as modulenft from "../../../../../src/fetchers/modulenft";

import { RequestWasThrottledError } from "../../../../../src/fetchers/errors";

const api = async (req, res) => {
  try {
    // Validate network and detect chain id
    const network = req.query.network;
    if (
      !["mainnet", "rinkeby", "goerli", "optimism", "polygon"].includes(network)
    ) {
      throw new Error("Unknown network");
    }

    let chainId = 1;
    switch (network) {
      case "optimism":
        chainId = 10;
        break;
      case "rinkeby":
        chainId = 4;
        break;
      case "goerli":
        chainId = 5;
        break;
      case "polygon":
        chainId = 137;
        break;
    }

    // Validate indexing method and set up provider
    const method = req.query.method;
    if (
      !["opensea", "rarible", "simplehash", "centerdev", "soundxyz"].includes(
        method
      )
    ) {
      throw new Error("Unknown method");
    }

    let provider = opensea;
    if (method === "rarible") {
      provider = rarible;
    } else if (method === "simplehash") {
      provider = simplehash;
    } else if (method === "centerdev") {
      provider = centerdev;
    } else if (method === "soundxyz") {
      provider = soundxyz;
    }

    // Case 1: fetch all tokens within the given contract via pagination
    const contract = req.query.contract?.toLowerCase();
    if (contract) {
      const continuation = req.query.continuation;
      if (hasCustomHandler(chainId, contract)) {
        const result = await customHandleContractTokens(
          chainId,
          contract,
          continuation
        );
        return res.status(200).json(result);
      } else {
        try {
          const result = await Promise.all(
            await provider
              .fetchContractTokens(chainId, contract, continuation)
              .then((l) =>
                l.map((metadata) => extendMetadata(chainId, metadata))
              )
          );

          return res.status(200).json(result);
        } catch (error) {
          if (error instanceof RequestWasThrottledError) {
            return res
              .status(429)
              .json({ error: error.message, expires_in: error.delay });
          }
          throw error;
        }
      }
    }

    // Case 2: fetch specific tokens only
    let tokens = req.query.token;
    if (!tokens) {
      throw new Error("Missing token(s)");
    }
    if (!Array.isArray(tokens)) {
      tokens = [tokens];
    }
    if (!tokens.length) {
      throw new Error("Missing token(s)");
    }

    tokens = tokens.map((token) => {
      const [contract, tokenId] = token.split(":");
      return {
        contract: contract.toLowerCase(),
        tokenId,
      };
    });

    // Filter out tokens that have custom handlers
    const customTokens = [];
    tokens = tokens.filter((token) => {
      if (hasCustomHandler(chainId, token.contract)) {
        customTokens.push(token);
        return false;
      }
      return true;
    });

    let metadata = [];
    if (tokens.length) {
      // try to get token meta from modulenft first
      try {
        metadata = await Promise.all(
          await modulenft
            .fetchTokens(chainId, tokens)
            .then((l) => l.map((metadata) => extendMetadata(chainId, metadata)))
        );
        console.log("metadata", metadata);
        if (metadata && metadata.length) {
          tokens = tokens.filter((token) => {
            return (
              metadata.findIndex(
                (data) =>
                  data.contract === token.contract &&
                  +data.tokenId == +token.tokenId
              ) == -1
            );
          });
          console.log(tokens);
        }
      } catch (error) {
        console.log(error);
      }

      // if modulenft doesn't support all tokens, use other methods
      if (tokens.length) {
        // Method-specific validations
        if (method === "opensea" && tokens.length > 20) {
          throw new Error("Too many tokens");
        }
        if (method === "rarible" && tokens.length > 50) {
          throw new Error("Too many tokens");
        }
        if (method === "centerdev" && tokens.length > 100) {
          throw new Error("Too many tokens");
        }

        try {
          const newMetadata = await Promise.all(
            await provider
              .fetchTokens(chainId, tokens)
              .then((l) =>
                l.map((metadata) => extendMetadata(chainId, metadata))
              )
          );

          metadata = [...metadata, ...newMetadata];
        } catch (error) {
          if (error instanceof RequestWasThrottledError) {
            return res
              .status(429)
              .json({ error: error.message, expires_in: error.delay });
          }
          throw error;
        }
      }
    }

    if (customTokens.length) {
      metadata = [
        ...metadata,
        ...(await Promise.all(
          customTokens.map((token) => customHandleToken(chainId, token))
        )),
      ];
    }

    return res.status(200).json({ metadata });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

export default api;
