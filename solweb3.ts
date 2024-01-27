import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { RPC } from "./common";
const connection = new Connection(RPC);

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

async function getTransferTx(address: string, limit = 100, before?: string) {
  const pk = new PublicKey("BaNS3Sx6MAg8QFu1yXi1Ftt5pjJPMR2vyrQHqaHwGL7r");
  if (limit > 1000) {
    limit = 1000;
  }
  const signatures = await connection.getSignaturesForAddress(pk, {
    limit,
    before,
  });
  const rs = [];

  for (const sig of signatures) {
    const transaction = await retry(
      async () =>
        await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        })
    );
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
  }
  return { txs: signatures, rs };
}

async function getAllTx(address: string) {
  let done = false;
  const limit = 100;
  let before: string | undefined = undefined;
  const parsedTxs = [];
  while (!done) {
    const { txs, rs } = await getTransferTx(address, limit, before);
    parsedTxs.push(...rs);
    if (txs.length < limit) {
      done = true;
    } else {
      before = txs[txs.length - 1].signature;
    }
  }
  return parsedTxs;
}

async function main() {
  const address = "BaNS3Sx6MAg8QFu1yXi1Ftt5pjJPMR2vyrQHqaHwGL7r";
  const rs = await getAllTx(address);
  console.log(rs);
}
main();
