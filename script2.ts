import fs from "fs"
import {clusterApiUrl, ComputeBudgetProgram, Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction} from "@solana/web3.js"
import * as token from "@solana/spl-token"
import bs58 from "bs58"
import { Helius } from "helius-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import {HELIUS_API, RPC_ENDPOINT, PVT_KEY, MINT} from "./params"

const pathname = "airdrop.json"
const file = fs.readFileSync(pathname)

const keypair = Keypair.fromSecretKey(Uint8Array.from(bs58.decode(PVT_KEY)));
const connection = new Connection(RPC_ENDPOINT);
const mint = new PublicKey(MINT)
const myAta = token.getAssociatedTokenAddressSync(mint, keypair.publicKey);

(async() => {
    const data: any[] = JSON.parse(file.toString());
    let m = 1;

    for (let i=0; i<data.length;i+=m) {
        if (data[i].signature) {
            console.log(`The address: ${data[i].address} at line. ${i+1} is skipped`)
            m=1
        } else {
            const ixs: TransactionInstruction[] = [];
            let limit = data.length-i > 10 ? 10 : data.length-i;

            for (let j=i;j<i+limit;j++) {
                let owner = new PublicKey(data[j].address)
                let ata = token.getAssociatedTokenAddressSync(mint, owner)
                let isAta = await connection.getAccountInfo(ata);

                if (!isAta) {
                    const createAtaIx = token.createAssociatedTokenAccountInstruction(
                        keypair.publicKey, ata, owner, mint
                    );
                    ixs.push(createAtaIx)
                }

                const trfIx = token.createTransferInstruction(
                    myAta, ata, keypair.publicKey, BigInt(data[j].value) * BigInt(Math.pow(10,5))
                )

                ixs.push(trfIx)
            }

            const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API}`, {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                },
                body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getPriorityFeeEstimate",
                params: [{
                    "accountKeys": [TOKEN_PROGRAM_ID.toBase58()],
                    "options": {
                        "includeAllPriorityFeeLevels": true,
                    }
                }]
                }),
            });

            const fees = await response.json().then(r => r.result.priorityFeeLevels.medium);
            
            const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: Math.floor(fees),
            });
            
            const computeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: 200_000,
            });
            
            const tx = new Transaction().add(computePriceIx,...ixs);
            const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);

            for (let j=i;j<i+limit;j++) {
                data[j].signature = sig;
                fs.writeFileSync(pathname, JSON.stringify(data));
            }
            console.log(`Airdropped addresses from ${i+1} to ${i+limit}`)
            m=limit
        }
    }
})()