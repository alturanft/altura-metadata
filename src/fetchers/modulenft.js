import axios from "axios";
import { Contract } from "ethers";
import { Interface } from "ethers/lib/utils";
import slugify from "slugify";

import { parse } from "../parsers/simplehash";
import { getProvider } from "../utils";
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

  const searchParams = new URLSearchParams();
  const nftIds = tokens.map(
    ({ contract, tokenId }) => `${network}.${contract}.${tokenId}`
  );
  searchParams.append("nft_ids", nftIds.join(","));

  const url = `https://api.simplehash.com/api/v0/nfts/assets?${searchParams.toString()}`;
  const data = await axios
    .get(url, {
      headers: { "X-API-KEY": process.env.SIMPLEHASH_API_KEY.trim() },
    })
    .then((response) => response.data)
    .catch((error) => {
      logger.error(
        "simplehash-fetcher",
        `fetchTokens error. chainId:${chainId}, message:${
          error.message
        },  status:${error.response?.status}, data:${JSON.stringify(
          error.response?.data
        )}`
      );

      throw error;
    });

  return data.nfts.map(parse).filter(Boolean);
};

export const fetchContractTokens = async (chainId, contract, continuation) => {
  const network = getNetworkName(chainId);

  const searchParams = new URLSearchParams();
  if (continuation) {
    searchParams.append("cursor", continuation);
  }

  const url = `https://api.simplehash.com/api/v0/nfts/${network}/${contract}?${searchParams.toString()}`;
  const data = await axios
    .get(url, {
      headers: { "X-API-KEY": process.env.SIMPLEHASH_API_KEY.trim() },
    })
    .then((response) => response.data);

  return {
    continuation: data.next,
    metadata: data.nfts.map(parse).filter(Boolean),
  };
};
