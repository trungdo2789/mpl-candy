import {
  Umi,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import { RPC, insertItems, mySigner, umi } from "./index";
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
} from "@metaplex-foundation/mpl-candy-machine";
import {
  setComputeUnitLimit,
  createMintWithAssociatedToken,
} from "@metaplex-foundation/mpl-toolbox";
import secret1 from "./secret1.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";

const collectionMint = "3zXYT4GmN8fuZ3USbHCsz3po5hnP9Nz2Vd2wxFWDvpgj";
const machineMint = "68ViXqM45iLVtDatAARztL4vkRhu7u7ETXju6NoePQLM";

const allowList = [
  "BaNS3Sx6MAg8QFu1yXi1Ftt5pjJPMR2vyrQHqaHwGL7r",
  "7UvSycMiBikyErLyCGrTcAECDrCwghikvD7PunVDh2DS",
  "G78qwbjfetiHGHhjKpPLxWrUq4eJqkLotS6CVQ2BQ2ZA",
  "85XUKZ77v3ADNw1QZeLhGSWi1gz1NwbnwqA8QDeQCeRf",
];

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
        prefixName: "CHIPZ #",
        nameLength: 4,
        symbol: "CHIPZ",
        prefixUri:
          "https://bafybeifpyhhx4tufmzikpyty3dvi4veh5xgx4zk47iago524b4h45oxoke.ipfs.nftstorage.link/",
        uriLength: 9,
        isSequential: false,
      }),
    })
  ).sendAndConfirm(umi);
  console.log(
    `✅ - Created Candy Machine: ${candyMachine.publicKey.toString()}`
  );
}

async function updateGuard(candyMachinePk: string) {
  console.log("updateGuard", candyMachinePk);
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);

  return await updateCandyGuard(umi, {
    candyGuard: candyGuard.publicKey,
    guards: {},
    groups: [
      {
        label: "pre",
        guards: {
          allowList: some({ merkleRoot: getMerkleRoot(allowList) }),
        },
      },
    ],
  }).sendAndConfirm(umi);
}

async function mint(umi: Umi, candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const nftMint = generateSigner(umi);
  return await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      route(umi, {
        candyMachine: publicKey(candyMachinePk),
        guard: "allowList",
        group: "pre",
        routeArgs: {
          path: "proof",
          merkleRoot: getMerkleRoot(allowList),
          merkleProof: getMerkleProof(
            allowList,
            umi.identity.publicKey.toString()
          ),
        },
      })
    )
    .add(
      mintV2(umi, {
        candyMachine: candyMachine.publicKey,
        nftMint,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: mySigner.publicKey,
        tokenStandard: candyMachine.tokenStandard,
        group: "pre",
        mintArgs: {
          allowList: some({ merkleRoot: getMerkleRoot(allowList) }),
        },
      })
    )
    .sendAndConfirm(umi);
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
    `     https://explorer.solana.com/tx/${rsp.signature}?cluster=devnet`
  );
}

async function main() {
  // const adminMachine = await createMachine(collectionMint, mySigner, 3);
  // await updateGuard(machineMint);

  // await insert();

  const umi1 = createUmi(RPC).use(mplCandyMachine());
  const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret1));
  console.log("keypair", keypair.publicKey.toString());
  const umiAcc = umi1.use(keypairIdentity(keypair));
  await mint(umiAcc, machineMint);
}
main();
