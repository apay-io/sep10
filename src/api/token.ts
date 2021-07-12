import { Handler, Route } from '../@types/http'
import { logger } from '../utils/logger'
import { UserInputError } from '../utils/http'
import { Keypair, Transaction, Utils } from 'stellar-sdk';
import { loadAccount } from '../services/stellar';
import { SignJWT } from 'jose-node-esm-runtime/jwt/sign'

const handler: Handler = async function ({ body }) {
  logger.info('Token', body)

  const { transaction } = body as any;
  const networkPassphrase = process.env.NETWORK as string;

  if (!(new Transaction(transaction, networkPassphrase))) {
    throw new UserInputError('Invalid transaction payload', { transaction });
  }
  const keypair = Keypair.fromSecret(process.env.SIGNING_SECRET as string);
  const signingKey = keypair.publicKey();
  const { clientAccountID } = Utils.readChallengeTx(
    transaction,
    signingKey,
    networkPassphrase,
    'apay,io',
    'sep10.apay.workers.dev',
  );
  try {
    const userAccount = await loadAccount(clientAccountID);
    Utils.verifyChallengeTxThreshold(
      transaction,
      signingKey,
      networkPassphrase,
      userAccount.thresholds.med_threshold,
      userAccount.signers,
      'apay,io',
      'sep10.apay.workers.dev',
    );
  } catch (err) {
    if (err.name === 'NotFoundError') {
      try {
        Utils.verifyChallengeTxSigners(
          transaction,
          signingKey,
          networkPassphrase,
          [clientAccountID],
          'apay,io',
          'sep10.apay.workers.dev',
        );
      } catch (error) {
        logger.error(err);
        throw new UserInputError(error);
      }
    } else {
      throw new UserInputError(err);
    }
  }
  const payload = {
    sub: clientAccountID,
  };
  return {
    data: {
      token: await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('apay.io')
        .setExpirationTime('20m')
        .sign(new Uint8Array(Buffer.from(process.env.JWT_SECRET as string))),
    }
  };
}

export default ['POST', '/token', handler] as Route
