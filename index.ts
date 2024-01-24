import {
  DefaultGuardSet,
  fetchCandyGuard,
  fetchCandyMachine,
  findMintCounterPda,
  fetchMintCounter,
  fetchAllocationTracker,
  fetchAllMintCounter,
  findCandyGuardPda,
  findAllocationTrackerPda,
  getMerkleRoot,
  getMerkleProof,
  getSolPaymentSerializer,
  mintV2,
  route,
  updateCandyGuard,
  updateCandyMachine,
  getMerkleTree,
} from "@metaplex-foundation/mpl-candy-machine";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import { keccak_256 } from "@noble/hashes/sha3";
import {
  AccountNotFoundError,
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

import {
  RPC,
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
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey as W3Publickey,
} from "@solana/web3.js";

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
        },
      })
    )

    .sendAndConfirm(umi);
}

async function testMint() {
  const nft1 = await mintWL(umiAcc, candyMachinePk);
  console.log(base58.encode(nft1.signature));
}

async function getGuard(candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
  console.log(candyGuard);
  for (const g of candyGuard.groups) {
    console.log(g);
    for (const v of Object.values(g.guards)) {
      if (v.__option == "Some") {
        console.log(v.value);
      }
    }
  }
  return candyGuard;
}

const connection = new Connection(RPC);

async function checkEligible(
  label: string,
  pk: string,
  candyMachinePk: string,
  allowListWL?: any[]
) {
  const user = publicKey(pk);
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
  const g = candyGuard.groups.find((g) => g.label === label)!;

  //check allow list
  if (g.guards.allowList.__option === "Some") {
    if (!allowListWL) throw new Error("allowListWL required");
    const allowList = getMerkleTree(allowListWL);
    const validMerkleProof = getMerkleProof(allowListWL, user);
    const merkleRoot = getMerkleRoot(allowListWL);
    const isVerify = allowList.verify(
      validMerkleProof.map((e) => Buffer.from(e)),
      Buffer.from(keccak_256(pk)),
      Buffer.from(merkleRoot)
    );
    if (!isVerify) {
      throw new Error("Not in allowlist");
    }
  }

  // check item available
  console.log(
    `Item available: ${Number(candyMachine.itemsRedeemed)}/${
      candyMachine.itemsLoaded
    }`
  );
  if (candyMachine.itemsLoaded <= Number(candyMachine.itemsRedeemed)) {
    throw new Error("Sold out");
  }

  //check sol balance
  if (g.guards.solPayment.__option === "Some") {
    let balance = await connection.getBalance(new W3Publickey(pk));
    console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    const solPayment = Number(g.guards.solPayment.value.lamports.basisPoints);
    console.log(`Required: ${solPayment / LAMPORTS_PER_SOL} SOL`);
    if (balance < solPayment) {
      throw new Error("sol payment not enough");
    }
  }

  //check allocation
  if (g.guards.allocation.__option === "Some") {
    const pda = findAllocationTrackerPda(umi, {
      id: g.guards.allocation.value.id,
      candyGuard: candyGuard.publicKey,
      candyMachine: candyMachine.publicKey,
    });
    const { count } = await fetchAllocationTracker(umi, pda);
    console.log(`Allocation ${count}/${g.guards.allocation.value.limit}`);
    if (count >= g.guards.allocation.value.limit) {
      throw new Error("Allocation limit reached");
    }
  }

  //check mint limit
  if (g.guards.mintLimit.__option === "Some") {
    const counterPda = findMintCounterPda(umi, {
      id: g.guards.mintLimit.value.id,
      user,
      candyGuard: candyGuard.publicKey,
      candyMachine: candyMachinePublicKey,
    });
    try {
      const limit = g.guards.mintLimit.value.limit;
      const { count } = await fetchMintCounter(umi, counterPda);
      console.log(`MintLimit ${count}/${limit}`);
      if (count >= limit) throw new Error("Limit reached");
    } catch (error) {
      if (error instanceof AccountNotFoundError) {
      } else {
        throw error;
      }
    }
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

  await checkEligible(
    "wl",
    "7UvSycMiBikyErLyCGrTcAECDrCwghikvD7PunVDh2DS",
    candyMachinePk,
    allowListWL
  );
}

main();
