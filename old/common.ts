import { Metaplex, PublicKey, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair } from "@solana/web3.js";
import secret from "../secret.json";

const RPC = "https://api.devnet.solana.com";
const SOLANA_CONNECTION = new Connection(RPC);

const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));
const NFT_METADATA =
  "https://mfp2m2qzszjbowdjl2vofmto5aq6rtlfilkcqdtx2nskls2gnnsa.arweave.net/YV-mahmWUhdYaV6q4rJu6CHozWVC1CgOd9NkpctGa2Q";

const METAPLEX = Metaplex.make(SOLANA_CONNECTION).use(keypairIdentity(WALLET));

export async function createCollectionNft() {
  const { nft: collectionNft } = await METAPLEX.nfts().create({
    name: "CHIPZ",
    uri: "https://bafybeifpyhhx4tufmzikpyty3dvi4veh5xgx4zk47iago524b4h45oxoke.ipfs.nftstorage.link/1.json",
    sellerFeeBasisPoints: 0,
    isCollection: true,
    updateAuthority: WALLET,
  });

  console.log(
    `✅ - Minted Collection NFT: ${collectionNft.address.toString()}`
  );
  console.log(
    `     https://explorer.solana.com/address/${collectionNft.address.toString()}?cluster=devnet`
  );
}

export async function addItems(
  candymachineid: string,
  from: number,
  to: number,
  batch = 5
) {
  const candyMachine = await METAPLEX.candyMachines().findByAddress({
    address: new PublicKey(candymachineid),
  });
  const items = [];
  for (let i = from; i < to; i++) {
    const tokenId = i + 1;
    items.push({
      name: `CHIPZ #${tokenId}`,
      uri: `https://bafybeifpyhhx4tufmzikpyty3dvi4veh5xgx4zk47iago524b4h45oxoke.ipfs.nftstorage.link/${tokenId}.json`,
    });
  }
  for (let i = 0; i < items.length; i += batch) {
    const sliceItem = items.slice(i, i + batch);
    const { response } = await METAPLEX.candyMachines().insertItems(
      {
        candyMachine,
        items: sliceItem,
      },
      { commitment: "finalized" }
    );

    console.log(`✅ - Items added to Candy Machine: ${candymachineid}`);
    console.log(
      `     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`
    );
  }
}
