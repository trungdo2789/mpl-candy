import {
  Umi,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import { RPC, cluster, insertItems, mySigner, umi } from "./common";
import {
  updateCandyGuard,
  fetchCandyGuard,
  fetchCandyMachine,
  getMerkleRoot,
  mintV2,
  route,
  getMerkleProof,
  mplCandyMachine,
  addConfigLines,
  create,
  mintFromCandyMachineV2,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  setComputeUnitLimit,
  createMintWithAssociatedToken,
} from "@metaplex-foundation/mpl-toolbox";
import secret from "./secret.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  TokenStandard,
  fetchCollectionAuthorityRecord,
} from "@metaplex-foundation/mpl-token-metadata";
import base58 from "bs58";

const collectionMint = "3zXYT4GmN8fuZ3USbHCsz3po5hnP9Nz2Vd2wxFWDvpgj";
const machineMint = "BpCXZdj8Bfi3ZQpKjnPNgkVKpCY8hRXYev5LcAbd3oTj";

const allowList = [
  "BaNS3Sx6MAg8QFu1yXi1Ftt5pjJPMR2vyrQHqaHwGL7r",
  "7UvSycMiBikyErLyCGrTcAECDrCwghikvD7PunVDh2DS",
  "G78qwbjfetiHGHhjKpPLxWrUq4eJqkLotS6CVQ2BQ2ZA",
  "85XUKZ77v3ADNw1QZeLhGSWi1gz1NwbnwqA8QDeQCeRf",
];

async function updateGuard(candyMachinePk: string) {
  console.log("updateGuard", candyMachinePk);
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);

  return await updateCandyGuard(umi, {
    candyGuard: candyGuard.publicKey,
    guards: {
      addressGate: some({ address: umi.identity.publicKey }),
    },
    groups: [
      // {
      //   label: "pre",
      //   guards: {
      //     allowList: some({ merkleRoot: getMerkleRoot(allowList) }),
      //   },
      // },
    ],
  }).sendAndConfirm(umi);
}

async function mint(umi: Umi, candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const nftMint = generateSigner(umi);
  const nft = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    // .add(
    //   route(umi, {
    //     candyMachine: publicKey(candyMachinePk),
    //     guard: "allowList",
    //     group: "pre",
    //     routeArgs: {
    //       path: "proof",
    //       merkleRoot: getMerkleRoot(allowList),
    //       merkleProof: getMerkleProof(
    //         allowList,
    //         umi.identity.publicKey.toString()
    //       ),
    //     },
    //   })
    // )
    .add(
      mintV2(umi, {
        candyMachine: candyMachine.publicKey,
        nftMint,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: mySigner.publicKey,
        tokenStandard: candyMachine.tokenStandard,
        // group: "pre",
        // mintArgs: {
        //   allowList: some({ merkleRoot: getMerkleRoot(allowList) }),
        // },
      })
    )
    .sendAndConfirm(umi);
  console.log(
    `     https://explorer.solana.com/tx/${base58.encode(
      nft.signature
    )}?cluster=${cluster}`
  );
}

async function insert() {
  const items = [
    {
      name: `100`,
      uri: `100.json`,
    },
    {
      name: `101`,
      uri: `101.json`,
    },
    {
      name: `102`,
      uri: `102.json`,
    },
  ];
  const rsp = await addConfigLines(umi, {
    candyMachine: publicKey(machineMint),
    index: 0,
    configLines: items,
  }).sendAndConfirm(umi);
  console.log(`✅ - Items added to Candy Machine: ${collectionMint}`);
  console.log(
    `     https://explorer.solana.com/tx/${base58.decode(
      rsp.signature.toString()
    )}?cluster=${cluster}`
  );
}

async function mint2(umi: Umi, candyMachinePk: string, mintTo: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const nftMint = generateSigner(umi);
  const nftOwner = publicKey(mintTo);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine: candyMachine.publicKey,
        mintAuthority: umi.identity,
        nftOwner,
        nftMint,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);
}
async function main() {
  // const adminMachine = await createMachine(collectionMint, mySigner, 350);
  // await updateGuard(machineMint);

  // await insert();

  // await insertItems(machineMint, 0, 350, 50, 0);

  const umi1 = createUmi(RPC).use(mplCandyMachine());
  const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret));
  console.log("keypair", keypair.publicKey.toString());
  const umiAcc = umi1.use(keypairIdentity(keypair));
  await mint(umiAcc, machineMint);
  // mint2(umiAcc, machineMint, "EniEGikEJEWpxrAfKVQaJ3xja7xTWPjfk1QXUNYK8g1p");
}
main();
