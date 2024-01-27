import {
  ConfirmedSignatureInfo,
  Connection,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import { RPC } from "./common";
const connection = new Connection(RPC);

/**
 *  array limit process
 * @param array
 * @param callBack
 * @param limit default 100
 * @returns
 */
export const arraySliceProcess = async <T>(
  array: T[],
  callBack: (value: T[]) => Promise<any>,
  limit = 100
) => {
  if (array.length === 0) return;
  for (let i = 0; i < array.length; i += limit) {
    const arrayToProcess = array.slice(i, i + limit);
    await callBack(arrayToProcess);
  }
};

async function retry(fn: () => Promise<any>, retries = 5) {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0) {
      return await retry(fn, retries - 1);
    } else {
      throw e;
    }
  }
}

async function parseTransfer(sig: ConfirmedSignatureInfo) {
  const transaction: ParsedTransactionWithMeta = await retry(
    async () =>
      await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      })
  );
  const rs: {
    signature: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
  }[] = [];
  if (transaction && transaction.meta && !transaction.meta.err) {
    for (const instruction of transaction.transaction.message.instructions) {
      if ("parsed" in instruction && instruction.program === "system") {
        if (instruction.parsed.type === "transfer") {
          const fromAddress = instruction.parsed.info.source;
          const toAddress = instruction.parsed.info.destination;
          const amount = instruction.parsed.info.lamports / LAMPORTS_PER_SOL; // Convert lamports to SOL

          console.log(`Transfer from: ${fromAddress}`);
          console.log(`Transfer to: ${toAddress}`);
          console.log(`Amount: ${amount} SOL`);

          rs.push({
            signature: sig.signature,
            fromAddress,
            toAddress,
            amount,
          });
        }
      }
    }
  } else {
    console.log("Transaction not found or failed");
  }
  return rs;
}

async function parseSignatures(
  signatures: ConfirmedSignatureInfo[],
  concurrent = 10
) {
  const rs: {
    signature: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
  }[] = [];
  await arraySliceProcess(
    signatures,
    async (arr) => {
      const txParsed = await Promise.all(
        arr.map(async (sig) => await parseTransfer(sig))
      );
      rs.push(...txParsed.flat());
    },
    concurrent
  );
  return rs;
}

async function getTransferTx(address: string, limit = 100, before?: string) {
  const pk = new PublicKey(address);
  if (limit > 1000) {
    limit = 1000;
  }
  const signatures = await connection.getSignaturesForAddress(pk, {
    limit,
    before,
  });
  return signatures;
}

/**
 *
 * @param address
 * @param concurrent default 10: 10 concurrent requests
 * @param timeFrom timestamp in ms. time when you want to start get tx, for example: time begin season
 */
async function getAllTx(address: string, concurrent = 10, timeFrom = 0) {
  let done = false;
  const limit = 100;
  let before: string | undefined = undefined;
  const parsedTxs = [];
  while (!done) {
    const txs = await getTransferTx(address, limit, before);

    if (txs.length < limit) {
      done = true;
    } else {
      before = txs[txs.length - 1].signature;
    }
    if (Number(txs[0].blockTime) * 1000 < timeFrom) return parsedTxs;
    const rs = await parseSignatures(txs, concurrent);
    parsedTxs.push(...rs);
  }
  return parsedTxs;
}

async function main() {
  const address = "BaNS3Sx6MAg8QFu1yXi1Ftt5pjJPMR2vyrQHqaHwGL7r";
  const rs = await getAllTx(address, 5, 1706288400000); // 2024 01 27 00:00:00
  console.log(rs);
}
main();
