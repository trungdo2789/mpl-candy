import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  addConfigLines,
  create,
  createCandyMachine,
  fetchCandyGuard,
  fetchCandyMachine,
  getMerkleRoot,
  mintV2,
  mplCandyMachine,
  route,
  updateCandyGuard,
  updateCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  setComputeUnitLimit,
  createMintWithAssociatedToken,
} from "@metaplex-foundation/mpl-toolbox";
import {
  keypairIdentity,
  generateSigner,
  createSignerFromKeypair,
  percentAmount,
  none,
  some,
  publicKey,
  transactionBuilder,
  dateTime,
  sol,
  Umi,
} from "@metaplex-foundation/umi";
import {
  TokenStandard,
  createNft,
} from "@metaplex-foundation/mpl-token-metadata";

const candyMachinePk = "36LNd3XTJHS9gFs3kyBf9WraKQvFXaajmwsannucteyw";
const RPC = "https://api.devnet.solana.com";

import bs58 from "bs58";

import allowListPre from "./allowListPre";
import allowListWL from "./allowListWL";

import secret from "./secret.json";
import secret1 from "./secret1.json";
import { getMerkleProof } from "@metaplex-foundation/js";

// Use the RPC endpoint of your choice.
const umi1 = createUmi(RPC).use(mplCandyMachine());
const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret));
const umi = umi1.use(keypairIdentity(keypair));

const mySigner = createSignerFromKeypair(umi, keypair);

console.log("admin signer", mySigner.publicKey);

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
  console.log(`✅ - Minted Collection NFT: ${collection.signature.toString()}`);
  console.log(
    `     https://explorer.solana.com/address/${collection.signature.toString()}?cluster=devnet`
  );
  console.log(`Collection mint: ${collectionMint.publicKey.toString()}`);
  return collectionMint.publicKey;
}

async function createMachine(
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
}

async function insertItems(
  candyMachinePk: string,
  from: number,
  to: number,
  batch = 10
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
    const rsp = await addConfigLines(umi, {
      candyMachine: candyMachine.publicKey,
      index: i + from,
      configLines: sliceItem,
    }).sendAndConfirm(umi);
    console.log(`✅ - Items added to Candy Machine: ${candyMachinePk}`);
    console.log(
      `     https://explorer.solana.com/tx/${rsp.signature}?cluster=devnet`
    );
  }
}

/**
 * admin mint: no guard
 * @param collectionMint
 * @param candyMachinePk
 * @param mintTo
 * @returns
 */
async function mintDefault(umi: Umi, candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
  const nftMint = generateSigner(umi);
  return await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintV2(umi, {
        candyMachine: candyMachine.publicKey,
        nftMint,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: mySigner.publicKey,
        tokenStandard: candyMachine.tokenStandard,
        group: some("ad"),
        mintArgs: {
          allocation: { id: 11 },
        },
      })
    )
    .sendAndConfirm(umi);
}

async function candyMachineUpdate(candyMachinePk: string) {
  console.log("candyMachineUpdate", candyMachinePk);
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  await updateCandyMachine(umi, {
    candyMachine: candyMachine.publicKey,
    data: {
      ...candyMachine.data,
      hiddenSettings: none(),
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
      // {
      //   label: "ad",
      //   guards: {
      //     addressGate: some({ address: mySigner.publicKey }), //only admin
      //     allocation: some({
      //       id: 11,
      //       limit: 550,
      //     }),
      //   },
      // },
      {
        label: "pre",
        guards: {
          allocation: some({
            id: 12,
            limit: 1000,
          }),
          solPayment: some({
            lamports: sol(0.9),
            destination: mySigner.publicKey,
          }),
          mintLimit: some({ id: 13, limit: 1 }),
          // allowList: some({ merkleRoot: getMerkleRoot(allowListPre) }),
          botTax: some({
            lamports: sol(0.01),
            lastInstruction: true,
          }),
          // startDate: some({ date: dateTime("2022-10-18T16:00:00Z") }),
          // endDate: some({ date: dateTime("2022-10-18T17:00:00Z") }),
        },
      },
      {
        label: "wl",
        guards: {
          solPayment: some({
            lamports: sol(1.2),
            destination: mySigner.publicKey,
          }),
          allocation: some({
            id: 14,
            limit: 3500,
          }),
          mintLimit: some({ id: 15, limit: 2 }),
          // allowList: some({ merkleRoot: getMerkleRoot(allowListWL) }),
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
            lamports: sol(1.3),
            destination: mySigner.publicKey,
          }),
          mintLimit: some({ id: 16, limit: 2 }),
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

async function init() {
  console.log("init");
  // await route(umi, {
  //   candyMachine: publicKey(candyMachinePk),
  //   guard: "allocation",
  //   routeArgs: {
  //     id: 11,
  //     candyGuardAuthority: umi.identity,
  //   },
  //   group: some("ad"),
  // }).sendAndConfirm(umi);

  await route(umi, {
    candyMachine: publicKey(candyMachinePk),
    guard: "allocation",
    routeArgs: {
      id: 12,
      candyGuardAuthority: umi.identity,
    },
    group: some("pre"),
  }).sendAndConfirm(umi);

  await route(umi, {
    candyMachine: publicKey(candyMachinePk),
    guard: "allocation",
    routeArgs: {
      id: 14,
      candyGuardAuthority: umi.identity,
    },
    group: some("wl"),
  }).sendAndConfirm(umi);
}

async function mintPre(umiacc: Umi, candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  console.log("umi identity", umiacc.identity.publicKey.toString());
  const candyMachine = await fetchCandyMachine(umiacc, candyMachinePublicKey);
  const nftMint = generateSigner(umiacc);

  return await transactionBuilder()
    .add(setComputeUnitLimit(umiacc, { units: 800_000 }))
    // .add(
    //   route(umiacc, {
    //     candyMachine: publicKey(candyMachinePk),
    //     guard: "allowList",
    //     group: some("pre"),
    //     routeArgs: {
    //       path: "proof",
    //       merkleRoot: getMerkleRoot(allowListPre),
    //       merkleProof: getMerkleProof(
    //         allowListPre,
    //         umiacc.identity.publicKey.toString()
    //       ),
    //     },
    //   })
    // )
    .add(
      mintV2(umiacc, {
        candyMachine: candyMachine.publicKey,
        nftMint,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: mySigner.publicKey,
        tokenStandard: candyMachine.tokenStandard,
        group: some("pre"),
        mintArgs: {
          allocation: some({
            id: 12,
            limit: 1000,
          }),
          solPayment: some({
            lamports: sol(0.9),
            destination: mySigner.publicKey,
          }),
          mintLimit: some({ id: 13, limit: 1 }),
          // allowList: some({ merkleRoot: getMerkleRoot(allowListPre) }),
          botTax: some({
            lamports: sol(0.01),
            lastInstruction: true,
          }),
        },
      })
    )

    .sendAndConfirm(umiacc);
}

async function mintWL(umi: Umi, candyMachinePk: string) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  console.log("umi identity", umi.identity.publicKey.toString());
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const nftMint = generateSigner(umi);

  return await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    // .add(
    //   route(umi, {
    //     candyMachine: publicKey(candyMachinePk),
    //     guard: "allowList",
    //     group: some("wl"),
    //     routeArgs: {
    //       path: "proof",
    //       merkleRoot: getMerkleRoot(allowListWL),
    //       merkleProof: getMerkleProof(
    //         allowListWL,
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
          // allowList: some({ merkleRoot: getMerkleRoot(allowListWL) }),
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
  console.log("testMintPre");
  const umi1 = createUmi(RPC).use(mplCandyMachine());
  const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret1));
  console.log("keypair", keypair.publicKey.toString());

  const umiAcc = umi1.use(keypairIdentity(keypair));

  const nft = await mintPre(umiAcc, candyMachinePk);
  console.log("nft", bs58.encode(Buffer.from(nft.signature)));

  const nft1 = await mintWL(umiAcc, candyMachinePk);
  console.log("nft1", bs58.encode(Buffer.from(nft1.signature)));
}

async function testMintDefault() {
  const umi1 = createUmi(RPC).use(mplCandyMachine());
  const keypair = umi1.eddsa.createKeypairFromSecretKey(Buffer.from(secret1));
  console.log("keypair", keypair.publicKey.toString());
  const umiAccount2 = umi1.use(keypairIdentity(keypair));

  //admin mint
  const nft = await mintDefault(umi, candyMachinePk);
  console.log("nft", nft);

  //not admin mint
  const nft1 = await mintDefault(umiAccount2, candyMachinePk);
  console.log("nft1", nft1);
}

async function testAllowList() {
  const rs = await route(umi, {
    candyMachine: publicKey(candyMachinePk),
    guard: "allowList",
    group: some("pre"),
    routeArgs: {
      path: "proof",
      merkleRoot: getMerkleRoot(allowListPre),
      merkleProof: getMerkleProof(allowListPre, publicKey(umi.identity)),
    },
  }).sendAndConfirm(umi);
}

async function getGuard() {
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
  // await createMachine(
  //   "3zXYT4GmN8fuZ3USbHCsz3po5hnP9Nz2Vd2wxFWDvpgj",
  //   mySigner.publicKey,
  //   5050
  // );
  // await insertItems(
  //   candyMachinePk,
  //   0,
  //   5050,
  //   50
  // );
  // await candyMachineUpdate(candyMachinePk);
  // await updateGuard(candyMachinePk);
  // await init();
  // await getGuard();

  await testMint();
  // await testMintDefault();
}

main();
