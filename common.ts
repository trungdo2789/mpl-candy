import {
  addConfigLines,
  create,
  fetchCandyMachine,
  mplCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  TokenStandard,
  createNft,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  Umi,
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
  some,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import base58 from "bs58";
import secret from "./secret.json";
import secret1 from "./secret1.json";

export const RPC = "https://api.devnet.solana.com";

// Use the RPC endpoint of your choice.
const umi1 = createUmi(RPC).use(mplCandyMachine());
const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret));
export const umi = umi1.use(keypairIdentity(keypair));

const umi2 = createUmi(RPC).use(mplCandyMachine());
const keypair2 = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret1));
export const umiAcc = umi2.use(keypairIdentity(keypair2));

export const mySigner = createSignerFromKeypair(umi, keypair);

console.log("admin signer", mySigner.publicKey);

export const treasury = "E87BUrZc2VxBNuewDuPRYDBWqhghdB2CUPaRBc8YmVid";
export const collectionMint = "3zXYT4GmN8fuZ3USbHCsz3po5hnP9Nz2Vd2wxFWDvpgj";
// export const candyMachinePk = "36LNd3XTJHS9gFs3kyBf9WraKQvFXaajmwsannucteyw";
export const candyMachinePk = "HM9Ye5a1gh1ck54TfdDFqUipdKZKE1RucmHny8Lu9JU4";

export const cluster = "devnet";

async function createCollection() {
  const collectionMint = generateSigner(umi);

  const collection = await createNft(umi, {
    mint: collectionMint,
    authority: mySigner,
    name: "CHIPZ Collection NFT",
    symbol: "CHIPZ",
    uri: "https://bafybeifpyhhx4tufmzikpyty3dvi4veh5xgx4zk47iago524b4h45oxoke.ipfs.nftstorage.link/1.json",
    sellerFeeBasisPoints: percentAmount(0), // 9.99%
    isCollection: true,
  }).sendAndConfirm(umi);
  console.log(
    `✅ - Minted Collection NFT: ${base58.encode(collection.signature)}`
  );
  console.log(
    `     https://explorer.solana.com/address/${base58.encode(
      collection.signature
    )}?cluster=${cluster}`
  );
  return collectionMint.publicKey;
}

export async function createMachine(
  collectionMint: string,
  collectionUpdateAuthority: any,
  itemsAvailable = 50
) {
  // Create the Candy Machine.
  const candyMachine = generateSigner(umi);
  (
    await create(umi, {
      candyMachine,
      collectionMint: publicKey(collectionMint),
      collectionUpdateAuthority,
      tokenStandard: TokenStandard.NonFungible,
      sellerFeeBasisPoints: percentAmount(0),
      itemsAvailable,
      symbol: "CHIPZ",
      creators: [
        {
          address: umi.identity.publicKey,
          verified: true,
          percentageShare: 100,
        },
      ],
      configLineSettings: some({
        prefixName: "CHIPZ #$ID+1$",
        nameLength: 0,
        symbol: "CHIPZ",
        prefixUri:
          "https://bafybeifpyhhx4tufmzikpyty3dvi4veh5xgx4zk47iago524b4h45oxoke.ipfs.nftstorage.link/$ID+1$.json",
        uriLength: 0,
        isSequential: false,
      }),
    })
  ).sendAndConfirm(umi);
  console.log(
    `✅ - Created Candy Machine: ${candyMachine.publicKey.toString()}`
  );
  return candyMachine;
}

export async function insertItems(
  candyMachinePk: string,
  from: number,
  to: number,
  batch = 10,
  startIndex = from
) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const items = [];
  for (let i = from; i < to; i++) {
    const tokenId = i + 1;
    items.push({
      name: `${tokenId}`,
      uri: `${tokenId}`,
    });
  }
  for (let i = 0; i < items.length; i += batch) {
    const sliceItem = items.slice(i, i + batch);
    console.log("sliceItem", sliceItem);
    const rsp = await addConfigLines(umi, {
      candyMachine: candyMachine.publicKey,
      index: i + startIndex,
      configLines: sliceItem,
    }).sendAndConfirm(umi);
    console.log(`✅ - Items added to Candy Machine: ${candyMachinePk}`);
    console.log(
      `     https://explorer.solana.com/tx/${base58.encode(
        rsp.signature
      )}?cluster=${cluster}`
    );
  }
}
