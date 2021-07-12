import setup from '../setup'
import challenge from '../../src/api/challenge';

setup({ worker: 'sep10', routes: [challenge] })
