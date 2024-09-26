import { HttpAgent, Actor } from "@dfinity/agent";
import { getAuthClient } from "./auth";

const HOST = window.location.origin;

export async function createCanisterActor(canisterId, idl) {
    const authClient = await getAuthClient();
    const agent = new HttpAgent({
        host: HOST,
        identity: authClient.getIdentity()
    });

    await agent.fetchRootKey(); // this needed for LOCAL env only
    return Actor.createActor(idl, {
        agent,
        canisterId,
    });
}