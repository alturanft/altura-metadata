import _ from "lodash";

export const parse = (asset) => {
  const { data, originalRequest } = asset;
  const contractAddress = originalRequest.split(":")[0];
  const tokenId = +originalRequest.split(":")[1];
  return {
    contract: contractAddress,
    tokenId: tokenId,
    name: data.metadata.name,
    collection: _.toLower(contractAddress),
    // Token descriptions are a waste of space for most collections we deal with
    // so by default we ignore them (this behaviour can be overridden if needed).
    description: data.metadata.description,
    imageUrl: data.metadata.image_cached || data.metadata.image,
    mediaUrl: data.metadata.animation_url,
    attributes: (data.metadata.attributes || []).map((trait) => ({
      key: trait.trait_type,
      value: trait.value,
      kind: typeof trait.value == "number" ? "number" : "string",
      rank: 1,
    })),
  };
};
