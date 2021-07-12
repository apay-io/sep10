import { logger } from '../utils/logger'
import { Server } from 'stellar-sdk';

const server = new Server(process.env.HORIZON as string);

export async function loadAccount(account: string) {
  return server.loadAccount(account).then(res => {
    logger.info('account: ', res);
    return res;
  });
}
