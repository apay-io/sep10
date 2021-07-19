import setup from '../setup'
import challenge from '../../src/api/challenge';
import token from '../../src/api/token';

setup({ worker: 'sep10', routes: [challenge, token] })
