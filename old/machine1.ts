import {
  CreateCandyMachineInput,
  DefaultCandyGuardSettings,
  Metaplex,
  getMerkleProof,
  getMerkleRoot,
  keypairIdentity,
  toBigNumber,
} from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import secret from "../secret.json";

const RPC = "https://api.devnet.solana.com";
const SOLANA_CONNECTION = new Connection(RPC);

const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));
const COLLECTION_NFT_MINT = "9jWvBAgSdCHnLCcGAToMhHBLC5NnW4eoXABXaoUFDQqB";
const CANDY_MACHINE_ID = "44fCBFwdTveZvww3kFBDvknpNapvzX2P2qNEivfdLPvY";

const METAPLEX = Metaplex.make(SOLANA_CONNECTION).use(keypairIdentity(WALLET));

const allowList = [
  "G78qwbjfetiHGHhjKpPLxWrUq4eJqkLotS6CVQ2BQ2ZA",
  "7UvSycMiBikyErLyCGrTcAECDrCwghikvD7PunVDh2DS",
  "EniEGikEJEWpxrAfKVQaJ3xja7xTWPjfk1QXUNYK8g1p",
  "BaNS3Sx6MAg8QFu1yXi1Ftt5pjJPMR2vyrQHqaHwGL7r",
];
const merkleRoot = getMerkleRoot(allowList);
const validMerkleProof = getMerkleProof(
  allowList,
  "7UvSycMiBikyErLyCGrTcAECDrCwghikvD7PunVDh2DS"
);
async function generateCandyMachine() {
  const candyMachineSettings: CreateCandyMachineInput<DefaultCandyGuardSettings> =
    {
      itemsAvailable: toBigNumber(550), // Collection Size: 3
      sellerFeeBasisPoints: 0, // 10% Royalties on Collection
      symbol: "CHIPZ",
      maxEditionSupply: toBigNumber(0), // 0 reproductions of each NFT allowed
      isMutable: true,
      creators: [{ address: WALLET.publicKey, share: 100 }],
      collection: {
        address: new PublicKey(COLLECTION_NFT_MINT), // Can replace with your own NFT or upload a new one
        updateAuthority: WALLET,
      },
    };
  const { candyMachine } = await METAPLEX.candyMachines().create(
    candyMachineSettings
  );
  console.log(`✅ - Created Candy Machine: ${candyMachine.address.toString()}`);
  console.log(
    `     https://explorer.solana.com/address/${candyMachine.address.toString()}?cluster=devnet`
  );
}
async function updateCandyMachine() {
  const candyMachine = await METAPLEX.candyMachines().findByAddress({
    address: new PublicKey(CANDY_MACHINE_ID),
  });

  const { response } = await METAPLEX.candyMachines().update({
    candyMachine,
    guards: {
      allowList: { merkleRoot: getMerkleRoot(allowList) },
    },
  });

  console.log(`✅ - Updated Candy Machine: ${CANDY_MACHINE_ID}`);
  console.log(
    `     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`
  );
}

async function mintNft() {
  const candyMachine = await METAPLEX.candyMachines().findByAddress({
    address: new PublicKey(CANDY_MACHINE_ID),
  });
  let { nft, response } = await METAPLEX.candyMachines().mint(
    {
      candyMachine,
      collectionUpdateAuthority: WALLET.publicKey,
      mintAuthority: WALLET,
      // guards: {
      //   proof: getMerkleProof(allowList, WALLET.publicKey.toString()),
      // },
    },
    { commitment: "finalized" }
  );

  console.log(`✅ - Minted NFT: ${nft.address.toString()}`);
  console.log(
    `     https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  );
  console.log(
    `     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`
  );
}

// generateCandyMachine();
// updateCandyMachine();
// addItems();
mintNft();
