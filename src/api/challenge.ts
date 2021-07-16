import { Handler, Route } from '../@types/http'
import { logger } from '../utils/logger'
import { UnknownError, UserInputError } from '../utils/http'
import { Keypair, StrKey, Utils } from 'stellar-sdk';

const handler: Handler = async function ({ query }) {
  logger.info('Challenge', query)

  const account = query.get('account') as string;

  if (!account) {
    throw new UserInputError('Account is required')
  }
  if (!StrKey.isValidEd25519PublicKey(account)) {
    throw new UserInputError('Account is invalid', { account })
  }

  const networkPassphrase = process.env.NETWORK as string;

  try {
    return {
      data: {
        transaction: Utils.buildChallengeTx(
          Keypair.fromSecret(process.env.SIGNING_SECRET as string),
          account,
          'apay.io',
          86400,
          networkPassphrase,
          'sep10.apay.workers.dev',
        ),
        network_passphrase: networkPassphrase,
      },
    }
  } catch (err) {
    logger.error(err);
    throw new UnknownError('Unknown error', { error: err.message, stack: err.stack });
  }
}

export default ['GET', '/challenge', handler] as Route
