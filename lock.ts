import {
  TokenStandard,
  delegateAuthorityItemV1,
  delegateStandardV1,
  lockV1,
  revokeStandardV1,
  unlockV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { mySigner, umi, umiAcc } from "./common";
import { publicKey } from "@metaplex-foundation/umi";

async function main() {
  const mint = publicKey("HUkeEHCjrF3MZWhYSwnCd3vFLZriP61TASNzVM11gTQL");

  // await delegateStandardV1(umiAcc, {
  //   mint,
  //   tokenOwner: umiAcc.identity.publicKey,
  //   authority: umiAcc.identity,
  //   delegate: umi.identity.publicKey,
  //   tokenStandard: TokenStandard.NonFungible,
  // }).sendAndConfirm(umiAcc);

  await lockV1(umi, {
    mint,
    tokenOwner: publicKey("9V8p9vgV7CEDsMz7nEgmVAGshrocbF7K3bmcbYGbYmaK"),
    authority: umi.identity,
    tokenStandard: TokenStandard.NonFungible,
  }).sendAndConfirm(umi);

  // await unlockV1(umi, {
  //   mint,
  //   tokenOwner: umiAcc.identity.publicKey,
  //   authority: umi.identity,
  //   tokenStandard: TokenStandard.NonFungible,
  // }).sendAndConfirm(umi);

  // await revokeStandardV1(umi, {
  //   mint,
  //   tokenOwner: umiAcc.identity.publicKey,
  //   authority: umi.identity,
  //   delegate: umi.identity.publicKey,
  //   tokenStandard: TokenStandard.NonFungible,
  // }).sendAndConfirm(umi);
}
main();
