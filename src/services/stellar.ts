import { logger } from '../utils/logger'
import { Server } from 'stellar-sdk';

const server = new Server(process.env.HORIZON as string);

export async function loadAccount(account: string) {
  try {
    const result = await server.loadAccount(account);
    logger.info('account: ', result);
    return result;
  } catch (err) {
    logger.info(err);
    return null;
  }
}
