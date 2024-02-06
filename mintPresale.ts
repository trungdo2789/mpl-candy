import {
  fetchCandyGuard,
  fetchCandyMachine,
  getMerkleRoot,
  mintV2,
  route,
  updateCandyGuard,
  updateCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  createMintWithAssociatedToken,
  setComputeUnitLimit,
} from "@metaplex-foundation/mpl-toolbox";
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

import preSaleList from "./preSaleList.json";

import bs58 from "bs58";
import { candyMachinePk, cluster, mySigner, umi } from "./common";
import base58 from "bs58";
import {
  TokenStandard,
  delegateStandardV1,
  lockV1,
  transferV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { PrismaClient } from "@prisma/client";
import winston from "winston";
const { combine, timestamp, label, printf } = winston.format;
const prisma = new PrismaClient();

const logFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = winston.createLogger({
  level: "info",
  format: combine(label({ label: "presale" }), timestamp(), logFormat),
  defaultMeta: { service: "mint-presale" },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "log/error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "log/combined.log" }),
  ],
});

async function mintPre(
  umiacc: Umi,
  candyMachinePk: string,
  newOwner: PublicKey
) {
  const candyMachinePublicKey = publicKey(candyMachinePk);
  const candyMachine = await fetchCandyMachine(umiacc, candyMachinePublicKey);
  const nftMint = generateSigner(umiacc);

  const tx = await transactionBuilder()
    .add(setComputeUnitLimit(umiacc, { units: 800_000 }))
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
            id: 1,
            limit: 2000,
          }),
          addressGate: some({ address: umi.identity.publicKey }),
          // allowList: some({ merkleRoot: getMerkleRoot(allowListPre) }),
        },
      })
    )
    .add(
      transferV1(umiacc, {
        mint: nftMint.publicKey,
        authority: umiacc.identity,
        tokenOwner: umiacc.identity.publicKey,
        destinationOwner: newOwner,
        tokenStandard: TokenStandard.NonFungible,
      })
    )
    .sendAndConfirm(umiacc);

  logger.info(`✅ - Minted NFT: ${nftMint.publicKey}`);
  logger.info(
    `     https://explorer.solana.com/tx/${base58.encode(
      tx.signature
    )}?cluster=${cluster}`
  );
  return { nftMint, txMint: base58.encode(tx.signature) };
}

async function mintAndTransfer() {
  for (const sale of preSaleList) {
    const minted = await prisma.tx.count({
      where: {
        mintTo: sale.address,
      },
    });
    const needMint = sale.amount - minted;
    if (!needMint) {
      logger.info(`Sale address ${sale.address} no need mint, skip...`);
      continue;
    }
    for (let i = 0; i < needMint; i++) {
      logger.info(
        `address ${sale.address}, minting: ${minted + i + 1}/${sale.amount}`
      );
      const { nftMint, txMint } = await mintPre(
        umi,
        candyMachinePk,
        publicKey(sale.address)
      );
      await prisma.tx.create({
        data: {
          mint: nftMint.publicKey.toString(),
          txMint,
          mintTo: sale.address,
        },
      });
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  let done = false;
  while (!done) {
    try {
      await mintAndTransfer();
      done = true;
    } catch (error) {
      logger.error(error);
    }
  }
}

main()
  .then(() => {
    logger.debug("done!");
  })
  .catch(logger.error);
