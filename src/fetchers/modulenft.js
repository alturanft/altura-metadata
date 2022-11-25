import axios from "axios";
import slugify from "slugify";

import { parse } from "../parsers/modulenft";
import { logger } from "../logger";

const getNetworkName = (chainId) => {
  let network;
  if (chainId === 1) {
    network = "eth";
  } else {
    throw new Error("Unsupported chain id");
  }

  return network;
};

export const fetchCollection = async (chainId, { contract, tokenId }) => {
  try {
    const network = getNetworkName(chainId);

    const url = `https://api.modulenft.xyz/api/v2/${network}/nft/collection?contractAddress=${contract}`;
    const data = await axios
      .get(url, {
        headers: { accept: "application/json" },
      })
      .then((response) => response.data.data);
    const royalties = [];

    if (data.fees.sellerFeeAddress && data.fees.sellerFee > 0) {
      royalties.push({
        recipient: data.fees.sellerFeeAddress,
        bps: data.fees.sellerFee,
      });
    }

    return {
      id: contract,
      slug: slugify(data.slug, { lower: true }),
      name: data.name,
      community: null,
      metadata: {
        description: data.description,
        imageUrl: data.images.image_url,
        bannerImageUrl: data.images.banner_image_url,
        discordUrl: data.socials.discord_url,
        externalUrl: data.socials.external_url,
        twitterUsername: data.socials.twitter_username,
      },
      royalties,
      openseaRoyalties: [],
      contract,
      tokenIdRange: null,
      tokenSetId: `contract:${contract}`,
    };
  } catch {
    try {
      logger.error(
        "modulenft-fetcher",
        `fetchCollection error. chainId:${chainId}, contract:${contract}, message:${
          error.message
        },  status:${error.response?.status}, data:${JSON.stringify(
          error.response?.data
        )}`
      );

      return null;
    } catch {
      return null;
    }
  }
};

export const fetchTokens = async (chainId, tokens) => {
  const network = getNetworkName(chainId);

  if (!tokens.length) {
    return null;
  }
  const searchParams = new URLSearchParams();
  const nftIds = tokens.map(
    ({ contract, tokenId }) => `${contract.toLowerCase()}:${tokenId}`
  );
  searchParams.append("token", nftIds.join(","));

  const url = `https://api.modulenft.xyz/api/v2/${network}/nft/batchGetToken?${searchParams.toString()}`;
  console.log(url);
  const data = await axios
    .get(url, {
      headers: { accept: "application/json" },
    })
    .then((response) => response.data)
    .catch((error) => {
      logger.error(
        "modulenft-fetcher",
        `fetchTokens error. chainId:${chainId}, message:${
          error.message
        },  status:${error.response?.status}, data:${JSON.stringify(
          error.response?.data
        )}`
      );

      throw error;
    });
  console.log(data);

  return data.map(parse).filter(Boolean);
};

export const fetchContractTokens = async (chainId, contract, continuation) => {
  // TODO: To implement
  return null;
};
