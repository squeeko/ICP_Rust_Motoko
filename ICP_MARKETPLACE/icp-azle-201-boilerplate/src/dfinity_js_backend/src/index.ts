import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic, Principal, serialize, Result } from 'azle';
import express from 'express';
import cors from 'cors';
import { hexAddressFromPrincipal } from "azle/canisters/ledger";


class Product {
    id: string;
    title: string;
    description: string;
    location: string;
    price: number;
    seller: string;
    attachmentURL: string;
    soldAmount: number
}

class ProductPayload {
    title: string;
    description: string;
    location: string;
    price: number;
    attachmentURL: string
}

enum OrderStatus {
    PaymentPending,
    Completed
}

class Order {
    productId: string;
    price: string;
    status: string;
    seller: string
}

const productsStorage = StableBTreeMap<string, Product>(0);
const orders = StableBTreeMap<string, Order>(1);

const ICRC_CANISTER_PRINCIPAL = "mxzaz-hqaaa-aaaar-qaada-cai";

export default Server(() => {
    const app = express();

    app.use(cors());
    app.use(express.json());

// Product Endpoints
    app.get("/products", (req, res) => {
        res.json(productsStorage.values());
    });

    app.get("/orders", (req, res) => {
        res.json(orders.values())
    });

    app.get("/products/:id", (req, res) => {
        const productId = req.params.id;
        const productOpt = productsStorage.get(productId);
        if ("None" in productOpt) {
            res.status(404).send(`the product with id=${productId} not found`);
        } else [
            res.json(productOpt.Some)
        ]
    });

    app.post("/products", (req, res) => {
        const payload = req.body as ProductPayload;
        const product = { id: uuidv4(), soldAmount: 0, seller: ic.caller().toText, ...payload };
        productsStorage.insert(product.id, product);
        return res.json(product);
    });

    app.put("/products/:id", (req, res) => {
        const productId = req.params.id;
        const payload = req.body as ProductPayload;
        const productOpt = productsStorage.get(productId);
        if ("None" in productOpt) {
            res.status(400).send(`couldn't update a product with id=${productId}. product not found`);
        } else {
            const product = productOpt.Some;
            const updatedProduct = {...product, ...payload, updatedAt: getCurrentDate() };
            productsStorage.insert(product.id, updatedProduct);
            res.json(updatedProduct);
        }
    });

    app.delete("/products/:id", (req, res) => {
        const productId = req.params.id;
        const deletedProductOpt = productsStorage.remove(productId);
        if ("None" in deletedProductOpt) {
            res.status(400).send(`couldn't delete a product with id=${productId}. product not found`);
        } else {
            res.json(deletedProductOpt.Some);
        }
    });

// Order Endpoints
    app.post("/orders", async (req, res) => {
        const productOpt = productsStorage.get(req.body.productId);
        if ("None" in productOpt) {
            res.send(`cannot create the order: product=${req.body.productId} not found`);
        } else {
            const product = productOpt.Some;
            const allowanceResponse = await allowanceTransfer(product.seller, BigInt(product.price));
            if (allowanceResponse.Err) {
                res.send(allowanceResponse.Err);
                return;
            }
            const order: Order = {
                productId: product.id,
                price: product.price,
                status: OrderStatus[OrderStatus.Completed],
                seller: product.seller
            };
            orders.insert(uuidv4(), order);
            product.soldAmount += 1;
            productsStorage.insert(product.id, product);
            res.json(order);
        }
    });

    app.get("/principa-to-address/:principalHex", (req, res) => {
        const principal = Principal.fromText(req.params.principalHex);
        res.json({ account: hexAddressFromPrincipal(principal, 0) });
    });

    return app.listen();
    });

    // Helper functions

    function getCurrentDate() {
        const timestamp = new Number(ic.time());
        return new Date(timestamp.valueOf() / 1000_000);
    }

    async function allowanceTransfer(to: string, amount: bigint): Promise<Result<any, string>> {
        try {
            const response = await fetch(`icp://${ICRC_CANISTER_PRINCIPAL}/icrc2_transfer_from`, {
                body: serialize({
                    candidPath: "/src/icrc1-ledger.did",
                    args: [{
                        spender_subaccount: [],
                        created_at_time: [],
                        memo: [],
                        amount,
                        fee: [],
                        from: { owner: ic.caller(), subaccount: [] },
                        to: { owner: Principal.fromText(to), subaccount: [] }
                    }]
                })
            });

            return Result.Ok(response);
        } catch (err) {
            let errorMessage = "an error occurred on approval";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            return Result.Err(errorMessage);
        }
    }









