// Copyright (c) 2018-2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { LedgerDevice, Address, Crypto } from 'turtlecoin-utils';
import { describe, it, before } from 'mocha';
import { TCPTransport } from './TCPTransport';
import Transport from '@ledgerhq/hw-transport';
import * as assert from 'assert';

/**
 * This set of tests is designed to test the application and thus the crypto operations
 * provided by the TurtleCoin application running on a Ledger hardware device against
 * the TurtleCoin Crypto library that is a known working package for the same underlying
 * functions. As the TurtleCoin Crypto library is used throughout numerous wallets including
 * the GUI wallet & mobile wallet, testing against the results provided by that library
 * via that library gives us a set of known good results that we should expect to return
 * from the ledger device regardless of any random scalars used and/or created during
 * many of the stealth operations inherent to the CryptoNote protocol
 */

describe('Ledger Hardware Tests', function () {
    this.timeout(30000);

    /**
     * This is the known wallet seed that is generated based upon the 24 word word
     * mnemonic that is provided to Speculos upon launching the TurtleCoin ledger
     * application for testing purposes. This is revealed such that we can use the
     * TurtleCoin Crypto library to perform our checks using the exact same set
     * of wallet keys
     */
    const walletSeed = '74e4ac6f5a858c4161593a90d2f6f22d3a57195a89e75d10500d68db3c68c70f';

    const ledgerIdent = '547572746c65436f696e206973206e6f742061204d6f6e65726f20666f726b21';

    let ledger: LedgerDevice;
    let transport: Transport;
    let Wallet: Address;

    const TurtleCoinCrypto = new Crypto();

    before(async () => {
        transport = await TCPTransport.open('127.0.0.1:9999');

        ledger = new LedgerDevice(transport);

        Wallet = await Address.fromSeed(walletSeed);
    });

    after(async () => {
        if (transport) {
            await transport.close();
        }
    });

    describe('General Functions', () => {
        it('Version', async () => {
            return ledger.getVersion();
        });

        it('Ident', async () => {
            const result = await ledger.getIdent();

            assert(result === ledgerIdent);
        });

        it('Is Debug?', async () => {
            assert(await ledger.isDebug());
        });
    });

    describe('Key Fundamentals', () => {
        it('Generate Random Key Pair', async () => {
            const keys = await ledger.getRandomKeyPair();

            assert(await TurtleCoinCrypto.checkKey(keys.public) &&
                await TurtleCoinCrypto.checkScalar(keys.private));
        });

        it('Private Key to Public Key', async () => {
            const keys = await TurtleCoinCrypto.generateKeys();

            const pub = await ledger.privateToPublic(keys.privateKey);

            assert(pub === keys.publicKey);
        });

        it('Private Key to Public Key: Supplying public key fails', async () => {
            const keys = await TurtleCoinCrypto.generateKeys();

            await ledger.privateToPublic(keys.publicKey)
                .then(() => assert(false))
                .catch(() => assert(true));
        });

        it('Get Public Keys', async () => {
            const keys = await ledger.getPublicKeys(false);

            assert(keys.spend === Wallet.spend.publicKey && keys.view === Wallet.view.publicKey);
        });

        it('Get Private Spend Key', async () => {
            const key = await ledger.getPrivateSpendKey(false);

            assert(key === Wallet.spend.privateKey);
        });

        it('Get Private View Key', async () => {
            const key = await ledger.getPrivateViewKey(false);

            assert(key === Wallet.view.privateKey);
        });

        it('Get Wallet Address', async () => {
            const address = await ledger.getAddress(false);

            assert(address === await Wallet.address());
        });

        it('Check Key', async () => {
            assert(await ledger.checkKey(Wallet.spend.publicKey));
        });

        it('Check Key: Fails on non-point', async () => {
            assert(!await ledger.checkKey(Wallet.spend.privateKey));
        });

        it('Check Scalar', async () => {
            assert(await ledger.checkScalar(Wallet.spend.privateKey));
        });

        it('Check Scalar: Fails on non-scalar', async () => {
            assert(!await ledger.checkScalar(Wallet.spend.publicKey));
        });

        it('Reset Keys', async () => {
            return ledger.resetKeys(false);
        });
    });

    describe('Signing Fundamentals', () => {
        let message_digest: string;

        before(async () => {
            message_digest = await TurtleCoinCrypto.cn_fast_hash(ledgerIdent);
        });

        it('Generate Signature', async () => {
            const signature = await ledger.generateSignature(message_digest, false);

            assert(await TurtleCoinCrypto.checkSignature(message_digest, Wallet.spend.publicKey, signature));
        });

        it('Check Signature', async () => {
            const signature = await TurtleCoinCrypto.generateSignature(
                message_digest, Wallet.spend.publicKey, Wallet.spend.privateKey);

            assert(await ledger.checkSignature(message_digest, Wallet.spend.publicKey, signature));
        });

        it('Check Signature: Supplying private key fails', async () => {
            const signature = await TurtleCoinCrypto.generateSignature(
                message_digest, Wallet.spend.publicKey, Wallet.spend.privateKey);

            await ledger.checkSignature(message_digest, Wallet.spend.privateKey, signature)
                .then(() => assert(false))
                .catch(() => assert(true));
        });

        it('Check Signature: Supplying invalid signature fails', async () => {
            const signature = await TurtleCoinCrypto.generateSignature(
                message_digest, Wallet.spend.publicKey, Wallet.spend.privateKey);

            await ledger.checkSignature(message_digest, Wallet.spend.publicKey, signature.split('').reverse().join(''))
                .then(() => assert(false))
                .catch(() => assert(true));
        });
    });

    describe('Stealth Operations', () => {
        let ready = false;
        const output_index = 2;

        let tx_public_key: string;
        let expected_derivation: string;
        let expected_publicEphemeral: string;
        let expected_privateEphemeral: string;
        let expected_key_image: string;

        before(async () => {
            tx_public_key = (await TurtleCoinCrypto.generateKeys()).publicKey;

            expected_derivation = await TurtleCoinCrypto.generateKeyDerivation(
                tx_public_key, Wallet.view.privateKey);

            expected_publicEphemeral = await TurtleCoinCrypto.derivePublicKey(
                expected_derivation, output_index, Wallet.spend.publicKey);

            expected_privateEphemeral = await TurtleCoinCrypto.deriveSecretKey(
                expected_derivation, output_index, Wallet.spend.privateKey);

            expected_key_image = await TurtleCoinCrypto.generateKeyImage(
                expected_publicEphemeral, expected_privateEphemeral);

            ready = true;
        });

        it('Generate Key Derivation', async () => {
            const derivation = await ledger.generateKeyDerivation(tx_public_key, false);

            assert(expected_derivation === derivation);
        });

        it('Generate Key Derivation: Fails when supplying private key', async () => {
            await ledger.generateKeyDerivation(expected_privateEphemeral, false)
                .then(() => assert(false))
                .catch(() => assert(true));
        });

        it('Derive Public Key', async () => {
            const publicEphemeral = await ledger.derivePublicKey(expected_derivation, output_index, false);

            assert(publicEphemeral === expected_publicEphemeral);
        });

        it('Derive Public Key: Fails when wrong output index', async () => {
            const publicEphemeral = await ledger.derivePublicKey(expected_derivation, output_index + 3, false);

            assert(publicEphemeral !== expected_publicEphemeral);
        });

        it('Derive Public Key: Fails when wrong derivation supplied', async () => {
            const publicEphemeral = await ledger.derivePublicKey(tx_public_key, output_index, false);

            assert(publicEphemeral !== expected_publicEphemeral);
        });

        it('Derive Secret Key', async () => {
            const privateEphemeral = await ledger.deriveSecretKey(expected_derivation, output_index, false);

            assert(privateEphemeral === expected_privateEphemeral);
        });

        it('Derive Secret Key: Fails when wrong output index', async () => {
            const privateEphemeral = await ledger.deriveSecretKey(expected_derivation, output_index + 3, false);

            assert(privateEphemeral !== expected_privateEphemeral);
        });

        it('Derive Secret Key: Fails when wrong derivation supplied', async () => {
            const privateEphemeral = await ledger.deriveSecretKey(tx_public_key, output_index, false);

            assert(privateEphemeral !== expected_privateEphemeral);
        });

        it('Generate Key Image', async () => {
            const key_image = await ledger.generateKeyImage(
                tx_public_key, output_index, expected_publicEphemeral, false);

            assert(key_image === expected_key_image);
        });

        it('Generate Key Image: Fails when wrong output index', async () => {
            await ledger.generateKeyImage(
                tx_public_key, output_index + 3, expected_publicEphemeral, false)
                .then(() => assert(false))
                .catch(() => assert(true));
        });

        describe('Ring Signatures', () => {
            const public_keys: string[] = [];
            const real_output_index = 0;

            let expected_ring_signatures: string[];
            let prepared_ring_signatures: string[];
            let tx_prefix_hash: string;
            let k: string;

            before(async () => {
                const wait = () => {
                    return new Promise(resolve => {
                        const check = () => {
                            if (!ready) {
                                setTimeout(check, 100);
                            } else {
                                return resolve();
                            }
                        };
                        check();
                    });
                };
                await wait();

                public_keys.push(expected_publicEphemeral);

                tx_prefix_hash = await TurtleCoinCrypto.cn_fast_hash(ledgerIdent);

                for (let i = 0; i < 3; i++) {
                    public_keys.push((await TurtleCoinCrypto.generateKeys()).publicKey);
                }

                const prepped = await TurtleCoinCrypto.prepareRingSignatures(
                    tx_prefix_hash, expected_key_image, public_keys, real_output_index);

                prepared_ring_signatures = prepped.signatures;

                k = prepped.key;

                expected_ring_signatures = await TurtleCoinCrypto.generateRingSignatures(
                    tx_prefix_hash, expected_key_image, public_keys, expected_privateEphemeral, real_output_index);
            });

            it('Complete Ring Signatures', async function () {
                const sigs = prepared_ring_signatures;

                sigs[real_output_index] = await ledger.completeRingSignature(
                    tx_public_key, output_index, expected_publicEphemeral, k, sigs[real_output_index], false);

                assert(await TurtleCoinCrypto.checkRingSignature(
                    tx_prefix_hash, expected_key_image, public_keys, sigs));
            });

            it('Complete Ring Signatures: Fails when wrong output index', async function () {
                const sigs = prepared_ring_signatures;

                await ledger.completeRingSignature(
                    tx_public_key, output_index + 3, expected_publicEphemeral, k, sigs[real_output_index], false)
                    .then(() => assert(false))
                    .catch(() => assert(true));
            });

            it('Generate Ring Signatures', async function () {
                const sigs = await ledger.generateRingSignatures(
                    tx_public_key, output_index, expected_publicEphemeral, tx_prefix_hash,
                    public_keys, real_output_index, false);

                assert(await TurtleCoinCrypto.checkRingSignatures(
                    tx_prefix_hash, expected_key_image, public_keys, sigs));
            });

            it('Generate Ring Signatures: Fails when wrong output index', async function () {
                await ledger.generateRingSignatures(
                    tx_public_key, output_index + 3, expected_publicEphemeral, tx_prefix_hash,
                    public_keys, real_output_index, false)
                    .then(() => assert(false))
                    .catch(() => assert(true));
            });

            it('Check Ring Signatures', async function () {
                assert(await ledger.checkRingSignatures(
                    tx_prefix_hash, expected_key_image, public_keys, expected_ring_signatures));
            });

            it('Check Ring Signatures: Fails when wrong signatures supplied', async function () {
                assert(!await ledger.checkRingSignatures(
                    tx_prefix_hash, expected_key_image, public_keys, expected_ring_signatures.reverse()));
            });
        });
    });
});