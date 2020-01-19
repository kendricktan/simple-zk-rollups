import { multiHash, genPrivateKey, genPublicKey } from '../crypto'
import { bigInt } from 'snarkjs'

describe('crypto.ts', () => {
    it('Hashing', () => {
        multiHash([bigInt(0)])
    })

    it('Public Key Generation', () => {
        const privateKey = genPrivateKey()
        genPublicKey(privateKey)
    })
})