import {
  Umi,
  generateSigner,
  keypairIdentity,
  publicKey,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import { RPC, createMachine, insertItems, mySigner, umi } from "./index";
import {
  updateCandyGuard,
  fetchCandyGuard,
  fetchCandyMachine,
  getMerkleRoot,
  mintV2,
  route,
  getMerkleProof,
  mplCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  setComputeUnitLimit,
  createMintWithAssociatedToken,
} from "@metaplex-foundation/mpl-toolbox";
import secret1 from "./secret1.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

const collectionMint = "3zXYT4GmN8fuZ3USbHCsz3po5hnP9Nz2Vd2wxFWDvpgj";
const machineMint = "9SvenJghCKiYc1JvcPbCkeN6eKQGucuvQK9FouaSgYb7";

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
async function main() {
  // const adminMachine = await createMachine(collectionMint, mySigner, 550);
  // await insertItems(machineMint, 0, 550, 50);
  // await updateGuard(machineMint);

  const umi1 = createUmi(RPC).use(mplCandyMachine());
  const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret1));
  console.log("keypair", keypair.publicKey.toString());
  const umiAcc = umi1.use(keypairIdentity(keypair));
  await mint(umiAcc, machineMint);
}
main();
