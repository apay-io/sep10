import { Handler, Route } from '../@types/http'
import { logger } from '../utils/logger'
import { UnknownError, UserInputError } from '../utils/http'
import { Keypair, Transaction, Utils } from 'stellar-sdk';
// @ts-ignore
import { SignJWT } from 'jose';
import { loadAccount } from '../services/stellar';

const handler: Handler = async function ({ body }) {
  logger.info('Token', body)

  const { transaction } = body as any;
  const homeDomain = process.env.HOMEDOMAIN as string;
  const networkPassphrase = process.env.NETWORK as string;
  // if (!(new Transaction(transaction, networkPassphrase))) {
  //   throw new UserInputError('Invalid transaction payload', { transaction });
  // }
  const keypair = Keypair.fromSecret(process.env.SIGNING_SECRET as string);
  const signingKey = keypair.publicKey();
  const { clientAccountID } = Utils.readChallengeTx(
    transaction,
    signingKey,
    networkPassphrase,
    homeDomain,
    'sep10.apay.workers.dev',
  );
  logger.info(clientAccountID);
  try {
    const userAccount = await loadAccount(clientAccountID);
    logger.info(JSON.stringify(userAccount));
    if (userAccount) {
      Utils.verifyChallengeTxThreshold(
        transaction,
        signingKey,
        networkPassphrase,
        userAccount.thresholds.med_threshold,
        userAccount.signers,
        homeDomain,
        'sep10.apay.workers.dev',
      );
    } else {
      Utils.verifyChallengeTxSigners(
        transaction,
        signingKey,
        networkPassphrase,
        [clientAccountID],
        homeDomain,
        'sep10.apay.workers.dev',
      );
    }
  } catch (error) {
    logger.error(error.stack);
    throw new UserInputError(error.stack);
  }
  const payload = {
    sub: clientAccountID,
  };
  try {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(homeDomain)
      .setExpirationTime('20m')
      .sign(new Uint8Array(Buffer.from(process.env.JWT_SECRET as string)));
    return {
      data: {
        token,
      }
    };
  } catch (error) {
    logger.error(error.stack);
    throw new UnknownError(error.stack);
  }

}

export default ['POST', '/', handler] as Route
