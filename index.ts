import {
  fetchCandyGuard,
  fetchCandyMachine,
  getMerkleRoot,
  mintV2,
  route,
  updateCandyGuard,
  updateCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import {
  KeypairSigner,
  PublicKey,
  Signer,
  Umi,
  generateSigner,
  none,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from "@metaplex-foundation/umi";

import bs58 from "bs58";

import allowListPre from "./allowListPre.json";
import allowListWL from "./allowListWL.json";

import { getMerkleProof } from "@metaplex-foundation/js";
import {
  candyMachinePk,
  cluster,
  collectionMint,
  createMachine,
  insertItems,
  mySigner,
  treasury,
  umi,
  umiAcc,
} from "./common";
import base58 from "bs58";
import {
  TokenStandard,
  transferV1,
} from "@metaplex-foundation/mpl-token-metadata";

async function candyMachineUpdate(candyMachinePk: string) {
  console.log("candyMachineUpdate", candyMachinePk);
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  await updateCandyMachine(umi, {
    candyMachine: candyMachine.publicKey,
    data: {
      ...candyMachine.data,
      hiddenSettings: none(),
      symbol: "CHIPZ",
      configLineSettings: some({
        prefixName: "CHIPZ #$ID+1$",
        nameLength: 0,
        symbol: "CHIPZ",
        prefixUri:
          "https://bafybeifpyhhx4tufmzikpyty3dvi4veh5xgx4zk47iago524b4h45oxoke.ipfs.nftstorage.link/$ID+1$.json",
        uriLength: 0,
        isSequential: false,
      }),
    },
  }).sendAndConfirm(umi);
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
          allocation: some({
            id: 1,
            limit: 2000,
          }),
          addressGate: some({ address: umi.identity.publicKey }),
        },
      },
      {
        label: "wl",
        guards: {
          solPayment: some({
            lamports: sol(1.1),
            destination: publicKey(treasury),
          }),
          allocation: some({
            id: 2,
            limit: 2700,
          }),
          mintLimit: some({ id: 3, limit: 2 }),
          allowList: some({ merkleRoot: getMerkleRoot(allowListWL) }),
          botTax: some({
            lamports: sol(0.01),
            lastInstruction: true,
          }),
          // startDate: some({ date: dateTime("2022-10-18T17:00:00Z") }),
        },
      },
      {
        label: "pl",
        guards: {
          solPayment: some({
            lamports: sol(1.2),
            destination: publicKey(treasury),
          }),
          mintLimit: some({ id: 4, limit: 2 }),
          botTax: some({
            lamports: sol(0.01),
            lastInstruction: true,
          }),
          // startDate: some({ date: dateTime("2022-10-18T17:00:00Z") }),
        },
      },
    ],
  }).sendAndConfirm(umi);
}

async function init(candyMachinePk: string) {
  console.log("init");
  await route(umi, {
    candyMachine: publicKey(candyMachinePk),
    guard: "allocation",
    routeArgs: {
      id: 1,
      candyGuardAuthority: umi.identity,
    },
    group: some("pre"),
  }).sendAndConfirm(umi);
  await route(umi, {
    candyMachine: publicKey(candyMachinePk),
    guard: "allocation",
    routeArgs: {
      id: 2,
      candyGuardAuthority: umi.identity,
    },
    group: some("wl"),
  }).sendAndConfirm(umi);
}

async function mintWL(umi: Umi, candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  console.log("umi identity", umi.identity.publicKey.toString());
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const nftMint = generateSigner(umi);

  return await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      route(umi, {
        candyMachine: publicKey(candyMachinePk),
        guard: "allowList",
        group: some("wl"),
        routeArgs: {
          path: "proof",
          merkleRoot: getMerkleRoot(allowListWL),
          merkleProof: getMerkleProof(
            allowListWL,
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
        group: some("wl"),
        mintArgs: {
          solPayment: some({
            lamports: sol(1.2),
            destination: mySigner.publicKey,
          }),
          allocation: some({
            id: 14,
            limit: 3500,
          }),
          mintLimit: some({ id: 15, limit: 2 }),
          allowList: some({ merkleRoot: getMerkleRoot(allowListWL) }),
          botTax: some({
            lamports: sol(0.01),
            lastInstruction: true,
          }),
        },
      })
    )

    .sendAndConfirm(umi);
}

async function testMint() {
  const nft1 = await mintWL(umiAcc, candyMachinePk);
}

async function getGuard(candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
  console.log(candyGuard);
  for (const g of candyGuard.groups) {
    console.log(g);
  }
}

// collectionMint 3zXYT4GmN8fuZ3USbHCsz3po5hnP9Nz2Vd2wxFWDvpgj
// candy machine: 36LNd3XTJHS9gFs3kyBf9WraKQvFXaajmwsannucteyw
async function main() {
  // const collectionMint = await createCollection();
  // const machine = await createMachine(collectionMint, mySigner.publicKey, 4700);
  // await insertItems(candyMachinePk, 350, 5050, 50, 0);
  // await candyMachineUpdate(candyMachinePk);
  // await updateGuard(candyMachinePk);
  // await getGuard(candyMachinePk);
  // await init(candyMachinePk);
  // await testMint();
  // await mintPreAndTransfer(
  //   umi,
  //   candyMachinePk,
  //   publicKey("EniEGikEJEWpxrAfKVQaJ3xja7xTWPjfk1QXUNYK8g1p")
  // );
}

main();
